import { useLiveQuery } from 'dexie-react-hooks';
import { useRepositories } from '../../app/RepositoriesContext';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import type { Reference } from '../../domain/types';

export interface DiscoveryData {
  references: Reference[];
  summaries: Map<string, CardSummary>;
}

/**
 * Discovery reads only the curated local library: cached online results are unexplained evidence,
 * not something to browse. No browsing activity is recorded.
 */
export function useDiscovery(): DiscoveryData | undefined {
  const { references } = useRepositories();
  return useLiveQuery(async () => {
    const [all, interpretations] = await Promise.all([
      references.getAll(),
      references.getAllInterpretations(),
    ]);
    return {
      references: all.filter((r) => r.editorialState !== 'retrieved'),
      summaries: summarizeByReference(interpretations),
    };
  }, [references]);
}
