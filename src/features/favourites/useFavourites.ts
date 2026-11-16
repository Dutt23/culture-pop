import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { requestPersistentStorage } from '../../data/persistentStorage';
import type { Reference } from '../../domain/types';

const TOGGLE_ERROR = "Couldn't update your favourites. Please try again.";

export interface FavouritesState {
  ids: ReadonlySet<string>;
  toggle: (referenceId: string) => Promise<void>;
  error: string | null;
}

export function useFavourites(): FavouritesState {
  const { favourites } = useRepositories();
  const rows = useLiveQuery(() => favourites.list(), [favourites]);
  const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => new Set((rows ?? []).map((row) => row.referenceId)), [rows]);

  const toggle = useCallback(
    async (referenceId: string) => {
      setError(null);
      try {
        const added = await favourites.toggle(referenceId);
        // The first favourite is the first thing worth keeping: ask the browser not to evict it.
        if (added && ids.size === 0) void requestPersistentStorage();
      } catch {
        setError(TOGGLE_ERROR);
      }
    },
    [favourites, ids],
  );

  return { ids, toggle, error };
}

/** Saved references, newest first. */
export function useFavouriteReferences(): Reference[] | undefined {
  const { favourites, references } = useRepositories();
  return useLiveQuery(async () => {
    const rows = await favourites.list();
    return references.getByIds(rows.map((row) => row.referenceId));
  }, [favourites, references]);
}
