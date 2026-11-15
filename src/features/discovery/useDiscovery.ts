import { useLiveQuery } from 'dexie-react-hooks';
import { useRepositories } from '../../app/RepositoriesContext';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import type { Reference } from '../../domain/types';

export interface DiscoveryData {
  references: Reference[];
  summaries: Map<string, CardSummary>;
}

/** Discovery reads only the local library. No browsing activity is recorded. */
export function useDiscovery(): DiscoveryData | undefined {
  const { references } = useRepositories();
  return useLiveQuery(async () => {
    const [all, interpretations] = await Promise.all([
      references.getAll(),
      references.getAllInterpretations(),
    ]);
    return { references: all, summaries: summarizeByReference(interpretations) };
  }, [references]);
}
