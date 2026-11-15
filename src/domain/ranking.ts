import { compareStrings, groupBy } from './collections';
import { normalizePhrase, tokenize } from './normalize';
import type { Alias, Reference } from './types';

export type MatchKind = 'exact_title' | 'exact_alias' | 'title_prefix' | 'alias_prefix' | 'partial';

export const MATCH_RANK: Readonly<Record<MatchKind, number>> = {
  exact_title: 0,
  exact_alias: 1,
  title_prefix: 2,
  alias_prefix: 3,
  partial: 4,
};

export interface RankedMatch {
  reference: Reference;
  kind: MatchKind;
  /** Display text of the title or alias that matched. */
  matchedPhrase: string;
}

/** Deterministic tie-break: normalized title, then ID. Locale-independent on purpose. */
export function compareReferences(a: Reference, b: Reference): number {
  return compareStrings(a.normalizedTitle, b.normalizedTitle) || compareStrings(a.id, b.id);
}

function tokensMatch(queryTokens: readonly string[], phrases: readonly string[]): boolean {
  const candidateTokens = phrases.flatMap(tokenize);
  return queryTokens.every((q) => candidateTokens.some((t) => t.startsWith(q)));
}

function classify(
  query: string,
  reference: Reference,
  aliases: readonly Alias[],
): { kind: MatchKind; matchedPhrase: string } | null {
  if (reference.normalizedTitle === query) return { kind: 'exact_title', matchedPhrase: reference.title };
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
  return null;
}

/**
 * Ranks every matching reference. Never drops or auto-selects among equal matches:
 * callers decide how to present ties (see `isAmbiguous`).
 */
export function rankReferences(
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
      const match = classify(normalizedQuery, reference, aliasesByReference.get(reference.id) ?? []);
      return match ? [{ reference, ...match }] : [];
    })
    .sort(
      (a, b) => MATCH_RANK[a.kind] - MATCH_RANK[b.kind] || compareReferences(a.reference, b.reference),
    );
}

export function isExactMatch(match: RankedMatch): boolean {
  return match.kind === 'exact_title' || match.kind === 'exact_alias';
}

/** True when more than one reference matches the query exactly. */
export function isAmbiguous(matches: readonly RankedMatch[]): boolean {
  return matches.filter(isExactMatch).length > 1;
}
