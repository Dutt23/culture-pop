import { isFuzzyMatch, MATCH_RANK, type RankedMatch } from './ranking';
import type { Interpretation } from './types';

/**
 * Whether an interpretation may resolve a lookup from the local cache alone (spec §4).
 * Viewing, selecting or favouriting never changes the result.
 */
export function isCacheEligible(
  interpretation: Interpretation,
  validSourceIds: ReadonlySet<string>,
): boolean {
  if (interpretation.provenance === 'seed_curated') return true;
  if (interpretation.provenance !== 'source_supported') return false;
  return (
    interpretation.evidence === 'supported' &&
    interpretation.sourceIds.length > 0 &&
    interpretation.sourceIds.every((id) => validSourceIds.has(id))
  );
}

/**
 * Spec §6 step 1–2: retrieval is needed unless a top-ranked match has at least one eligible
 * interpretation. Lower-ranked, ineligible candidates never trigger retrieval on their own.
 * Typo and sound-alike matches are guesses, so they never count: a query matched only that way
 * still goes online. A line found inside the text counts only in a pasted message (`isMessage`):
 * there it is the answer, and the message stays on the device. Inside a short search ("history of
 * the titanic sinking") it is only a suggestion, and the search still goes online.
 */
export function needsRetrieval(
  allMatches: readonly RankedMatch[],
  interpretationsByReference: ReadonlyMap<string, readonly Interpretation[]>,
  validSourceIds: ReadonlySet<string>,
  isMessage = false,
): boolean {
  const matches = allMatches.filter(
    (m) => !isFuzzyMatch(m) && (isMessage || m.kind !== 'in_message'),
  );
  if (matches.length === 0) return true;
  const bestRank = MATCH_RANK[matches[0].kind];
  return !matches
    .filter((m) => MATCH_RANK[m.kind] === bestRank)
    .some((m) =>
      (interpretationsByReference.get(m.reference.id) ?? []).some((i) =>
        isCacheEligible(i, validSourceIds),
      ),
    );
}
