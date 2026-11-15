import type { Category, ExternalLink, ReferenceKind, Source } from '../../domain/types';

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
  /** True while Wikidata hasn't answered yet: type and year may still change. */
  classifying: boolean;
  role: CandidateRole;
  sources: Source[];
  externalLinks: ExternalLink[];
}

export interface ProviderOutcome {
  provider: ProviderId;
  status: 'pending' | 'ok' | 'empty' | 'failed' | 'skipped';
  failure?: RetrievalFailure;
}

export interface RetrievalResult {
  candidates: RetrievedCandidate[];
  outcomes: ProviderOutcome[];
}

export type GetJson = (url: string, signal?: AbortSignal) => Promise<unknown>;
