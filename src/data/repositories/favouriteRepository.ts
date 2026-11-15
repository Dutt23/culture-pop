import type { Favourite } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface FavouriteRepository {
  /** Newest first. */
  list(): Promise<Favourite[]>;
  /** Returns the new state: true when now saved. */
  toggle(referenceId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export function createFavouriteRepository(db: PopCultureDb): FavouriteRepository {
  return {
    list: () => db.favourites.orderBy('savedAt').reverse().toArray(),
    toggle: (referenceId) =>
      db.transaction('rw', db.favourites, async () => {
        const existing = await db.favourites.get(referenceId);
        if (existing) {
          await db.favourites.delete(referenceId);
          return false;
        }
        await db.favourites.add({ referenceId, savedAt: new Date().toISOString() });
        return true;
      }),
    clear: () => db.favourites.clear(),
  };
}
