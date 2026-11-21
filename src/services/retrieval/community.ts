import { externalSearchLinks, type ExternalSearchLink } from '../../domain/externalSearch';
import { normalizePhrase, tokenize } from '../../domain/normalize';
import type { ReferenceKind } from '../../domain/types';
import type { RetrievedCandidate } from './types';

/** Kinds that explain a phrase. Works, people and "other" pages don't. */
const PHRASE_KINDS: ReadonlySet<ReferenceKind> = new Set(['phrase', 'quote', 'meme']);
const MIN_PHRASE_WORDS = 3;
/** Short words that turn up in slang and memes far more than in titles; deliberately small. */
const SLANG_WORDS: ReadonlySet<string> = new Set([
  'ok',
  'me',
  'u',
  'ur',
  'im',
  'bruh',
  'lol',
  'sus',
  'cap',
  'vibe',
  'vibes',
  'af',
  'fr',
  'ngl',
  'tbh',
  'rizz',
  'yeet',
  'stan',
  'simp',
  'boomer',
  'karen',
  'bestie',
  'slay',
  'lowkey',
  'highkey',
]);
const COMMUNITY_SITES: ReadonlySet<string> = new Set([
  'Know Your Meme',
  'Urban Dictionary',
  'Reddit',
]);

/** Three or more words, or a word that is mostly slang. */
export function looksLikePhrase(query: string): boolean {
  const words = tokenize(normalizePhrase(query));
  return words.length >= MIN_PHRASE_WORDS || words.some((word) => SLANG_WORDS.has(word));
}

/**
 * Question and filler words that start a sentence but name nothing: skipped before searching for a
 * subject, or for the start of a long query.
 */
export const LEADING_FILLER: ReadonlySet<string> = new Set([
  'why',
  'what',
  'who',
  'whom',
  'whose',
  'how',
  'when',
  'where',
  'which',
  'is',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'can',
  'the',
  'a',
  'an',
  'so',
]);
const QUESTION_WORDS: ReadonlySet<string> = new Set([
  ...['why', 'what', 'how', 'who', 'whom', 'whose', 'when', 'where', 'which'],
  ...['is', 'are', 'do', 'does', 'did', 'can', 'should', 'would', 'could', 'will'],
]);
/**
 * A sentence addressed to someone ("how you doin", "are you ready", "can you play...") is a phrase
 * or a quote, not a question about a topic, so it is never question-style.
 */
const ADDRESSED_TO: ReadonlySet<string> = new Set([
  ...['you', 'u', 'ya', 'i', 'we', 'he', 'she', 'it', 'they', 'me', 'my', 'your', 'our'],
]);
const MIN_SUBJECT_WORDS = 2;

/**
 * What a question-style query is about, with its question and filler words dropped, or undefined
 * when it is not question-style. One rule: a leading question word (why, what, how, who, is, are,
 * do, does...) or a trailing "?", and a subject of at least two words that does not start by
 * addressing someone. "why are ferrari fans depressed" is about "ferrari fans depressed";
 * "what's up doc" (the quote), "how you doin" and "what is the matrix" (a lookup) are not questions.
 */
export function questionSubject(query: string): string | undefined {
  const words = tokenize(normalizePhrase(query));
  const ranking =
    words.length >= 3 &&
    /^(biggest|worst|best|strongest|deadliest|most|least|top)\b/i.test(query.trim());
  if (!ranking && !QUESTION_WORDS.has(words[0] ?? '') && !query.trim().endsWith('?'))
    return undefined;
  const start = words.findIndex((word) => !LEADING_FILLER.has(word));
  const subject = start < 0 ? [] : words.slice(start);
  if (subject.length < MIN_SUBJECT_WORDS || ADDRESSED_TO.has(subject[0] as string))
    return undefined;
  return subject.join(' ');
}

export const looksLikeQuestion = (query: string): boolean => questionSubject(query) !== undefined;

/** Words too small to say what a page is about; a title sharing only these shares nothing. */
const SMALL_WORDS: ReadonlySet<string> = new Set([
  ...['of', 'and', 'for', 'with', 'from', 'that', 'this', 'they', 'them', 'not', 'but', 'all'],
]);

/** Not a question word, article or small English joining word ("the", "of", "with"). */
export const isContentWord = (word: string): boolean =>
  !LEADING_FILLER.has(word) && !SMALL_WORDS.has(word);

/** A word that says something: a content word of three letters or more. */
export const isMeaningfulWord = (word: string): boolean => word.length >= 3 && isContentWord(word);

/** The words of a question's subject that say something. */
function meaningfulWords(query: string): string[] {
  return tokenize(normalizePhrase(questionSubject(query) ?? query)).filter(isMeaningfulWord);
}

/**
 * For a question-style query, a hit that is only a related page: not a work, and not a phrase,
 * quote, meme or definition, and whose title shares no meaningful word with the question
 * ("Pink Floyd" for "why are ferrari fans depressed"; "Scuderia Ferrari" shares "ferrari").
 */
export function isWeakHit(query: string, candidate: RetrievedCandidate): boolean {
  // A character is what a question about fiction is after ("Thanos" for "who committed the worst
  // genocides"), even when its name shares no word with the question.
  if (candidate.role !== 'topic' || PHRASE_KINDS.has(candidate.kind)) return false;
  if (candidate.kind === 'character') return false;
  const title = new Set(tokenize(normalizePhrase(candidate.title)));
  return !meaningfulWords(query).some((word) => title.has(word));
}

/**
 * A page that is not pop culture: nothing Wikidata could class as a work, character, phrase, quote
 * or meme (category and kind both "other"), such as a real-world history page. Wikiquote hits and
 * Wiktionary entries have a kind, so they never count. A page Wikidata hasn't answered for yet
 * might still turn out to be a work, so it doesn't count either.
 */
export const isOffTopicForQuestion = (candidate: RetrievedCandidate): boolean =>
  candidate.category === 'other' && candidate.kind === 'other' && !candidate.classifying;

/**
 * What a question-style query shows and what is folded under "Other pages found": related pages
 * that share nothing with the question, and, while questions lean to stories (`stories`), pages that
 * are not pop culture. Any other query folds nothing. One rule for the results list and for deciding
 * that nothing visible is left.
 */
export function splitFolded<T extends RetrievedCandidate>(
  query: string,
  candidates: readonly T[],
  stories: boolean,
): { shown: T[]; folded: T[] } {
  const isFolded = (candidate: T) =>
    looksLikeQuestion(query) &&
    (isWeakHit(query, candidate) || (stories && isOffTopicForQuestion(candidate)));
  return {
    shown: candidates.filter((candidate) => !isFolded(candidate)),
    folded: candidates.filter(isFolded),
  };
}

/** True when a candidate explains the phrase itself: a meme, quote, phrase or dictionary entry. */
export const explainsQuery = (candidate: RetrievedCandidate): boolean =>
  PHRASE_KINDS.has(candidate.kind) ||
  candidate.role === 'definition' ||
  candidate.role === 'quoted_in';

/**
 * Owner-approved fallback (D34): with no curated answer, point to where people discuss slang and
 * memes when online search found nothing, or found only works and pages about people while the
 * query reads like a phrase ("catch me outside" finds the song, not the meme).
 */
export function suggestCommunityLinks(
  query: string,
  candidates: readonly RetrievedCandidate[],
): boolean {
  if (candidates.length === 0) return true;
  // A question-style query (a running joke, a stereotype) is explained by communities, not by
  // encyclopedias, unless something found online explains it.
  if (looksLikeQuestion(query)) return !candidates.some(explainsQuery);
  return looksLikePhrase(query) && !candidates.some((c) => PHRASE_KINDS.has(c.kind));
}

/** The meme and slang search links, from the shared templates. */
export function communitySearchLinks(query: string): ExternalSearchLink[] {
  return externalSearchLinks(query)
    .flatMap((group) => group.links)
    .filter((link) => COMMUNITY_SITES.has(link.site));
}
