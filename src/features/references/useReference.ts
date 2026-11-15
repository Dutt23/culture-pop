import { useLiveQuery } from 'dexie-react-hooks';
import { useRepositories } from '../../app/RepositoriesContext';
import { relatedReferences, type RelatedReferences } from '../../domain/related';
import type { Interpretation, Reference } from '../../domain/types';

export interface ReferenceDetail extends RelatedReferences {
  reference: Reference;
  interpretations: Interpretation[];
}

/** `undefined` while loading, `null` when the reference does not exist. */
export function useReference(id: string): ReferenceDetail | null | undefined {
  const { references } = useRepositories();
  return useLiveQuery(async () => {
    const reference = await references.getById(id);
    if (!reference) return null;
    const [interpretations, all, aliases] = await Promise.all([
      references.getInterpretations(id),
      references.getAll(),
      references.getAllAliases(),
    ]);
    return { reference, interpretations, ...relatedReferences(reference, all, aliases) };
  }, [references, id]);
}
