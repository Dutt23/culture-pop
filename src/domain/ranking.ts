import { compareReferences, groupBy } from './collections';
import { fuzzyMatches } from './miniSearchExtras';
import { normalizePhrase, tokenize } from './normalize';
import type { Alias, Reference } from './types';

export type MatchKind =
  | 'exact_title'
  | 'exact_alias'
  | 'title_prefix'
  | 'alias_prefix'
  | 'partial'
  /** A known line said somewhere inside a longer text, such as a pasted message. */
  | 'in_message'
  /** Found only by typo-tolerant search (`miniSearchExtras.ts`). Never resolves a query by itself. */
  | 'typo'
  /** Found only by a sound-alike code. Never resolves a query by itself. */
  | 'sound';

export const MATCH_RANK: Readonly<Record<MatchKind, number>> = {
  exact_title: 0,
  exact_alias: 1,
  title_prefix: 2,
  alias_prefix: 3,
  partial: 4,
  in_message: 5,
  typo: 6,
  sound: 7,
};

/** More words than this reads as a pasted message rather than a search. */
const MESSAGE_MIN_WORDS = 8;

export function looksLikeMessage(query: string): boolean {
  return tokenize(normalizePhrase(query)).length > MESSAGE_MIN_WORDS;
}

/** A one-word line shorter than this ("snap", "groot") is too common to spot inside a message. */
const MIN_SINGLE_WORD_IN_MESSAGE = 6;

/** Whether `phrase` appears in `text` as whole words (both already normalized). */
function saidIn(text: string, phrase: string): boolean {
  if (!phrase.includes(' ') && phrase.length < MIN_SINGLE_WORD_IN_MESSAGE) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

/** Matches that suggest, but never settle, what the user meant (see `needsRetrieval`). */
export function isFuzzyMatch(match: RankedMatch): boolean {
  return match.kind === 'typo' || match.kind === 'sound';
}

export interface RankedMatch {
  reference: Reference;
  kind: MatchKind;
  /** Display text of the title or alias that matched. */
  matchedPhrase: string;
  /**
   * A search word only starts a longer word here ("no cap" in "No capes!"). Still listed, but like
   * a typo it suggests rather than settles the search (see `needsRetrieval`).
   */
  partialWord?: true;
}

function tokensMatch(queryTokens: readonly string[], phrases: readonly string[]): boolean {
  const candidateTokens = phrases.flatMap(tokenize);
  return queryTokens.every((q) => candidateTokens.some((t) => t.startsWith(q)));
}

type Classified = Pick<RankedMatch, 'kind' | 'matchedPhrase' | 'partialWord'>;

/** Every search word appears whole in the phrases (both already normalized). */
function wholeWords(query: string, phrases: readonly string[]): boolean {
  const words = new Set(phrases.flatMap(tokenize));
  return tokenize(query).every((q) => words.has(q));
}

/** Prefix and partial matches are flagged when a search word is only part of a longer word. */
function classify(
  query: string,
  reference: Reference,
  aliases: readonly Alias[],
): Classified | null {
  const match = classifyKind(query, reference, aliases);
  if (!match || !['title_prefix', 'alias_prefix', 'partial'].includes(match.kind)) return match;
  return wholeWords(query, matchedPhrases(query, match, reference, aliases))
    ? match
    : { ...match, partialWord: true };
}

/** The normalized phrase(s) a prefix or partial match came from, so other aliases can't vouch for it. */
function matchedPhrases(
  query: string,
  match: Classified,
  reference: Reference,
  aliases: readonly Alias[],
): string[] {
  const title = reference.normalizedTitle;
  if (match.kind === 'title_prefix') return [title];
  const alias = aliases.find((a) => a.phrase === match.matchedPhrase);
  if (alias && match.matchedPhrase !== reference.title) return [alias.normalizedPhrase];
  // A partial on the title alone, or else words spread across the title and its aliases.
  return title.includes(query) || tokensMatch(tokenize(query), [title])
    ? [title]
    : [title, ...aliases.map((a) => a.normalizedPhrase)];
}

function classifyKind(
  query: string,
  reference: Reference,
  aliases: readonly Alias[],
): Classified | null {
  if (reference.normalizedTitle === query)
    return { kind: 'exact_title', matchedPhrase: reference.title };
  const exactAlias = aliases.find((a) => a.normalizedPhrase === query);
  if (exactAlias) return { kind: 'exact_alias', matchedPhrase: exactAlias.phrase };
  if (reference.normalizedTitle.startsWith(query)) {
    return { kind: 'title_prefix', matchedPhrase: reference.title };
  }
  const prefixAlias = aliases.find((a) => a.normalizedPhrase.startsWith(query));
  if (prefixAlias) return { kind: 'alias_prefix', matchedPhrase: prefixAlias.phrase };

  const queryTokens = tokenize(query);
  const partialOn = (phrase: string) =>
    phrase.includes(query) || tokensMatch(queryTokens, [phrase]);
  if (partialOn(reference.normalizedTitle)) {
    return { kind: 'partial', matchedPhrase: reference.title };
  }
  const partialAlias = aliases.find((a) => partialOn(a.normalizedPhrase));
  if (partialAlias) return { kind: 'partial', matchedPhrase: partialAlias.phrase };
  // Tokens spread across the title and several aliases still count as one reference match.
  const phrases = [reference.normalizedTitle, ...aliases.map((a) => a.normalizedPhrase)];
  if (tokensMatch(queryTokens, phrases)) return { kind: 'partial', matchedPhrase: reference.title };
  if (saidIn(query, reference.normalizedTitle)) {
    return { kind: 'in_message', matchedPhrase: reference.title };
  }
  const saidAlias = aliases.find((a) => saidIn(query, a.normalizedPhrase));
  if (saidAlias) return { kind: 'in_message', matchedPhrase: saidAlias.phrase };
  return null;
}

/**
 * The deterministic tiers alone: exact title > exact alias > title prefix > alias prefix >
 * partial > said inside the text. Never drops or auto-selects among equal matches: callers decide how to present ties
 * (see `isAmbiguous`).
 */
export function rankByTiers(
  query: string,
  references: readonly Reference[],
  aliases: readonly Alias[],
): RankedMatch[] {
  // shortcut: full scan of an in-memory list, fine for hundreds of records; switch to Dexie index queries when the library grows past a few thousand.
  const normalizedQuery = normalizePhrase(query);
  if (!normalizedQuery) return [];
  const aliasesByReference = groupBy(aliases, (a) => a.referenceId);

  return references
    .flatMap((reference) => {
      const match = classify(
        normalizedQuery,
        reference,
        aliasesByReference.get(reference.id) ?? [],
      );
      return match ? [{ reference, ...match }] : [];
    })
    .sort(
      (a, b) =>
        MATCH_RANK[a.kind] - MATCH_RANK[b.kind] || compareReferences(a.reference, b.reference),
    );
}

/**
 * What search shows: the tiers first, then, after them, references that match only within a typo
 * (`miniSearchExtras.ts`). Adopted after the MiniSearch trial; exact matches keep their order.
 */
export function rankReferences(
  query: string,
  references: readonly Reference[],
  aliases: readonly Alias[],
): RankedMatch[] {
  const tiers = rankByTiers(query, references, aliases);
  // Typo guesses across a whole message are noise, and slow on long text.
  if (looksLikeMessage(query)) return tiers;
  const found = new Set(tiers.map((m) => m.reference.id));
  return [...tiers, ...fuzzyMatches(query, references, aliases, found)];
}

export function isExactMatch(match: RankedMatch): boolean {
  return match.kind === 'exact_title' || match.kind === 'exact_alias';
}

/** True when more than one reference matches the query exactly. */
export function isAmbiguous(matches: readonly RankedMatch[]): boolean {
  return matches.filter(isExactMatch).length > 1;
}
