import type { Category, ExternalLink, PresentIn, ReferenceKind, Source } from '../../domain/types';

export type ProviderId = 'wikipedia' | 'wikidata' | 'wiktionary' | 'wikiquote' | 'tvmaze';

export type RetrievalFailure =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'blocked'
  | 'http_error'
  | 'bad_response'
  | 'aborted';

export class RetrievalError extends Error {
  constructor(
    readonly failure: RetrievalFailure,
    message: string,
  ) {
    super(message);
    this.name = 'RetrievalError';
  }
}

/** An exact page on a community site, built from a Wikidata external ID. Tap-only, never fetched. */
export type { ExternalLink };

/**
 * How a candidate relates to the query, taken only from what its source says: the work itself
 * (Wikidata type, TVmaze), a page that quotes the phrase (Wikiquote), a dictionary sense
 * (Wiktionary), or any other page the search found (a person, an event, a still-unclassified hit).
 */
export type CandidateRole = 'work' | 'quoted_in' | 'definition' | 'topic';

/** One possible meaning found online. Evidence only: never an explanation, never cache-eligible. */
export interface RetrievedCandidate {
  /** Stable reference ID: `wd:Q83495`, `enwiki:12345` or `enwiktionary:hakuna matata`. */
  id: string;
  title: string;
  kind: ReferenceKind;
  category: Category;
  year?: number;
  yearSourceId?: string;
  /** Creators and first appearance, as Wikidata states them; present only when Wikidata is cited. */
  creators?: string[];
  firstAppearance?: string;
  /** Works Wikidata says it appears in (P1441), at most three; present only when Wikidata is cited. */
  presentIn?: PresentIn[];
  /** Works Wikidata says it was inspired by (P941), at most three; present only when Wikidata is cited. */
  inspiredBy?: PresentIn[];
  /** True while Wikidata hasn't answered yet: type and year may still change. */
  classifying: boolean;
  role: CandidateRole;
  /** Set when a fallback search, not the plain one, found this candidate (see `rewrite.ts`). */
  via?: RewriteKind;
  sources: Source[];
  externalLinks: ExternalLink[];
}

/**
 * The fallbacks that run only when the plain search misses (docs/SEARCH_RANKING.md, D43):
 * Wikipedia's "did you mean", and the first words of a long query. (An unquoted Wikiquote search was
 * tried and left out: it changed no result.)
 */
export type RewriteKind = 'suggestion' | 'shorter_phrase';

/** What a fallback searched for, so the page can say so. */
export interface Rewrite {
  kind: RewriteKind;
  /** The text searched. */
  text: string;
}

export interface ProviderOutcome {
  provider: ProviderId;
  status: 'pending' | 'ok' | 'empty' | 'failed' | 'skipped';
  failure?: RetrievalFailure;
}

export interface RetrievalResult {
  candidates: RetrievedCandidate[];
  outcomes: ProviderOutcome[];
  /** Present once a fallback search has been chosen; its candidates carry the same `via`. */
  rewrite?: Rewrite;
  /**
   * What was searched when it is not what the user typed: a question with its question words
   * dropped ("ferrari fans depressed" for "why are ferrari fans depressed").
   */
  searched?: string;
}

export type GetJson = (url: string, signal?: AbortSignal) => Promise<unknown>;
