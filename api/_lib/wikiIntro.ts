import { CONFIG } from './config.js';
import { readCapped } from './http.js';
import { cut } from '../../shared/text.js';

/**
 * Reads the opening section of English Wikipedia articles, for picked "Found online" sources
 * (Wikidata or Wikipedia candidates) that otherwise reach the model as a one-line description.
 * Free, no key. One batched request. Never throws: any failure leaves every title `null`, and the
 * caller keeps the source's own short text.
 */

const {
  url: API,
  userAgent: USER_AGENT,
  maxBytes: MAX_UPSTREAM_BYTES,
  timeoutMs: TIMEOUT_MS,
  maxTitles: MAX_TITLES,
} = CONFIG.wiki;

export interface WikiIntroDeps {
  fetch: typeof fetch;
  timeoutMs?: number;
}

export interface WikiTitle {
  title: string;
  /** The source's own description; a wrong-article guard checks the intro shares a word with it. */
  description?: string;
}

const SENTENCE_END = /(?<=[.!?])\s+/;
/** Romanisation asides ("(Japanese: …, Hepburn: …)", one nested level) only cost characters. */
const ASIDE =
  /\s*\((?:[^()]|\([^()]*\))*?\b(?:Japanese|Hepburn|Chinese|Korean|pinyin|lit\.|pronounced|IPA)\b(?:[^()]|\([^()]*\))*\)/g;

/** Whole sentences from the start that fit `max` characters; a too-long first sentence is cut. */
export function leadSentences(text: string, max: number): string {
  const plain = text.replace(ASIDE, '').replace(/\s+/g, ' ').trim();
  let out = '';
  for (const sentence of plain.split(SENTENCE_END)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (Array.from(next).length > max) break;
    out = next;
  }
  return out || cut(plain, max);
}

const wordsOf = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];

/**
 * True when the intro plausibly describes the same thing: it shares a 4+ letter word with the
 * description beyond the title's own words. A description with no such words can't be checked.
 */
function sameSubject(intro: string, { title, description }: WikiTitle): boolean {
  const titleWords = new Set(wordsOf(title));
  const words = wordsOf(description ?? '').filter((w) => !titleWords.has(w));
  if (words.length === 0) return true;
  const introWords = new Set(wordsOf(intro));
  return words.some((w) => introWords.has(w));
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `from → to` pairs from MediaWiki's `normalized` or `redirects` lists. */
function renames(list: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(list)) return map;
  for (const r of list) {
    if (isRecord(r) && typeof r.from === 'string' && typeof r.to === 'string')
      map.set(r.from, r.to);
  }
  return map;
}

/**
 * Intro text per requested title (an entry for every one), at most `maxChars` characters of whole
 * sentences; `null` when there is no such article, it is a disambiguation page, it looks like a
 * different subject, or the request failed.
 */
export async function readWikiIntros(
  titles: readonly WikiTitle[],
  maxChars: number,
  deps: WikiIntroDeps,
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>(titles.map((t) => [t.title, null]));
  const asked = [...new Set(titles.map((t) => t.title))].slice(0, MAX_TITLES);
  if (asked.length === 0 || maxChars <= 0) return out;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'extracts|pageprops',
    ppprop: 'disambiguation',
    exintro: '1',
    explaintext: '1',
    exlimit: String(MAX_TITLES),
    redirects: '1',
    titles: asked.join('|'),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await deps.fetch(`${API}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return out;
    }
    const body: unknown = JSON.parse(await readCapped(response, MAX_UPSTREAM_BYTES));
    const query = isRecord(body) && isRecord(body.query) ? body.query : null;
    if (!query || !Array.isArray(query.pages)) return out;

    const intros = new Map<string, string>();
    for (const page of query.pages) {
      if (!isRecord(page) || typeof page.title !== 'string' || typeof page.extract !== 'string')
        continue;
      const isDisambiguation = isRecord(page.pageprops) && 'disambiguation' in page.pageprops;
      if (page.missing || isDisambiguation) continue;
      if (page.extract.trim()) intros.set(page.title, page.extract);
    }
    const normalized = renames(query.normalized);
    const redirects = renames(query.redirects);
    for (const t of titles) {
      const name = normalized.get(t.title) ?? t.title;
      const intro = intros.get(redirects.get(name) ?? name);
      if (intro && sameSubject(intro, t)) out.set(t.title, leadSentences(intro, maxChars));
    }
    return out;
  } catch {
    // Timeout, network failure, oversized or bad JSON. Not logged: it could echo the titles.
    return new Map(titles.map((t) => [t.title, null]));
  } finally {
    clearTimeout(timer);
  }
}
