/**
 * Pure search-evaluation metrics. Exact definitions: docs/SEARCH_RANKING.md, "Evaluation set".
 * Ranks are 1-based positions in the result list as shown to the user.
 */

export const RECALL_K = 5;
export const MRR_K = 10;

export interface CaseScore {
  /** Position of the first result matching any acceptable meaning; null when none does. */
  rank: number | null;
  /** The list was non-empty and its first result is not acceptable. */
  incorrectTop: boolean;
  noResults: boolean;
  /** Distinct meanings with at least one result in the top `RECALL_K`. */
  meaningsInTopK: number;
  /** Ambiguity is scored for this case: flagged ambiguous and ≥2 meanings have IDs. */
  ambiguityScored: boolean;
}

/**
 * `meanings` holds one ID set per distinct meaning, already narrowed to the IDs the system under
 * test can return (live or local). Empty sets are ignored.
 */
export function scoreCase(
  rankedIds: readonly string[],
  meanings: readonly ReadonlySet<string>[],
  ambiguous: boolean,
): CaseScore {
  const usable = meanings.filter((m) => m.size > 0);
  const matches = (id: string) => usable.some((m) => m.has(id));
  const index = rankedIds.findIndex(matches);
  const topK = rankedIds.slice(0, RECALL_K);
  return {
    rank: index < 0 ? null : index + 1,
    incorrectTop: rankedIds.length > 0 && !matches(rankedIds[0] as string),
    noResults: rankedIds.length === 0,
    meaningsInTopK: usable.filter((m) => topK.some((id) => m.has(id))).length,
    ambiguityScored: ambiguous && usable.length >= 2,
  };
}

export interface Summary {
  cases: number;
  recallAt5: number;
  mrrAt10: number;
  incorrectTopRate: number;
  noResultRate: number;
  ambiguityCases: number;
  /** Null when no case in the group has scorable ambiguity. */
  ambiguityCoverage: number | null;
}

function share(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

export function summarize(scores: readonly CaseScore[]): Summary {
  const n = scores.length;
  const ambiguity = scores.filter((s) => s.ambiguityScored);
  const reciprocal = scores.reduce(
    (sum, s) => sum + (s.rank !== null && s.rank <= MRR_K ? 1 / s.rank : 0),
    0,
  );
  return {
    cases: n,
    recallAt5: share(scores.filter((s) => s.rank !== null && s.rank <= RECALL_K).length, n),
    mrrAt10: share(reciprocal, n),
    incorrectTopRate: share(scores.filter((s) => s.incorrectTop).length, n),
    noResultRate: share(scores.filter((s) => s.noResults).length, n),
    ambiguityCases: ambiguity.length,
    ambiguityCoverage:
      ambiguity.length === 0
        ? null
        : share(ambiguity.filter((s) => s.meaningsInTopK >= 2).length, ambiguity.length),
  };
}

/** Nearest-rank percentile (p in 0–100) of an unsorted sample; NaN for an empty one. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] as number;
}

export interface LatencySummary {
  p50: number;
  p90: number;
  p95: number;
  max: number;
}

export function latencySummary(values: readonly number[]): LatencySummary {
  return {
    p50: percentile(values, 50),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    max: percentile(values, 100),
  };
}
