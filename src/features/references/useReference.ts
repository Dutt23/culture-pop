import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useRepositories } from '../../app/useRepositories';
import { isLarge, rememberSize, wasLarge, WORKER_FROM_CARDS } from '../../data/scale';
import { relatedReferences, type RelatedReferences } from '../../domain/related';
import type { Interpretation, Reference, Source } from '../../domain/types';
import { getSearchClient } from '../../services/search/searchClient';

export interface ReferenceDetail extends RelatedReferences {
  reference: Reference;
  interpretations: Interpretation[];
  sources: Source[];
}

const NO_RELATED: RelatedReferences = { otherMeanings: [], groups: [] };

/**
 * EXPERIMENTAL (D69): related cards from the search worker, which already holds a big library, so
 * the page never reads a big library itself. `undefined` until the worker answers for this card.
 */
function useRelatedFromWorker(id: string, enabled: boolean): RelatedReferences | undefined {
  const { references } = useRepositories();
  const [related, setRelated] = useState<{ id: string; value: RelatedReferences }>();
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const client = getSearchClient(references);
    // Not in the worker's copy yet (a result saved a moment ago): no related cards, not a wait.
    const ask = () =>
      void client
        .related(id)
        .then((value) => current && setRelated({ id, value: value ?? NO_RELATED }))
        .catch(() => current && setRelated({ id, value: NO_RELATED }));
    ask();
    const unsubscribe = client.subscribe(ask);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [references, id, enabled]);
  // Never hand back another card's related cards while this one's loads.
  return related?.id === id ? related.value : undefined;
}

/** `undefined` while loading, `null` when the reference does not exist. */
export function useReference(id: string): ReferenceDetail | null | undefined {
  const { references, retrieval } = useRepositories();
  const base = useLiveQuery(async () => {
    // Small last time (every reader today): the library is read with the card, as before D69, and
    // counted alongside, so there's no extra round trip. A big one is never read here.
    const small = !wasLarge('references', WORKER_FROM_CARDS);
    const [size, reference, interpretations, library] = await Promise.all([
      references.count(),
      references.getById(id),
      references.getInterpretations(id),
      small ? Promise.all([references.getAll(), references.getAllAliases()]) : undefined,
    ]);
    rememberSize('references', size);
    if (!reference) return null;
    // The reference's citations plus any an interpretation cites on its own.
    const sources = await retrieval.getSources([
      ...new Set([...reference.sourceIds, ...interpretations.flatMap((i) => i.sourceIds)]),
    ]);
    const large = isLarge(size, WORKER_FROM_CARDS);
    const related =
      library && !large ? relatedReferences(reference, library[0], library[1]) : undefined;
    return { reference, interpretations, sources, related, large };
  }, [references, retrieval, id]);
  const fromWorker = useRelatedFromWorker(id, base?.large === true);
  if (!base) return base;
  // The page appears whole, as before: card and related cards together, never a late jump.
  const shown = base.related ?? fromWorker;
  if (!shown) return undefined;
  const { reference, interpretations, sources } = base;
  return { reference, interpretations, sources, ...shown };
}
