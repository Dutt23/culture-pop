/**
 * Offline reranker benchmark over the captured snapshot (no network). Never part of `npm test`:
 *   npx vitest run --config vitest.eval.config.ts src/test/search-eval/rerank.eval.ts
 * Writes docs/eval/rerank-offline.md. `RERANK_GRID=1` prints the best weight settings on the tuning
 * half instead (tuning half only: the held-out half is never looked at while tuning).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  rerankCandidates,
  type RerankWeights,
} from '../../services/retrieval/rerank';
import {
  capturedCases,
  exactTitleCases,
  improved,
  keepOrder,
  loadSnapshot,
  scoreSnapshot,
  summaryOf,
  worsened,
  type Order,
} from './rerankEval';
import { meaningIds, scoringIds } from './report';
import { splitCases } from './split';

const REPORT = fileURLToPath(new URL('../../../docs/eval/rerank-offline.md', import.meta.url));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const byWeights =
  (weights: RerankWeights): Order =>
  (query, candidates) =>
    rerankCandidates(query, candidates, weights);

function row(label: string, runs: ReturnType<typeof scoreSnapshot>): string {
  const s = summaryOf(runs);
  const amb =
    s.ambiguityCoverage === null ? '–' : `${pct(s.ambiguityCoverage)} (${s.ambiguityCases})`;
  return `| ${label} | ${s.cases} | ${pct(s.recallAt5)} | ${s.mrrAt10.toFixed(3)} | ${pct(s.incorrectTopRate)} | ${pct(s.noResultRate)} | ${amb} |`;
}

function grid(): RerankWeights[] {
  const out: RerankWeights[] = [];
  for (const position of [0, 20, 40, 80])
    for (const exactTitle of [0, 10, 20, 40])
      for (const dictionary of [0, 20, 40, 60, 80]) out.push({ position, exactTitle, dictionary });
  return out;
}

const nonZero = (w: RerankWeights) => Object.values(w).filter((v) => v !== 0).length;

it('scores the reranker against the captured snapshot', () => {
  const snapshot = loadSnapshot();
  const cases = capturedCases(snapshot);
  const { tuning, heldOut } = splitCases(cases);

  if (process.env.RERANK_DIAG === '1') {
    // Tuning half only: each case's list in arrival order, with the score and an `*` on accepted IDs.
    const items = new Map(
      Object.entries(snapshot.wikiquoteQids).flatMap(([page, qid]) => (qid ? [[page, qid]] : [])),
    );
    const out = tuning.flatMap((evalCase) => {
      const accepted = new Set(evalCase.meanings.flatMap((m) => [...meaningIds(m, 'live')]));
      const list = snapshot.cases[evalCase.id]?.candidates ?? [];
      const lines = list.map((c) => {
        const [id] = scoringIds([c.id], items);
        const mark = accepted.has(id as string) ? '*' : ' ';
        return `  ${mark} ${c.id} | ${c.title} | ${c.kind}/${c.role}`;
      });
      return [`${evalCase.id} "${evalCase.query}"`, ...lines, ''];
    });
    writeFileSync(process.env.RERANK_OUT ?? 'rerank-diag.txt', out.join('\n'));
    return;
  }

  if (process.env.RERANK_CONFIGS) {
    // Named candidate settings, tuning half only (JSON object of name -> partial weights).
    const named = JSON.parse(process.env.RERANK_CONFIGS) as Record<string, Partial<RerankWeights>>;
    const zero: RerankWeights = { position: 0, exactTitle: 0, dictionary: 0 };
    const out = Object.entries(named).map(([name, partial]) => {
      const runs = scoreSnapshot(snapshot, tuning, byWeights({ ...zero, ...partial }));
      const s = summaryOf(runs);
      const exact = new Set(exactTitleCases(snapshot, tuning).map((c) => c.id));
      const bad = worsened(scoreSnapshot(snapshot, tuning, keepOrder), runs).filter((c) =>
        exact.has(c.id),
      );
      return `${name}: MRR ${s.mrrAt10.toFixed(3)} R@5 ${pct(s.recallAt5)} wrong-top ${pct(s.incorrectTopRate)} amb ${s.ambiguityCoverage === null ? '-' : pct(s.ambiguityCoverage)} exact-title worse ${bad.length}`;
    });
    const raw = summaryOf(scoreSnapshot(snapshot, tuning, keepOrder));
    out.unshift(
      `arrival: MRR ${raw.mrrAt10.toFixed(3)} R@5 ${pct(raw.recallAt5)} wrong-top ${pct(raw.incorrectTopRate)} amb ${raw.ambiguityCoverage === null ? '-' : pct(raw.ambiguityCoverage)}`,
    );
    writeFileSync(process.env.RERANK_OUT ?? 'rerank-configs.txt', out.join('\n'));
    return;
  }

  if (process.env.RERANK_GRID === '1') {
    const scored = grid().map((weights) => {
      const s = summaryOf(scoreSnapshot(snapshot, tuning, byWeights(weights)));
      return { weights, s };
    });
    scored.sort(
      (a, b) =>
        b.s.mrrAt10 - a.s.mrrAt10 ||
        a.s.incorrectTopRate - b.s.incorrectTopRate ||
        b.s.recallAt5 - a.s.recallAt5 ||
        nonZero(a.weights) - nonZero(b.weights),
    );
    const raw = summaryOf(scoreSnapshot(snapshot, tuning, keepOrder));
    const out = [
      `tuning cases ${tuning.length}; arrival order: MRR ${raw.mrrAt10.toFixed(3)} R@5 ${pct(raw.recallAt5)} wrong-top ${pct(raw.incorrectTopRate)}`,
      ...scored
        .slice(0, 12)
        .map(
          ({ weights, s }) =>
            `MRR ${s.mrrAt10.toFixed(3)} R@5 ${pct(s.recallAt5)} wrong-top ${pct(s.incorrectTopRate)} ${JSON.stringify(weights)}`,
        ),
    ];
    // Vitest hides console output here, so the grid result goes to a file.
    writeFileSync(process.env.RERANK_OUT ?? 'rerank-grid.txt', out.join('\n'));
    return;
  }

  const order = byWeights(DEFAULT_WEIGHTS);
  const halves = { 'tuning half': tuning, 'held-out half': heldOut, 'full set': cases };
  const lines = [
    '# Reranker, offline (captured snapshot)',
    '',
    `Snapshot captured ${snapshot.capturedAt}; ${cases.length} cases captured without a failing provider.`,
    'Split: cases grouped by base row (`Q3` and `Q3-v` together), alternating in file order; 1st, 3rd, 5th… group tunes, 2nd, 4th… is held out.',
    `Weights: \`${JSON.stringify(DEFAULT_WEIGHTS)}\``,
    '',
    '| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const [name, set] of Object.entries(halves)) {
    lines.push(row(`${name}: arrival order`, scoreSnapshot(snapshot, set, keepOrder)));
    lines.push(row(`${name}: reranked`, scoreSnapshot(snapshot, set, order)));
  }
  const before = scoreSnapshot(snapshot, cases, keepOrder);
  const after = scoreSnapshot(snapshot, cases, order);
  const exact = new Set(exactTitleCases(snapshot, cases).map((c) => c.id));
  const exactWorse = worsened(before, after).filter((c) => exact.has(c.id));
  const fmt = (c: { id: string; query: string; before: number | null; after: number | null }) =>
    `- ${c.id} "${c.query}": rank ${c.before ?? 'none'} → ${c.after ?? 'none'}`;
  // Ceiling for any reordering: an order that puts the acceptable result first whenever the
  // retrieved list holds one. What is missing from the list cannot be fixed by reordering.
  const present = before.filter((r) => r.score.rank !== null).length;
  const nonEmptyMissing = before.filter((r) => r.score.rank === null && !r.score.noResults).length;
  lines.push(
    '',
    `Ceiling for any reordering of these lists (full set, ${before.length} cases): an acceptable result is in the list for ${pct(present / before.length)} of cases (so best possible Recall@5 and MRR@10 are ${pct(present / before.length)} and the same share at rank 1); ${pct(nonEmptyMissing / before.length)} have a non-empty list with no acceptable result; ${pct(before.filter((r) => r.score.noResults).length / before.length)} are empty.`,
    '',
    `Exact-title cases (an acceptable candidate's title equals the query): ${exact.size}; worse after reranking: **${exactWorse.length}**.`,
    '',
    `### Improved (${improved(before, after).length})`,
    ...improved(before, after).map(fmt),
    '',
    `### Worse (${worsened(before, after).length})`,
    ...worsened(before, after).map(fmt),
    '',
  );
  mkdirSync(fileURLToPath(new URL('../../../docs/eval/', import.meta.url)), { recursive: true });
  writeFileSync(REPORT, lines.join('\n'));
  expect(cases.length).toBeGreaterThan(0);
});
