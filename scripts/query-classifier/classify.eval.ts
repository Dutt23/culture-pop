/**
 * Offline experiment: do the hand-written intent rules or a small embedding model sort short search
 * queries better? Reads docs/eval/query-classifier/queries.json, writes a Markdown summary to
 * .cache/query-classifier/summary.md and every prediction to results.json beside it. Nothing here
 * ships.
 *
 *   npx vitest run --config scripts/query-classifier/vitest.config.ts
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { looksLikePhrase, looksLikeQuestion } from '../../src/services/retrieval/community';
import { requestTopic } from '../../src/services/retrieval/rewrite';
import {
  cosine,
  embed,
  MODELS,
  timeEach,
  type ModelKey,
} from '../../src/test/search-eval/embedder';

const INTENTS = ['lookup', 'question', 'request', 'phrase_or_quote'] as const;
const LEANS = ['fiction_or_myth', 'real_world', 'either'] as const;
type Intent = (typeof INTENTS)[number];
type Lean = (typeof LEANS)[number];

interface LabelledQuery {
  q: string;
  intent: Intent;
  lean: Lean;
  source: 'eval' | 'new';
  hinglish?: boolean;
  note?: string;
}

/** Two short descriptions per label; a query takes the label whose closer description is nearest. */
const DESCRIPTIONS: Record<Intent | Lean, readonly string[]> = {
  lookup: [
    'The name of a film, TV show, anime, video game, song, band, character or person.',
    'A title or a name, nothing else.',
  ],
  question: [
    'A question asking who, what, why, how or when about something.',
    'Who is the strongest? Why did this happen? What does it mean?',
  ],
  request: [
    'A request asking to explain, tell about or describe the history, origin or story of a topic.',
    'Tell me about the history of something. Explain the plot.',
  ],
  phrase_or_quote: [
    'A famous movie dialogue, catchphrase, meme caption or slang expression.',
    'A line that someone says in a film, a song or a meme.',
  ],
  fiction_or_myth: [
    'About fictional characters and stories: anime, films, TV shows, comics, video games.',
    'About myths, legends, gods and folklore.',
  ],
  real_world: [
    'About real history, real people, politics and real events.',
    'About science, nature, animals, sports, cars and companies in the real world.',
  ],
  either: ['A meme, a slang word or a catchphrase.', 'The title of a film, show, song or game.'],
};

/** The rules as the app uses them: a request opener first (D50 `topic`), then question style. */
function ruleIntent(query: string): Intent {
  if (requestTopic(query) !== undefined) return 'request';
  if (looksLikeQuestion(query)) return 'question';
  return looksLikePhrase(query) ? 'phrase_or_quote' : 'lookup';
}

/** D50: question-style searches lean to stories (setting `stories`, on by default); others don't lean. */
const ruleLean = (query: string): Lean => (looksLikeQuestion(query) ? 'fiction_or_myth' : 'either');

/** Per query, per label: the highest cosine to any of the label's descriptions. */
async function labelScores(
  model: ModelKey,
  labels: readonly (Intent | Lean)[],
  queryVectors: readonly number[][],
): Promise<number[][]> {
  const vectors = await Promise.all(labels.map((label) => embed(model, DESCRIPTIONS[label])));
  return queryVectors.map((query) =>
    vectors.map((descs) => Math.max(...descs.map((d) => cosine(query, d)))),
  );
}

/** For each query vector, the label with the highest score. */
async function nearest<L extends Intent | Lean>(
  model: ModelKey,
  labels: readonly L[],
  queryVectors: readonly number[][],
): Promise<L[]> {
  const scores = await labelScores(model, labels, queryVectors);
  return scores.map((row) => labels[row.indexOf(Math.max(...row))] as L);
}

const pct = (hits: number, total: number) =>
  total === 0 ? 'n/a' : `${hits}/${total} (${Math.round((100 * hits) / total)}%)`;

function accuracy<T>(truth: readonly T[], predicted: readonly T[], keep?: readonly boolean[]) {
  const index = truth.map((_, i) => i).filter((i) => keep?.[i] ?? true);
  return pct(index.filter((i) => truth[i] === predicted[i]).length, index.length);
}

/** Rows: true label; columns: predicted label. */
function confusion(labels: readonly string[], truth: readonly string[], predicted: string[]) {
  const head = `| true \\ predicted | ${labels.join(' | ')} |\n|---|${labels.map(() => '---|').join('')}`;
  const rows = labels.map((row) => {
    const cells = labels.map(
      (col) => truth.filter((t, i) => t === row && predicted[i] === col).length,
    );
    return `| ${row} | ${cells.join(' | ')} |`;
  });
  return [head, ...rows].join('\n');
}

const quantile = (values: readonly number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
};

function folderMb(dir: string): number {
  const bytes = (path: string): number =>
    statSync(path).isDirectory()
      ? readdirSync(path).reduce((sum, name) => sum + bytes(join(path, name)), 0)
      : statSync(path).size;
  return Math.round(bytes(dir) / 1e5) / 10;
}

it('scores rules and embedding models against the labelled queries', async () => {
  const { queries } = JSON.parse(
    readFileSync(resolve('docs/eval/query-classifier/queries.json'), 'utf8'),
  ) as { queries: LabelledQuery[] };

  // Self-check of the labelled set before scoring it.
  expect(queries.length).toBeGreaterThanOrEqual(100);
  expect(new Set(queries.map((x) => x.q)).size).toBe(queries.length);
  for (const x of queries) {
    expect(INTENTS).toContain(x.intent);
    expect(LEANS).toContain(x.lean);
  }

  const texts = queries.map((x) => x.q);
  const intents = queries.map((x) => x.intent);
  const leans = queries.map((x) => x.lean);
  const hinglish = queries.map((x) => x.hinglish === true);
  // The lean only changes what is shown for a question (D50), and only when it isn't "either".
  const leanMatters = queries.map((x) => x.intent === 'question' && x.lean !== 'either');

  const rules = {
    intent: texts.map(ruleIntent),
    lean: texts.map(ruleLean),
    question: texts.map(looksLikeQuestion),
  };

  const english = await embed('english', texts);
  // Fiction minus real-world score: above zero leans to stories. Only for the fold decision.
  const storiesMargin = (
    await labelScores('english', ['fiction_or_myth', 'real_world'], english)
  ).map(([fiction, real]) => (fiction as number) - (real as number));
  const model = {
    intent: await nearest('english', INTENTS, english),
    lean: await nearest('english', LEANS, english),
    stories: storiesMargin.map((margin) => margin > 0),
  };
  // Rules first; the model only for queries the rules leave to the default (no request opener,
  // not question style).
  const hybridIntent = rules.intent.map((rule, i) =>
    rule === 'request' || rule === 'question' ? rule : (model.intent[i] as Intent),
  );

  // Fold decision on questions whose lean matters: fold real-world pages exactly when the label is
  // fiction. Rules fold on every question-style query; the hybrid also asks the model.
  const foldTruth = leans.map((lean) => lean === 'fiction_or_myth');
  const rulesFold = rules.question;
  const hybridFold = rules.question.map((q, i) => q && (model.stories[i] as boolean));

  const multiIndex = texts.map((_, i) => i).filter((i) => hinglish[i]);
  const sub = <T>(values: readonly T[]) => multiIndex.map((i) => values[i] as T);
  const multiVectors = await embed('multilingual', sub(texts));
  const multi = {
    intent: await nearest('multilingual', INTENTS, multiVectors),
    lean: await nearest('multilingual', LEANS, multiVectors),
  };

  const englishMs = await timeEach('english', texts);
  const multiMs = await timeEach('multilingual', sub(texts));
  const ruleStart = performance.now();
  for (let round = 0; round < 100; round++) {
    for (const q of texts) {
      ruleIntent(q);
      ruleLean(q);
    }
  }
  const ruleMs = (performance.now() - ruleStart) / (100 * texts.length);

  const cacheDir = resolve('.cache/transformers');
  const rows = queries.map((x, i) => ({
    ...x,
    rules: { intent: rules.intent[i], lean: rules.lean[i] },
    model: { intent: model.intent[i], lean: model.lean[i], storiesMargin: storiesMargin[i] },
    hybridIntent: hybridIntent[i],
    ...(x.hinglish && {
      multilingual: {
        intent: multi.intent[multiIndex.indexOf(i)],
        lean: multi.lean[multiIndex.indexOf(i)],
      },
    }),
    englishMs: Math.round((englishMs[i] as number) * 10) / 10,
  }));
  mkdirSync(resolve('.cache/query-classifier'), { recursive: true });
  writeFileSync(resolve('.cache/query-classifier/results.json'), JSON.stringify(rows, null, 2));

  const intentWrong = (predicted: readonly string[]) =>
    rows
      .flatMap((r, i) =>
        predicted[i] === r.intent ? [] : [`"${r.q}" (${r.intent} → ${predicted[i]})`],
      )
      .join('; ');
  const yn = (fold: boolean | undefined) => (fold ? 'fold' : 'keep');

  const lines = [
    `## Query classifier: ${queries.length} queries (${multiIndex.length} Hinglish)`,
    '',
    '| measure | rules | MiniLM-L6 | hybrid |',
    '|---|---|---|---|',
    `| intent, all | ${accuracy(intents, rules.intent)} | ${accuracy(intents, model.intent)} | ${accuracy(intents, hybridIntent)} |`,
    `| intent, Hinglish | ${accuracy(intents, rules.intent, hinglish)} | ${accuracy(intents, model.intent, hinglish)} | ${accuracy(intents, hybridIntent, hinglish)} |`,
    `| lean, all | ${accuracy(leans, rules.lean)} | ${accuracy(leans, model.lean)} | - |`,
    `| lean, questions | ${accuracy(leans, rules.lean, leanMatters)} | ${accuracy(leans, model.lean, leanMatters)} | - |`,
    `| fold decision, questions | ${accuracy(foldTruth, rulesFold, leanMatters)} | ${accuracy(foldTruth, model.stories, leanMatters)} | ${accuracy(foldTruth, hybridFold, leanMatters)} |`,
    '',
    `Hinglish subset, multilingual MiniLM-L12: intent ${accuracy(sub(intents), multi.intent)}, lean ${accuracy(sub(leans), multi.lean)}`,
    '',
    '### Intent confusion: rules',
    confusion(INTENTS, intents, rules.intent),
    '',
    '### Intent confusion: MiniLM-L6',
    confusion(INTENTS, intents, model.intent),
    '',
    '### Intent confusion: hybrid',
    confusion(INTENTS, intents, hybridIntent),
    '',
    '### Lean confusion: MiniLM-L6',
    confusion(LEANS, leans, model.lean),
    '',
    `Rules intent wrong: ${intentWrong(rules.intent)}`,
    '',
    `MiniLM-L6 intent wrong: ${intentWrong(model.intent)}`,
    '',
    `Hybrid intent wrong: ${intentWrong(hybridIntent)}`,
    '',
    '### Fold decision on questions (truth / rules / MiniLM-L6 / hybrid)',
    ...rows.flatMap((r, i) =>
      leanMatters[i]
        ? [
            `- "${r.q}": ${yn(foldTruth[i])} / ${yn(rulesFold[i])} / ${yn(model.stories[i])} / ${yn(hybridFold[i])} (margin ${(storiesMargin[i] as number).toFixed(3)})`,
          ]
        : [],
    ),
    '',
    '### Size and time (this Mac, Node, CPU; not a phone)',
    `- ${MODELS.english}: ${folderMb(join(cacheDir, MODELS.english))} MB on disk (q8 ONNX + tokenizer); median ${quantile(englishMs, 0.5).toFixed(1)} ms, p95 ${quantile(englishMs, 0.95).toFixed(1)} ms per query`,
    `- ${MODELS.multilingual}: ${folderMb(join(cacheDir, MODELS.multilingual))} MB on disk; median ${quantile(multiMs, 0.5).toFixed(1)} ms, p95 ${quantile(multiMs, 0.95).toFixed(1)} ms per query`,
    `- rules: ${(ruleMs * 1000).toFixed(1)} µs per query`,
  ];
  writeFileSync(resolve('.cache/query-classifier/summary.md'), lines.join('\n'));
  console.log(lines.join('\n'));
});
