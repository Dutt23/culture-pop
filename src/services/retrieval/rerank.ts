import { normalizePhrase, stripDisambiguator, tokenize } from '../../domain/normalize';
import { isWikipediaReference, isWikiquoteReference } from '../../domain/sources';
import type { RetrievedCandidate } from './types';

/**
 * Orders online candidates for the search page (docs/SEARCH_RANKING.md, "Reranker"). Pure and
 * deterministic. Wikipedia's own search order is already a good ranking, so the reranker keeps it
 * and corrects it with two general rules, each stated once; no popularity signal and no rule for any
 * single query. Candidates with equal scores keep their arrival order (Wikipedia's hits, then
 * Wikiquote's, then Wiktionary's).
 *
 * 1. Place: a Wikipedia hit scores `position` for being first, half of it for second, a third for
 *    third, and so on.
 * 2. Exact title: a title equal to the query, once a Wikipedia disambiguator is removed, adds a
 *    small `exactTitle` nudge. It reorders the lower hits; it can't lift one above Wikipedia's first.
 * 3. Dictionary: a Wiktionary entry is looked up by the exact query, so it is an exact-title match
 *    by construction. When no Wikipedia hit is named exactly like the query, it scores `dictionary`
 *    plus the exact-title nudge, which puts it first (ahead of "Chad (slang)" for "gigachad"). When
 *    a Wikipedia page is named exactly like the query ("Dune (2021 film)" for "dune"), the dictionary
 *    entry gets no bonus and keeps its arrival place after the hits.
 *
 * Word order, word closeness and "kind fit" (phrase or work kinds) were tried and left out: on the
 * tuning half they made results worse or no better (see the Reranker section of the doc).
 */
export interface RerankWeights {
  position: number;
  exactTitle: number;
  dictionary: number;
}

export const DEFAULT_WEIGHTS: RerankWeights = {
  position: 40,
  exactTitle: 10,
  dictionary: 40,
};

const isWikipediaHit = (candidate: RetrievedCandidate) => isWikipediaReference(candidate.id);

/** The words of the page's own title: no disambiguator, and Wikiquote's " on Wikiquote" label removed. */
export function titleWords(candidate: RetrievedCandidate): string {
  const page = isWikiquoteReference(candidate.id)
    ? (candidate.sources[0]?.title ?? candidate.title)
    : stripDisambiguator(candidate.title);
  return tokenize(normalizePhrase(page)).join(' ');
}

/** The candidate's own page title (not Wikiquote's label) equals the query, disambiguator aside. */
export const isExactTitle = (query: string, candidate: RetrievedCandidate) => {
  const words = titleWords(candidate);
  return words !== '' && words === tokenize(normalizePhrase(query)).join(' ');
};

/**
 * The score of one candidate for one query; higher ranks earlier. `wikipediaPlace` is 0 for
 * Wikipedia's first hit, 1 for its second, and so on; undefined for any other provider.
 * `exactPageFound` says some Wikipedia hit is named exactly like the query.
 */
export function scoreCandidate(
  query: string,
  candidate: RetrievedCandidate,
  wikipediaPlace?: number,
  exactPageFound = false,
  weights: RerankWeights = DEFAULT_WEIGHTS,
): number {
  if (candidate.role === 'definition') {
    return exactPageFound ? 0 : weights.dictionary + weights.exactTitle;
  }
  let score = wikipediaPlace === undefined ? 0 : weights.position / (wikipediaPlace + 1);
  if (isExactTitle(query, candidate)) score += weights.exactTitle;
  return score;
}

export interface ScoredCandidate {
  candidate: RetrievedCandidate;
  /** Position in the input, which is the tie-break. */
  index: number;
  score: number;
}

/** Every candidate with its score, in input order. */
export function scoreCandidates(
  query: string,
  candidates: readonly RetrievedCandidate[],
  weights: RerankWeights = DEFAULT_WEIGHTS,
): ScoredCandidate[] {
  const exactPageFound = candidates.some((c) => isWikipediaHit(c) && isExactTitle(query, c));
  // Each search keeps its own Wikipedia order: a fallback's first hit counts as a first hit, since
  // the plain search's hits are exactly what missed.
  const places = new Map<string, number>();
  return candidates.map((candidate, index) => {
    const group = candidate.via ?? 'plain';
    const place = isWikipediaHit(candidate) ? (places.get(group) ?? 0) : undefined;
    if (place !== undefined) places.set(group, place + 1);
    const score = scoreCandidate(query, candidate, place, exactPageFound, weights);
    return { candidate, index, score };
  });
}

/** A new list, best first; equal scores keep their arrival order. The input is not changed. */
export function rerankCandidates(
  query: string,
  candidates: readonly RetrievedCandidate[],
  weights: RerankWeights = DEFAULT_WEIGHTS,
): RetrievedCandidate[] {
  return scoreCandidates(query, candidates, weights)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ candidate }) => candidate);
}
