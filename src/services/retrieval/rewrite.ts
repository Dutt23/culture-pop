import { normalizePhrase, tokenize } from '../../domain/normalize';
import { isContentWord, LEADING_FILLER } from './community';
import { titleWords } from './rerank';
import type { RetrievedCandidate, Rewrite, RewriteKind } from './types';

/**
 * Query rewriting without AI (D43). Three fallbacks, each tried only when the plain search misses:
 * 1. topic: what a request asks about ("gundam" for "give me history of gundam");
 * 2. suggestion: Wikipedia's own "did you mean" (asked for in the first request, so it is free to learn);
 * 3. shorter phrase: the first words of a long query, since dialogue usually starts with a name.
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
 * when the query is too short to cut or the cut holds fewer than two meaningful words ("committed
 * the" from "who committed the worst genocides" is not worth a search).
 */
export function shorterPhrase(query: string, words = SHORTER_PHRASE_WORDS): string | undefined {
  const all = tokenize(normalizePhrase(query));
  if (all.length < MIN_WORDS_FOR_SHORTER) return undefined;
  const start = all.findIndex((word) => !LEADING_FILLER.has(word));
  const phrase = start < 0 ? [] : all.slice(start, start + words);
  // No length rule here: short Hinglish words ("ye kya") carry meaning; "the" and "of" don't.
  return phrase.filter(isContentWord).length >= SHORTER_PHRASE_WORDS ? phrase.join(' ') : undefined;
}

/** A request opener names nothing: "give me", "tell me about", "explain". */
const REQUEST_VERBS: ReadonlySet<string> = new Set(['give', 'tell', 'show', 'explain', 'describe']);
const REQUEST_FILLER: ReadonlySet<string> = new Set(['me', 'us', 'about', 'the', 'a', 'an']);
/** What is asked about a topic ("history of gundam"); dropped with its "of". */
const ASPECTS: ReadonlySet<string> = new Set([
  ...['history', 'origin', 'origins', 'meaning', 'story', 'lore', 'backstory', 'plot', 'summary'],
]);

/**
 * The topic of a request, or undefined when the query doesn't start with one: "give me history of
 * gundam" is about "gundam". Only a fallback, so a quote that starts the same way ("show me the
 * money") is still searched as typed first, and its own page stops this from running.
 */
export function requestTopic(query: string): string | undefined {
  const words = tokenize(normalizePhrase(query));
  if (!REQUEST_VERBS.has(words[0] ?? '')) return undefined;
  const skipFiller = (from: number) => {
    let at = from;
    while (REQUEST_FILLER.has(words[at] ?? '')) at++;
    return at;
  };
  let start = skipFiller(1);
  if (ASPECTS.has(words[start] ?? '') && words[start + 1] === 'of') start = skipFiller(start + 2);
  return start < words.length ? words.slice(start).join(' ') : undefined;
}

export interface RewriteOptions {
  /** Fallbacks allowed, in the order they are tried; only the first that applies runs. */
  order: readonly RewriteKind[];
  shorterWords?: number;
}

export const DEFAULT_REWRITE_OPTIONS: RewriteOptions = {
  order: ['topic', 'suggestion', 'shorter_phrase'],
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
    if (kind === 'topic') {
      const text = requestTopic(input.query);
      if (text) return { kind, text };
    } else if (kind === 'suggestion') {
      const text = input.suggestion?.trim();
      if (text && normalizePhrase(text) !== query) return { kind, text };
    } else {
      const text = shorterPhrase(input.query, options.shorterWords);
      if (text) return { kind, text };
    }
  }
  return undefined;
}
