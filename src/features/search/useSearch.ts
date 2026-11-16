import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { groupBy } from '../../domain/collections';
import { needsRetrieval } from '../../domain/eligibility';
import { isAmbiguous, rankReferences, type RankedMatch } from '../../domain/ranking';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import { isFromOnline, type Reference } from '../../domain/types';

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
  /**
   * True unless a curated top match, or a saved online result already explained from sources, resolves
   * the query from the cache (spec §6.1). Saved answers are refreshed only on request (owner decision).
   */
  needsRetrieval: boolean;
  summaries: Map<string, CardSummary>;
  /** Empty when a library match already resolves the query. */
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

/** Ranking reads the query only; search history is written on submit or open (useSearchHistory). */
export function useSearch(query: string): SearchState {
  const { references } = useRepositories();
  const index = useLiveQuery(() => references.getSearchIndex(), [references]);

  // Split once per library load, not per keystroke: the search index is cached on these arrays'
  // identity (`miniSearchExtras.ts`), so recreating them every query would rebuild it every time.
  const parts = useMemo(
    () =>
      index && {
        // Anything that came from an online search (raw or explained) stays apart from the library list.
        curated: index.references.filter((r) => !isFromOnline(r.editorialState)),
        fromOnline: index.references.filter((r) => isFromOnline(r.editorialState)),
      },
    [index],
  );

  return useMemo(() => {
    if (!index || !parts) return LOADING;
    const { curated, fromOnline } = parts;
    const matches = rankReferences(query, curated, index.aliases);
    const onlineMatches = rankReferences(query, fromOnline, index.aliases);
    const byReference = groupBy(index.interpretations, (i) => i.referenceId);
    const excerpts = new Map(index.sources.map((s) => [s.id, s.excerpt]));
    const savedOnline = onlineMatches.map(({ reference }) => ({
      reference,
      teaser: reference.sourceIds.map((id) => excerpts.get(id)).find(Boolean),
    }));
    const libraryResolves = !needsRetrieval(matches, byReference, index.validSourceIds);
    return {
      loading: false,
      matches,
      isAmbiguous: isAmbiguous(matches),
      needsRetrieval:
        !libraryResolves && needsRetrieval(onlineMatches, byReference, index.validSourceIds),
      summaries: summarizeByReference(index.interpretations),
      // A library answer comes first; saved online results then stay out of the way.
      savedOnline: libraryResolves ? [] : savedOnline,
    };
  }, [index, parts, query]);
}
