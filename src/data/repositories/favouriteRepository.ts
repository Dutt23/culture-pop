import type { Favourite } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface FavouriteRepository {
  /** Newest first; at most `limit` when given (lists read in pages, D69). */
  list(limit?: number): Promise<Favourite[]>;
  count(): Promise<number>;
  /** Which of these references are favourites, without reading the rest (D69). */
  favouriteIds(referenceIds: readonly string[]): Promise<Set<string>>;
  /** Every favourite's reference ID (keys only, no rows). */
  allIds(): Promise<Set<string>>;
  /** Returns the new state: true when now saved. */
  toggle(referenceId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export function createFavouriteRepository(db: PopCultureDb): FavouriteRepository {
  return {
    list: (limit) => {
      const newest = db.favourites.orderBy('savedAt').reverse();
      return (limit === undefined ? newest : newest.limit(limit)).toArray();
    },
    count: () => db.favourites.count(),
    allIds: async () => new Set(await db.favourites.toCollection().primaryKeys()),
    favouriteIds: async (referenceIds) => {
      const keys = await db.favourites
        .where('referenceId')
        .anyOf([...referenceIds])
        .primaryKeys();
      return new Set(keys);
    },
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
