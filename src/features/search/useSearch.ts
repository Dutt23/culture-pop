import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { groupBy } from '../../domain/collections';
import { needsRetrieval } from '../../domain/eligibility';
import { isAmbiguous, rankReferences, type RankedMatch } from '../../domain/ranking';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';

export interface SearchState {
  loading: boolean;
  matches: RankedMatch[];
  isAmbiguous: boolean;
  /** Phase 1 never acts on this beyond surfacing external links; it never fetches. */
  needsRetrieval: boolean;
  summaries: Map<string, CardSummary>;
}

/** Search input is ephemeral: nothing about the query is persisted. */
export function useSearch(query: string): SearchState {
  const { references } = useRepositories();
  const index = useLiveQuery(() => references.getSearchIndex(), [references]);

  return useMemo(() => {
    if (!index) {
      return {
        loading: true,
        matches: [],
        isAmbiguous: false,
        needsRetrieval: false,
        summaries: new Map(),
      };
    }
    const matches = rankReferences(query, index.references, index.aliases);
    const byReference = groupBy(index.interpretations, (i) => i.referenceId);
    return {
      loading: false,
      matches,
      isAmbiguous: isAmbiguous(matches),
      needsRetrieval: needsRetrieval(matches, byReference, index.validSourceIds),
      summaries: summarizeByReference(index.interpretations),
    };
  }, [index, query]);
}
