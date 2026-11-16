import { useLiveQuery } from 'dexie-react-hooks';
import { useRepositories } from '../../app/RepositoriesContext';
import { discoverable } from '../../domain/discovery';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import type { Reference } from '../../domain/types';

export interface DiscoveryData {
  references: Reference[];
  summaries: Map<string, CardSummary>;
}

// Search history holds at most a couple of hundred searches; this asks for all of them.
const ALL_SEARCHES = Number.MAX_SAFE_INTEGER;

/**
 * Discovery reads the local library plus the found-online references the reader opened from a
 * search or favourited (see `discoverable`). Clearing saved online results, history or favourites
 * changes the list, so this follows live. No browsing activity is recorded.
 */
export function useDiscovery(): DiscoveryData | undefined {
  const { references, history, favourites } = useRepositories();
  return useLiveQuery(async () => {
    const [all, interpretations, searches, saved] = await Promise.all([
      references.getAll(),
      references.getAllInterpretations(),
      history.recent(ALL_SEARCHES, Date.now()),
      favourites.list(),
    ]);
    const opened = new Set(searches.flatMap((search) => search.referenceIds));
    const favouriteIds = new Set(saved.map((row) => row.referenceId));
    return {
      references: discoverable(all, opened, favouriteIds),
      summaries: summarizeByReference(interpretations),
    };
  }, [references, history, favourites]);
}
