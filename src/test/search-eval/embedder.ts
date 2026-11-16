/**
 * Test-only sentence embeddings for the offline experiment (docs/SEARCH_RANKING.md, "Embedding
 * experiment"). Runs Transformers.js in Node; nothing here ships. Model files are downloaded once
 * from Hugging Face into `.cache/transformers`; vectors are cached under `.cache/vectors`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const MODELS = {
  english: 'Xenova/all-MiniLM-L6-v2',
  multilingual: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
} as const;
export type ModelKey = keyof typeof MODELS;

const MODEL_CACHE = resolve('.cache/transformers');
const VECTOR_CACHE = resolve('.cache/vectors');

type Extractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

const extractors = new Map<ModelKey, Promise<Extractor>>();

async function load(model: ModelKey): Promise<Extractor> {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = MODEL_CACHE;
  const extractor = await pipeline('feature-extraction', MODELS[model], { dtype: 'q8' });
  return extractor as unknown as Extractor;
}

const key = (model: ModelKey, text: string) =>
  createHash('sha1').update(`${MODELS[model]}\n${text}`).digest('hex');

function readCache(model: ModelKey): Record<string, number[]> {
  const file = resolve(VECTOR_CACHE, `${model}.json`);
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, number[]>)
    : {};
}

function writeCache(model: ModelKey, cache: Record<string, number[]>): void {
  const file = resolve(VECTOR_CACHE, `${model}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cache));
}

export interface EmbedTiming {
  texts: number;
  totalMs: number;
}

/** Unit-length vectors for `texts`, in order; texts seen before come from the cache. */
export async function embed(
  model: ModelKey,
  texts: readonly string[],
  timing?: EmbedTiming,
): Promise<number[][]> {
  const cache = readCache(model);
  const missing = [...new Set(texts.filter((t) => cache[key(model, t)] === undefined))];
  if (missing.length > 0) {
    if (!extractors.has(model)) extractors.set(model, load(model));
    const extract = await (extractors.get(model) as Promise<Extractor>);
    const BATCH = 16;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const start = performance.now();
      const out = (await extract(batch, { pooling: 'mean', normalize: true })).tolist();
      if (timing) {
        timing.texts += batch.length;
        timing.totalMs += performance.now() - start;
      }
      batch.forEach((text, index) => {
        cache[key(model, text)] = out[index] as number[];
      });
    }
    writeCache(model, cache);
  }
  return texts.map((t) => cache[key(model, t)] as number[]);
}

/** Cosine of two unit vectors. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] as number) * (b[i] as number);
  return sum;
}

/** Wall-clock ms to embed each text on its own, one at a time, ignoring the vector cache. */
export async function timeEach(model: ModelKey, texts: readonly string[]): Promise<number[]> {
  if (!extractors.has(model)) extractors.set(model, load(model));
  const extract = await (extractors.get(model) as Promise<Extractor>);
  await extract(['warm up'], { pooling: 'mean', normalize: true });
  const times: number[] = [];
  for (const text of texts) {
    const start = performance.now();
    await extract([text], { pooling: 'mean', normalize: true });
    times.push(performance.now() - start);
  }
  return times;
}
