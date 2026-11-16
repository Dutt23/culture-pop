import type { EvalCase } from './queries';

/**
 * Deterministic tuning / held-out split for reranker work (docs/SEARCH_RANKING.md, "Reranker").
 * Cases are grouped by base row (`Q3` and its variant `Q3-v` are one group, since they share an
 * answer and would leak into each other); groups are taken in file order and alternate: the 1st,
 * 3rd, 5th... group tunes, the 2nd, 4th, 6th... group is held out. Nothing random, so every run and
 * every machine gets the same halves.
 */
export function splitCases(cases: readonly EvalCase[]): {
  tuning: EvalCase[];
  heldOut: EvalCase[];
} {
  const groupOf = (c: EvalCase) => c.id.replace(/-v$/, '');
  const order: string[] = [];
  for (const c of cases) if (!order.includes(groupOf(c))) order.push(groupOf(c));
  const tuningGroups = new Set(order.filter((_, index) => index % 2 === 0));
  return {
    tuning: cases.filter((c) => tuningGroups.has(groupOf(c))),
    heldOut: cases.filter((c) => !tuningGroups.has(groupOf(c))),
  };
}
