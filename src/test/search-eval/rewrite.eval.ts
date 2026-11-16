/**
 * Offline comparison of the query-rewriting fallbacks (D43) over the captured lists. Never part of
 * `npm test`:
 *   npx vitest run --config vitest.eval.config.ts src/test/search-eval/rewrite.eval.ts
 * Needs snapshot/candidates.json (`live.eval.ts`) and snapshot/fallbacks.json (`fallbacks.eval.ts`,
 * then `fallbackQids.eval.ts`). Writes docs/eval/rewrite-offline.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { rerankCandidates, isExactTitle } from '../../services/retrieval/rerank';
import type { RetrievedCandidate, RewriteKind } from '../../services/retrieval/types';
import { loadFallbackSnapshot } from './fallbackSnapshot';
import type { EvalCase } from './queries';
import {
  capturedCases,
  loadSnapshot,
  scoreLists,
  summaryOf,
  worsened,
  improved,
} from './rerankEval';
import { meaningIds, scoringIds } from './report';
import { splitCases } from './split';

const REPORT = fileURLToPath(new URL('../../../docs/eval/rewrite-offline.md', import.meta.url));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const reranked = (query: string, candidates: RetrievedCandidate[]) =>
  rerankCandidates(query, candidates);

type Kind = RewriteKind;
type Order = readonly Kind[];
const CONFIGS: [string, Order][] = [
  ['no fallback', []],
  ['suggestion only', ['suggestion']],
  ['shorter phrase only', ['shorter_phrase']],
  ['suggestion, then shorter', ['suggestion', 'shorter_phrase']],
  ['shorter, then suggestion', ['shorter_phrase', 'suggestion']],
];

it('compares the fallbacks on the captured lists', () => {
  const main = loadSnapshot();
  const fb = loadFallbackSnapshot();
  const items = new Map<string, string>();
  for (const source of [main.wikiquoteQids, fb.wikiquoteQids ?? {}]) {
    for (const [page, qid] of Object.entries(source)) if (qid) items.set(page, qid);
  }
  // A case whose plain search failed in either capture is left out, as in the other reports.
  const cases = capturedCases(main).filter((c) => (fb.cases[c.id]?.failures.length ?? 0) === 0);
  const { tuning, heldOut } = splitCases(cases);
  const plainOf = (c: EvalCase) => fb.cases[c.id]?.primary ?? main.cases[c.id]?.candidates ?? [];
  const listFor = (order: Order) => (c: EvalCase) => {
    const captured = fb.cases[c.id];
    for (const kind of order) {
      const run = captured?.fallbacks[kind];
      if (run) return run.candidates;
    }
    return plainOf(c);
  };
  const run = (set: readonly EvalCase[], order: Order) =>
    scoreLists(items, set, reranked, listFor(order));
  const row = (label: string, set: readonly EvalCase[], order: Order) => {
    const s = summaryOf(run(set, order));
    const amb =
      s.ambiguityCoverage === null ? '–' : `${pct(s.ambiguityCoverage)} (${s.ambiguityCases})`;
    return `| ${label} | ${s.cases} | ${pct(s.recallAt5)} | ${s.mrrAt10.toFixed(3)} | ${pct(s.incorrectTopRate)} | ${pct(s.noResultRate)} | ${amb} |`;
  };
  const extraRequests = (order: Order) =>
    cases.reduce((sum, c) => {
      const captured = fb.cases[c.id];
      const kind = order.find((k) => captured?.fallbacks[k]);
      return sum + (kind ? (captured?.fallbacks[kind]?.extraRequests ?? 0) : 0);
    }, 0);
  const exact = new Set(
    cases
      .filter((c) => {
        const accepted = new Set(c.meanings.flatMap((m) => [...meaningIds(m, 'live')]));
        return plainOf(c).some(
          (cand) =>
            accepted.has(scoringIds([cand.id], items)[0] as string) && isExactTitle(c.query, cand),
        );
      })
      .map((c) => c.id),
  );
  const missed = cases.filter((c) => fb.cases[c.id] !== undefined).length;

  const lines = [
    '# Query rewriting, offline (captured lists)',
    '',
    `${cases.length} cases captured without a failing provider; ${missed} of them were misses by the rule in \`rewrite.ts\` (no candidate named by the query) and have fallback captures. The other ${cases.length - missed} are scored from their plain list. Everything is reranked by \`rerankCandidates\`. Fallback captured ${fb.capturedAt}. Same tuning / held-out split as the reranker.`,
    '',
    '| Config | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |',
    '|---|---|---|---|---|---|---|',
  ];
  const halves: [string, readonly EvalCase[]][] = [
    ['tuning', tuning],
    ['held-out', heldOut],
    ['full', cases],
  ];
  for (const [name, order] of CONFIGS) {
    for (const [half, set] of halves) lines.push(row(`${half}: ${name}`, set, order));
  }

  lines.push(
    '',
    '### Verdict per fallback (held-out half, and exact-title cases over the full set)',
    '',
    '| Fallback | Held-out MRR | Held-out Recall@5 | Exact-title cases worse | Extra requests (all cases) | Adopt |',
    '|---|---|---|---|---|---|',
  );
  const base = run(heldOut, []);
  const baseFull = run(cases, []);
  const baseMrr = summaryOf(base).mrrAt10;
  const baseRecall = summaryOf(base).recallAt5;
  const adopted: Kind[] = [];
  for (const kind of ['suggestion', 'shorter_phrase'] as const satisfies readonly Kind[]) {
    const held = summaryOf(run(heldOut, [kind]));
    const worse = worsened(baseFull, run(cases, [kind])).filter((c) => exact.has(c.id));
    const improves =
      held.mrrAt10 > baseMrr || (held.mrrAt10 === baseMrr && held.recallAt5 > baseRecall);
    const ok = improves && worse.length === 0;
    if (ok) adopted.push(kind);
    lines.push(
      `| ${kind} | ${baseMrr.toFixed(3)} to ${held.mrrAt10.toFixed(3)} | ${pct(baseRecall)} to ${pct(held.recallAt5)} | ${worse.length} of ${exact.size} | ${extraRequests([kind])} | ${ok ? 'yes' : 'no'} |`,
    );
  }
  lines.push(
    '',
    `Adopted by the rule (held-out improves, no exact-title case worse): ${adopted.join(', ') || 'none'}.`,
  );

  const chosen = (adopted.length > 0 ? CONFIGS[3]?.[1] : []) as Order;
  const finalOrder = chosen.filter((k) => adopted.includes(k));
  lines.push(
    '',
    `### Final order tried: ${finalOrder.join(', ') || '(none)'}`,
    '',
    '| Kind | n | Recall@5 | MRR@10 | Incorrect top |',
    '|---|---|---|---|---|',
  );
  const flags: [string, (c: EvalCase) => boolean][] = [
    ['misremembered', (c) => c.misremembered],
    ['indian', (c) => c.indian],
    ['ambiguous', (c) => c.ambiguous],
    ['all other', (c) => !c.misremembered && !c.indian && !c.ambiguous],
  ];
  for (const [name, has] of flags) {
    const set = cases.filter(has);
    const a = summaryOf(run(set, []));
    const b = summaryOf(run(set, finalOrder));
    lines.push(
      `| ${name} | ${set.length} | ${pct(a.recallAt5)} to ${pct(b.recallAt5)} | ${a.mrrAt10.toFixed(3)} to ${b.mrrAt10.toFixed(3)} | ${pct(a.incorrectTopRate)} to ${pct(b.incorrectTopRate)} |`,
    );
  }
  const before = run(cases, []);
  const after = run(cases, finalOrder);
  const fmt = (c: { id: string; query: string; before: number | null; after: number | null }) =>
    `- ${c.id} "${c.query}": rank ${c.before ?? 'none'} to ${c.after ?? 'none'}`;
  lines.push(
    '',
    `Extra requests with the final order: ${extraRequests(finalOrder)} over ${cases.length} searches (${(extraRequests(finalOrder) / cases.length).toFixed(2)} per search; ${(extraRequests(finalOrder) / Math.max(1, missed)).toFixed(2)} per missed search).`,
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
