import { normalizePhrase, tokenize } from '../../domain/normalize';
import { LEADING_FILLER } from './community';
import { titleWords } from './rerank';
import type { RetrievedCandidate, Rewrite, RewriteKind } from './types';

/**
 * Query rewriting without AI (D43). Two fallbacks, each tried only when the plain search misses:
 * 1. suggestion: Wikipedia's own "did you mean" (asked for in the first request, so it is free to learn);
 * 2. shorter phrase: the first words of a long query, since dialogue usually starts with a name.
 */

/** "Babu bhaiya" is the name; the rest of the line is what people misremember. */
const SHORTER_PHRASE_WORDS = 2;
/** Shorter phrases are only worth a request for lines long enough to start with a name. */
const MIN_WORDS_FOR_SHORTER = 4;

/**
 * The one rule for "miss": no candidate is named by the query. A candidate counts when its page
 * title (disambiguator removed) holds the query's words in order, so it equals or contains the
 * query ("Hera Pheri (2000 film)" for "hera pheri"), or when it is a Wiktionary entry, which is
 * looked up by the exact query. A list of pages that merely come near the query ("Hemlata" for a
 * line from a film) is a miss.
 */
export function isMiss(query: string, candidates: readonly RetrievedCandidate[]): boolean {
  const words = tokenize(normalizePhrase(query));
  if (words.length === 0) return false;
  const wanted = ` ${words.join(' ')} `;
  return !candidates.some((c) => c.role === 'definition' || ` ${titleWords(c)} `.includes(wanted));
}

/**
 * The first words of a long query, after leading question and filler words are skipped; undefined
 * when the query is too short to cut or fewer than two meaningful words remain.
 */
export function shorterPhrase(query: string, words = SHORTER_PHRASE_WORDS): string | undefined {
  const all = tokenize(normalizePhrase(query));
  if (all.length < MIN_WORDS_FOR_SHORTER) return undefined;
  const start = all.findIndex((word) => !LEADING_FILLER.has(word));
  const meaningful = start < 0 ? [] : all.slice(start);
  return meaningful.length >= SHORTER_PHRASE_WORDS ? meaningful.slice(0, words).join(' ') : undefined;
}

export interface RewriteOptions {
  /** Fallbacks allowed, in the order they are tried; only the first that applies runs. */
  order: readonly RewriteKind[];
  shorterWords?: number;
}

export const DEFAULT_REWRITE_OPTIONS: RewriteOptions = {
  order: ['suggestion', 'shorter_phrase'],
};

export interface RewriteInput {
  query: string;
  candidates: readonly RetrievedCandidate[];
  /** Wikipedia's "did you mean" from the plain search, if it gave one. */
  suggestion?: string;
}

/**
 * The single fallback to run, or undefined. One at most, so a miss costs at most two extra
 * requests: a Wikipedia search plus the Wikidata lookup for its hits.
 */
export function planRewrite(
  input: RewriteInput,
  options: RewriteOptions = DEFAULT_REWRITE_OPTIONS,
): Rewrite | undefined {
  if (!isMiss(input.query, input.candidates)) return undefined;
  const query = normalizePhrase(input.query);
  for (const kind of options.order) {
    if (kind === 'suggestion') {
      const text = input.suggestion?.trim();
      if (text && normalizePhrase(text) !== query) return { kind, text };
    } else {
      const text = shorterPhrase(input.query, options.shorterWords);
      if (text) return { kind, text };
    }
  }
  return undefined;
}
