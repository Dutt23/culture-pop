import { compareReferences } from './ranking';
import type { Alias, Reference } from './types';

const MAX_SAME_ERA = 3;

export interface RelatedReferences {
  /** Other references that share a phrase with this one — alternative meanings. */
  otherMeanings: Reference[];
  sameEra: Reference[];
}

export function relatedReferences(
  reference: Reference,
  all: readonly Reference[],
  aliases: readonly Alias[],
): RelatedReferences {
  const ownPhrases = new Set(
    aliases.filter((a) => a.referenceId === reference.id).map((a) => a.normalizedPhrase),
  );
  const sharedIds = new Set(
    aliases
      .filter((a) => a.referenceId !== reference.id && ownPhrases.has(a.normalizedPhrase))
      .map((a) => a.referenceId),
  );
  const otherMeanings = all.filter((r) => sharedIds.has(r.id)).sort(compareReferences);
  const sameEra = reference.decade
    ? all
        .filter((r) => r.id !== reference.id && r.decade === reference.decade && !sharedIds.has(r.id))
        .sort(compareReferences)
        .slice(0, MAX_SAME_ERA)
    : [];
  return { otherMeanings, sameEra };
}
