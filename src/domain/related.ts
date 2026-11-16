import { normalizePhrase, stripDisambiguator } from './normalize';
import { compareReferences } from './collections';
import { eraOf } from './discovery';
import { distinctWorks, ERA_LABEL } from './labels';
import type { Alias, Reference } from './types';

const MAX_PER_GROUP = 3;
// Keeps the page short: up to three works, two creators, one era.
const MAX_GROUPS = { work: 3, creator: 2, era: 1 } as const;

export interface RelatedGroup {
  kind: 'work' | 'creator' | 'era';
  /** Why these appear, ready to show as a title: "Also in Fantastic Four". */
  label: string;
  references: Reference[];
}

export interface RelatedReferences {
  /**
   * Other references that share a phrase with this one (an alias, or the same title once a
   * disambiguator like "(2015 film)" is dropped): layered meanings shown side by side, never linked.
   */
  otherMeanings: Reference[];
  /** Work, then creator, then era; a reference is listed only in the first group it fits. */
  groups: RelatedGroup[];
}

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

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
  // Every meaning of the same phrase shows, explained or not ("point break": the films and the
  // dictionary sense side by side). Reasoned links only offer explained ones: an unexplained online
  // result would open to nothing but quoted sources.
  const otherMeanings = all.filter((r) => sharedIds.has(r.id)).sort(compareReferences);
  const candidates = all
    .filter(
      (r) => r.id !== reference.id && r.editorialState !== 'retrieved' && !sharedIds.has(r.id),
    )
    .sort(compareReferences);
  const taken = new Set<string>();
  const groupCount = { work: 0, creator: 0, era: 0 };
  const group = (
    kind: RelatedGroup['kind'],
    label: string,
    fits: (r: Reference) => boolean,
  ): RelatedGroup[] => {
    if (groupCount[kind] >= MAX_GROUPS[kind]) return [];
    const references = candidates
      .filter((r) => !taken.has(r.id) && fits(r))
      .slice(0, MAX_PER_GROUP);
    if (references.length === 0) return [];
    references.forEach((r) => taken.add(r.id));
    groupCount[kind] += 1;
    return [{ kind, label, references }];
  };

  const worksOf = (r: Reference) => [...(r.presentIn ?? []), ...(r.inspiredBy ?? [])];
  // The heading is this reference's own relation to the work; matching looks at both relations.
  const workGroups = distinctWorks(worksOf(reference)).flatMap((work) =>
    group(
      'work',
      `Also ${reference.presentIn?.includes(work) ? 'in' : 'inspired by'} ${work.label}`,
      (r) => worksOf(r).some((w) => w.qid === work.qid || sameText(w.label, work.label)),
    ),
  );
  const creatorGroups = (reference.creators ?? []).flatMap((creator) =>
    group('creator', `Also by ${creator}`, (r) =>
      (r.creators ?? []).some((c) => sameText(c, creator)),
    ),
  );
  const era = eraOf(reference);
  const eraGroups =
    era === 'timeless'
      ? []
      : group(
          'era',
          era === 'earlier' ? 'More from before 1990' : `More from the ${ERA_LABEL[era]}`,
          (r) => eraOf(r) === era,
        );

  return { otherMeanings, groups: [...workGroups, ...creatorGroups, ...eraGroups] };
}
