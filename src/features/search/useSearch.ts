import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { groupBy } from '../../domain/collections';
import { needsRetrieval } from '../../domain/eligibility';
import { isAmbiguous, rankReferences, type RankedMatch } from '../../domain/ranking';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import type { Reference } from '../../domain/types';

/** A result cached by an earlier online search: evidence only, shown apart from the library. */
export interface SavedOnlineMatch {
  reference: Reference;
  /** First source excerpt, so the card says what the source says and nothing more. */
  teaser?: string;
}

export interface SearchState {
  loading: boolean;
  /** Curated library matches only; cached online results never rank against them. */
  matches: RankedMatch[];
  isAmbiguous: boolean;
  /** True when no curated top match resolves the query from the cache (spec §6.1). */
  needsRetrieval: boolean;
  summaries: Map<string, CardSummary>;
  savedOnline: SavedOnlineMatch[];
}

const LOADING: SearchState = {
  loading: true,
  matches: [],
  isAmbiguous: false,
  needsRetrieval: false,
  summaries: new Map(),
  savedOnline: [],
};

/** Search input is ephemeral: nothing about the query is persisted. */
export function useSearch(query: string): SearchState {
  const { references } = useRepositories();
  const index = useLiveQuery(() => references.getSearchIndex(), [references]);

  return useMemo(() => {
    if (!index) return LOADING;
    const curated = index.references.filter((r) => r.editorialState !== 'retrieved');
    const retrieved = index.references.filter((r) => r.editorialState === 'retrieved');
    const matches = rankReferences(query, curated, index.aliases);
    const byReference = groupBy(index.interpretations, (i) => i.referenceId);
    const excerpts = new Map(index.sources.map((s) => [s.id, s.excerpt]));
    const savedOnline = rankReferences(query, retrieved, index.aliases).map(({ reference }) => ({
      reference,
      teaser: reference.sourceIds.map((id) => excerpts.get(id)).find(Boolean),
    }));
    return {
      loading: false,
      matches,
      isAmbiguous: isAmbiguous(matches),
      needsRetrieval: needsRetrieval(matches, byReference, index.validSourceIds),
      summaries: summarizeByReference(index.interpretations),
      savedOnline,
    };
  }, [index, query]);
}
