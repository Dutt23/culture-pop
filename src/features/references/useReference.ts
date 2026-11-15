import { useLiveQuery } from 'dexie-react-hooks';
import { useRepositories } from '../../app/RepositoriesContext';
import { relatedReferences, type RelatedReferences } from '../../domain/related';
import type { Interpretation, Reference, Source } from '../../domain/types';

export interface ReferenceDetail extends RelatedReferences {
  reference: Reference;
  interpretations: Interpretation[];
  sources: Source[];
}

/** `undefined` while loading, `null` when the reference does not exist. */
export function useReference(id: string): ReferenceDetail | null | undefined {
  const { references, retrieval } = useRepositories();
  return useLiveQuery(async () => {
    const reference = await references.getById(id);
    if (!reference) return null;
    const [interpretations, all, aliases, sources] = await Promise.all([
      references.getInterpretations(id),
      references.getAll(),
      references.getAllAliases(),
      retrieval.getSources(reference.sourceIds),
    ]);
    return { reference, interpretations, sources, ...relatedReferences(reference, all, aliases) };
  }, [references, retrieval, id]);
}
