import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useRepositories } from '../../app/useRepositories';
import { isLarge, rememberSize, wasLarge, WORKER_FROM_CARDS } from '../../data/scale';
import { getSearchClient } from '../../services/search/searchClient';
import { prepareLibrary, rankLibrary, type LibraryResult } from './rankLibrary';

export type { SavedOnlineMatch } from './rankLibrary';
export { WORKER_FROM_CARDS };

export interface SearchState extends LibraryResult {
  /** True only until the first result arrives; later queries keep showing the last result. */
  loading: boolean;
}

const LOADING: SearchState = {
  loading: true,
  matches: [],
  isAmbiguous: false,
  needsRetrieval: false,
  summaries: new Map(),
  savedOnline: [],
};

/**
 * Ranking reads the query only; search history is written on submit or open (useSearchHistory).
 * Libraries up to `WORKER_FROM_CARDS` cards (every reader today) are ranked here, in the same
 * frame as the key press, exactly as before D69; bigger ones in the experimental search worker.
 */
export function useSearch(query: string): SearchState {
  const { references } = useRepositories();
  const loaded = useLiveQuery(async () => {
    // Small last time: load the library and count it together, one round trip.
    if (!wasLarge('references', WORKER_FROM_CARDS)) {
      const [size, index] = await Promise.all([references.count(), references.getSearchIndex()]);
      rememberSize('references', size);
      if (!isLarge(size, WORKER_FROM_CARDS)) return { large: false as const, index };
      return { large: true as const };
    }
    const size = await references.count();
    rememberSize('references', size);
    if (isLarge(size, WORKER_FROM_CARDS)) return { large: true as const };
    return { large: false as const, index: await references.getSearchIndex() };
  }, [references]);
  const large = loaded?.large === true;
  // Prepared once per library load, not per keystroke: the search index is cached on these arrays'
  // identity (`miniSearchExtras.ts`), so rebuilding them every query would rebuild it every time.
  const library = useMemo(
    () => (loaded && !loaded.large ? prepareLibrary(loaded.index) : undefined),
    [loaded],
  );
  const here = useMemo(
    () => (library ? { loading: false, ...rankLibrary(library, query) } : LOADING),
    [library, query],
  );
  const inWorker = useSearchInWorker(query, large);
  return large ? inWorker : here;
}

/** EXPERIMENTAL (D69): the library ranked in the search worker, so typing never waits for it. */
function useSearchInWorker(query: string, enabled: boolean): SearchState {
  const { references } = useRepositories();
  const [state, setState] = useState<{ query: string; result: SearchState }>({
    query,
    result: LOADING,
  });
  // Bumped when the library changes, so the current query is asked again.
  const [libraryVersion, setLibraryVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return getSearchClient(references).subscribe(() => setLibraryVersion((v) => v + 1));
  }, [references, enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Latest wins: a slow reply to an earlier query or library version is dropped.
    let stale = false;
    getSearchClient(references)
      .search(query)
      .then(
        (result) => {
          if (!stale) setState({ query, result: { loading: false, ...result } });
        },
        (error: unknown) => {
          // Rethrown during render, so the error boundary shows it instead of an endless spinner.
          if (!stale)
            setState(() => {
              throw error;
            });
        },
      );
    return () => {
      stale = true;
    };
  }, [references, query, libraryVersion, enabled]);

  // While this query is ranked the last results stay on screen, but they belong to another
  // query: they must never be the reason to go online for this one.
  return state.query === query ? state.result : { ...state.result, needsRetrieval: false };
}
