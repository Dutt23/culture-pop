import { normalizePhrase, stripDisambiguator } from './normalize';
import { compareReferences } from './collections';
import type { Alias, Reference } from './types';

const MAX_SAME_ERA = 3;

export interface RelatedReferences {
  /**
   * Other references that share a phrase with this one (an alias, or the same title once a
   * disambiguator like "(2015 film)" is dropped): layered meanings shown side by side, never linked.
   */
  otherMeanings: Reference[];
  sameEra: Reference[];
}

export function relatedReferences(
  reference: Reference,
  all: readonly Reference[],
  aliases: readonly Alias[],
): RelatedReferences {
  const titleKey = (r: Reference) => normalizePhrase(stripDisambiguator(r.title));
  const ownPhrases = new Set([
    titleKey(reference),
    ...aliases.filter((a) => a.referenceId === reference.id).map((a) => a.normalizedPhrase),
  ]);
  const sharedIds = new Set([
    ...aliases
      .filter((a) => a.referenceId !== reference.id && ownPhrases.has(a.normalizedPhrase))
      .map((a) => a.referenceId),
    ...all.filter((r) => r.id !== reference.id && ownPhrases.has(titleKey(r))).map((r) => r.id),
  ]);
  const otherMeanings = all.filter((r) => sharedIds.has(r.id)).sort(compareReferences);
  const sameEra = reference.decade
    ? all
        .filter(
          (r) => r.id !== reference.id && r.decade === reference.decade && !sharedIds.has(r.id),
        )
        .sort(compareReferences)
        .slice(0, MAX_SAME_ERA)
    : [];
  return { otherMeanings, sameEra };
}
