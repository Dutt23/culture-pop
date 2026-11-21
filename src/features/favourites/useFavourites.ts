import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useRef, useState } from 'react';
import { usePagedList, type PagedList } from '../../app/usePagedList';
import { useRepositories } from '../../app/RepositoriesContext';
import { requestPersistentStorage } from '../../data/persistentStorage';
import { ALL_FAVOURITES_UP_TO, isLarge, rememberSize, wasLarge } from '../../data/scale';
import type { Reference } from '../../domain/types';

const TOGGLE_ERROR = "Couldn't update your favourites. Please try again.";
const NONE: ReadonlySet<string> = new Set();

export interface FavouritesState {
  /** Which of the asked-about references are favourites. */
  ids: ReadonlySet<string>;
  /** Resolves false when the change couldn't be saved (the message is in `error`). */
  toggle: (referenceId: string) => Promise<boolean>;
  error: string | null;
}

/**
 * Favourite hearts for the references a screen shows: pass the IDs on screen (one for a card's
 * page, the results for Search). Up to `ALL_FAVOURITES_UP_TO` favourites (every reader today) are
 * all read at once, as before D69; beyond that (experimental), only the cards asked about.
 */
export function useFavourites(referenceIds: readonly string[]): FavouritesState {
  const { favourites } = useRepositories();
  // One string, so a new array with the same IDs doesn't read again.
  const key = referenceIds.join('\n');
  const loaded = useLiveQuery(async () => {
    if (!wasLarge('favourites', ALL_FAVOURITES_UP_TO)) {
      const [size, all] = await Promise.all([favourites.count(), favourites.allIds()]);
      rememberSize('favourites', size);
      if (!isLarge(size, ALL_FAVOURITES_UP_TO)) return all;
      return new Set(key.split('\n').filter((id) => all.has(id)));
    }
    const [size, asked] = await Promise.all([
      favourites.count(),
      key ? favourites.favouriteIds(key.split('\n')) : NONE,
    ]);
    rememberSize('favourites', size);
    return isLarge(size, ALL_FAVOURITES_UP_TO) ? asked : favourites.allIds();
  }, [favourites, key]);
  // While the next cards' hearts are read, the ones already known stay as they were.
  const last = useRef<ReadonlySet<string>>(NONE);
  if (loaded !== undefined) last.current = loaded;
  const ids = last.current;
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (referenceId: string) => {
      setError(null);
      try {
        const added = await favourites.toggle(referenceId);
        // The first favourite is the first thing worth keeping: ask the browser not to evict it.
        // Not awaited: the tap is answered at once, the check runs alongside.
        if (added)
          void favourites.count().then((n) => {
            if (n === 1) void requestPersistentStorage();
          });
        return true;
      } catch {
        setError(TOGGLE_ERROR);
        return false;
      }
    },
    [favourites],
  );

  return { ids, toggle, error };
}

/** Saved references, newest first, read 1,000 at a time as the reader scrolls (D69, D70). */
export function useFavouriteReferences(): PagedList<Reference> {
  const { favourites, references } = useRepositories();
  return usePagedList(
    async (limit) => {
      const rows = await favourites.list(limit);
      return references.getByIds(rows.map((row) => row.referenceId));
    },
    () => favourites.count(),
    [favourites, references],
  );
}
