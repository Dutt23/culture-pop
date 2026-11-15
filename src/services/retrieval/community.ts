import { externalSearchLinks, type ExternalSearchLink } from '../../domain/externalSearch';
import { normalizePhrase, tokenize } from '../../domain/normalize';
import type { ReferenceKind } from '../../domain/types';
import type { RetrievedCandidate } from './types';

/** Kinds that explain a phrase. Works, people and "other" pages don't. */
const PHRASE_KINDS: ReadonlySet<ReferenceKind> = new Set(['phrase', 'quote', 'meme']);
const MIN_PHRASE_WORDS = 3;
/** Short words that turn up in slang and memes far more than in titles; deliberately small. */
const SLANG_WORDS: ReadonlySet<string> = new Set([
  'ok', 'me', 'u', 'ur', 'im', 'bruh', 'lol', 'sus', 'cap', 'vibe', 'vibes', 'af', 'fr', 'ngl',
  'tbh', 'rizz', 'yeet', 'stan', 'simp', 'boomer', 'karen', 'bestie', 'slay', 'lowkey', 'highkey',
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
 * Owner-approved fallback (D34): with no curated answer, point to where people discuss slang and
 * memes when online search found nothing, or found only works and pages about people while the
 * query reads like a phrase ("catch me outside" finds the song, not the meme).
 */
export function suggestCommunityLinks(
  query: string,
  candidates: readonly RetrievedCandidate[],
): boolean {
  if (candidates.length === 0) return true;
  return looksLikePhrase(query) && !candidates.some((c) => PHRASE_KINDS.has(c.kind));
}

/** The meme and slang search links, from the shared templates. */
export function communitySearchLinks(query: string): ExternalSearchLink[] {
  return externalSearchLinks(query)
    .flatMap((group) => group.links)
    .filter((link) => COMMUNITY_SITES.has(link.site));
}
