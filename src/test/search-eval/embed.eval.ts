/**
 * Offline embedding experiment (docs/SEARCH_RANKING.md, "Embedding experiment"). Never part of
 * `npm test`, and nothing in the app imports it:
 *   npx vitest run --config vitest.eval.config.ts src/test/search-eval/embed.eval.ts
 * Embeds the query and every candidate's text from the captured snapshot (no new fetches) with
 * Transformers.js, combines cosine similarity with the reranker, and writes docs/eval/embedding-offline.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { scoreCandidates } from '../../services/retrieval/rerank';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import { cosine, embed, MODELS, timeEach, type EmbedTiming, type ModelKey } from './embedder';
import { percentile } from './metrics';
import type { EvalCase } from './queries';
import {
  capturedCases,
  exactTitleCases,
  loadSnapshot,
  scoreSnapshot,
  summaryOf,
  worsened,
  type Order,
} from './rerankEval';
import { splitCases } from './split';

const REPORT = fileURLToPath(new URL('../../../docs/eval/embedding-offline.md', import.meta.url));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const MAX_TEXT_CHARS = 300;
const WEIGHTS = [0, 10, 20, 40, 80, 160, 320];
const ILLUSTRATIVE_WEIGHT = 40;

/** Words that make a query describe what it is looking for (a kind of thing or a context). */
const DESCRIPTIVE =
  /\b(meme|cartoon|comic|song|lyrics|dialogue|scene|band|theme|video|game|rap|series|show|movie|film|anime|incredibles|breaking bad|big hero)\b/;
const isDescriptive = (c: EvalCase) => DESCRIPTIVE.test(c.query.toLowerCase());

/** Title plus the first source text we already hold (Wikipedia extract, Wiktionary sense, Wikiquote line). */
function candidateText(c: RetrievedCandidate): string {
  const excerpt = c.sources.find((s) => s.excerpt)?.excerpt ?? '';
  return `${c.title}. ${excerpt}`.slice(0, MAX_TEXT_CHARS).trim();
}

type Cosines = Map<string, Map<string, number>>;

async function cosinesFor(
  model: ModelKey,
  snapshot: ReturnType<typeof loadSnapshot>,
  cases: readonly EvalCase[],
  timing: EmbedTiming,
): Promise<Cosines> {
  const texts = cases.flatMap((c) => [
    c.query,
    ...(snapshot.cases[c.id]?.candidates ?? []).map(candidateText),
  ]);
  const vectors = await embed(model, texts, timing);
  const out: Cosines = new Map();
  let at = 0;
  for (const c of cases) {
    const q = vectors[at++] as number[];
    const row = new Map<string, number>();
    for (const cand of snapshot.cases[c.id]?.candidates ?? []) {
      row.set(cand.id, cosine(q, vectors[at++] as number[]));
    }
    out.set(c.query, row);
  }
  return out;
}

type Mode =
  { kind: 'rerank' } | { kind: 'tiebreak' } | { kind: 'weighted'; w: number } | { kind: 'cosine' };

function orderFor(mode: Mode, cos: Cosines): Order {
  return (query, candidates) => {
    const row = cos.get(query) ?? new Map<string, number>();
    const c = (cand: RetrievedCandidate) => row.get(cand.id) ?? 0;
    return scoreCandidates(query, candidates)
      .map((s) => ({
        ...s,
        total:
          mode.kind === 'weighted'
            ? s.score + mode.w * c(s.candidate)
            : mode.kind === 'cosine'
              ? c(s.candidate)
              : s.score,
        tie: mode.kind === 'tiebreak' ? c(s.candidate) : 0,
      }))
      .sort((a, b) => b.total - a.total || b.tie - a.tie || a.index - b.index)
      .map((s) => s.candidate);
  };
}

function row(label: string, runs: ReturnType<typeof scoreSnapshot>): string {
  const s = summaryOf(runs);
  const amb =
    s.ambiguityCoverage === null ? '–' : `${pct(s.ambiguityCoverage)} (${s.ambiguityCases})`;
  return `| ${label} | ${s.cases} | ${pct(s.recallAt5)} | ${s.mrrAt10.toFixed(3)} | ${pct(s.incorrectTopRate)} | ${pct(s.noResultRate)} | ${amb} |`;
}

const HEADER = [
  '| Order | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |',
  '|---|---|---|---|---|---|---|',
];

async function localSemantic(model: ModelKey): Promise<string[]> {
  const { references, aliases, interpretations } = buildSeed();
  const docs = references.map((r) => {
    const own = aliases.filter((a) => a.referenceId === r.id).map((a) => a.phrase);
    const sense = interpretations.find((i) => i.referenceId === r.id);
    return { id: r.id, title: r.title, text: [r.title, ...own, sense?.summary ?? ''].join('. ') };
  });
  // The seed library has no Matrix entry, so one is added here (experiment only) to answer
  // "would 'red pill' find The Matrix if its description mentions it?".
  docs.push({
    id: 'matrix (experiment only)',
    title: 'The Matrix',
    text: 'The Matrix. A 1999 science fiction film. A hacker is offered a choice: take the red pill and learn the truth about the simulated world, or the blue pill and forget.',
  });
  const queries: [string, string][] = [
    ['red pill', 'matrix (experiment only)'],
    ['dog sitting in a burning room', 'this-is-fine-dog'],
    ['guy checking out another girl while his girlfriend looks angry', 'distracted-boyfriend'],
    ['cartoon dad says oh when he hurts himself', 'doh-simpsons'],
    ['no worries song from the lion king', 'hakuna-matata-lion-king'],
    ['sheldon laughing after a prank', 'bazinga-big-bang-theory'],
    ['dismissing an older generation', 'ok-boomer'],
    ['pizza recipe', ''],
    ['weather tomorrow', ''],
  ];
  const docVectors = await embed(
    model,
    docs.map((d) => d.text),
  );
  const queryVectors = await embed(
    model,
    queries.map(([q]) => q),
  );
  const lines = [
    `| Query | Expected | Top 3 by cosine | First is expected | Top cosine |`,
    '|---|---|---|---|---|',
  ];
  queries.forEach(([query, expected], i) => {
    const ranked = docs
      .map((d, j) => ({ d, score: cosine(queryVectors[i] as number[], docVectors[j] as number[]) }))
      .sort((a, b) => b.score - a.score);
    const top3 = ranked
      .slice(0, 3)
      .map((r) => `${r.d.title} (${r.score.toFixed(2)})`)
      .join('; ');
    lines.push(
      `| ${query} | ${expected || '(nothing)'} | ${top3} | ${expected ? (ranked[0]?.d.id === expected ? 'yes' : 'no') : '–'} | ${(ranked[0]?.score ?? 0).toFixed(2)} |`,
    );
  });
  return lines;
}

it(
  'compares reranker alone with reranker plus embeddings',
  async () => {
    const snapshot = loadSnapshot();
    const cases = capturedCases(snapshot);
    const { tuning, heldOut } = splitCases(cases);
    const halves: [string, EvalCase[]][] = [
      ['tuning half', tuning],
      ['held-out half', heldOut],
      ['full set', cases],
    ];
    const lines = [
      '# Embedding experiment, offline (captured snapshot)',
      '',
      `Snapshot captured ${snapshot.capturedAt}, ${cases.length} cases. Candidate text = title + the first source text already held, cut to ${MAX_TEXT_CHARS} characters; no new fetches. Same tuning / held-out split as the reranker (see rerank-offline.md). The baseline is the reranker alone.`,
      '"Descriptive" queries are the ones containing a kind-of-thing or context word (meme, cartoon, comic, song, lyrics, dialogue, scene, band, film, anime, show, series...), or naming a work.',
      '',
    ];
    const baseline = orderFor({ kind: 'rerank' }, new Map());

    for (const model of Object.keys(MODELS) as ModelKey[]) {
      const timing: EmbedTiming = { texts: 0, totalMs: 0 };
      const cos = await cosinesFor(model, snapshot, cases, timing);
      const perQuery = await timeEach(
        model,
        cases.slice(0, 30).map((c) => c.query),
      );

      // Weight tuned on the tuning half only: best MRR, then fewest wrong tops, then the smaller weight.
      const tuned = WEIGHTS.map((w) => ({
        w,
        s: summaryOf(scoreSnapshot(snapshot, tuning, orderFor({ kind: 'weighted', w }, cos))),
      })).sort(
        (a, b) =>
          b.s.mrrAt10 - a.s.mrrAt10 || a.s.incorrectTopRate - b.s.incorrectTopRate || a.w - b.w,
      );
      const best = tuned[0]?.w ?? 0;
      // When tuning picks 0 (no cosine at all) the per-kind tables and rank changes below would be
      // empty, so they use 40 instead, a weight of the same size as the reranker's own scores.
      const shown = best > 0 ? best : ILLUSTRATIVE_WEIGHT;
      const modes: [string, Mode][] = [
        ['reranker alone', { kind: 'rerank' }],
        ['reranker, cosine as tie-break', { kind: 'tiebreak' }],
        ...[...new Set([10, shown, 160])].map((w): [string, Mode] => [
          `reranker + ${w} x cosine`,
          { kind: 'weighted', w },
        ]),
        ['cosine only', { kind: 'cosine' }],
      ];

      lines.push(
        `## ${MODELS[model]}`,
        '',
        `Best weight on the tuning half (MRR, then wrong tops, then the smaller weight): ${best}. Tuning-half MRR by weight: ${tuned.map((t) => `${t.w}: ${t.s.mrrAt10.toFixed(3)}`).join(', ')}.`,
        '',
      );
      const median = percentile(perQuery, 50);
      lines.push(
        `Embedding one query on this machine (Node, one at a time, q8 model): median ${median.toFixed(1)} ms, p95 ${percentile(perQuery, 95).toFixed(1)} ms (30 queries).`,
        '',
        ...HEADER,
      );
      for (const [name, set] of halves) {
        for (const [label, mode] of modes) {
          lines.push(row(`${name}: ${label}`, scoreSnapshot(snapshot, set, orderFor(mode, cos))));
        }
      }

      const chosen = orderFor({ kind: 'weighted', w: shown }, cos);
      const before = scoreSnapshot(snapshot, cases, baseline);
      const after = scoreSnapshot(snapshot, cases, chosen);
      const exact = new Set(exactTitleCases(snapshot, cases).map((c) => c.id));
      const exactWorse = worsened(before, after).filter((c) => exact.has(c.id));
      const heldBefore = summaryOf(scoreSnapshot(snapshot, heldOut, baseline));
      const heldAfter = summaryOf(scoreSnapshot(snapshot, heldOut, chosen));
      lines.push(
        '',
        `Exact-title cases worse than the reranker alone (full set, weight ${shown}): **${exactWorse.length}** of ${exact.size}. Held-out MRR ${heldBefore.mrrAt10.toFixed(3)} to ${heldAfter.mrrAt10.toFixed(3)}; wrong top ${pct(heldBefore.incorrectTopRate)} to ${pct(heldAfter.incorrectTopRate)}.`,
        '',
        `### By kind of query (full set, reranker alone vs reranker + ${shown} x cosine)`,
        '',
        '| Kind | n | Recall@5 | MRR@10 | Incorrect top |',
        '|---|---|---|---|---|',
      );
      const flags: [string, (c: EvalCase) => boolean][] = [
        ['misremembered', (c) => c.misremembered],
        ['descriptive', isDescriptive],
        ['indian', (c) => c.indian],
        ['ambiguous', (c) => c.ambiguous],
      ];
      for (const [name, has] of flags) {
        const subset = cases.filter(has);
        const b = summaryOf(scoreSnapshot(snapshot, subset, baseline));
        const a = summaryOf(scoreSnapshot(snapshot, subset, chosen));
        lines.push(
          `| ${name} | ${subset.length} | ${pct(b.recallAt5)} to ${pct(a.recallAt5)} | ${b.mrrAt10.toFixed(3)} to ${a.mrrAt10.toFixed(3)} | ${pct(b.incorrectTopRate)} to ${pct(a.incorrectTopRate)} |`,
        );
      }
      const changes = before.flatMap((run, i) => {
        const next = after[i];
        return next && run.score.rank !== next.score.rank
          ? [
              `- ${run.evalCase.id} "${run.evalCase.query}": rank ${run.score.rank ?? 'none'} to ${next.score.rank ?? 'none'}`,
            ]
          : [];
      });
      lines.push(
        '',
        `### Rank changes, reranker alone to reranker + ${shown} x cosine (${changes.length})`,
        '',
        ...changes,
        '',
      );
      lines.push(
        '### Semantic local search (ranking the seed library by cosine)',
        '',
        ...(await localSemantic(model)),
        '',
      );
    }
    mkdirSync(fileURLToPath(new URL('../../../docs/eval/', import.meta.url)), { recursive: true });
    writeFileSync(REPORT, lines.join('\n'));
    expect(cases.length).toBeGreaterThan(0);
  },
  2 * 60 * 60 * 1000,
);
