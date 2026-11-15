import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
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
        await favourites.toggle(referenceId);
      } catch {
        setError(TOGGLE_ERROR);
      }
    },
    [favourites],
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
