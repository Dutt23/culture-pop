import type { DraftCard } from '../../../shared/cardTypes.js';
import type { PopCultureDb } from '../db';

export interface DraftCardRecord {
  userContext?: string;
  color?: 'lavender' | 'sage' | 'peach';
  id: string;
  search: string;
  card: DraftCard;
  sources: { from: string; title: string; url?: string; provenance?: 'user' }[];
  promptVersion: string;
  savedAt: string;
}

export interface DraftRepository {
  /** Newest first; at most `limit` when given (lists read in pages, D69). */
  list(limit?: number): Promise<DraftCardRecord[]>;
  count(): Promise<number>;
  /** Which of these IDs are kept, without reading the rest. */
  kept(ids: readonly string[]): Promise<Set<string>>;
  /** IDs of every card kept from Activity (`activity:<job id>`), keys only (D69). */
  keptFromActivity(): Promise<Set<string>>;
  save(record: DraftCardRecord): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Cards the reader kept, on this device only: never synced or sent anywhere. */
export function createDraftRepository(db: PopCultureDb): DraftRepository {
  return {
    list: (limit) => {
      const newest = db.draftCards.orderBy('savedAt').reverse();
      return (limit === undefined ? newest : newest.limit(limit)).toArray();
    },
    count: () => db.draftCards.count(),
    keptFromActivity: async () =>
      new Set(await db.draftCards.where('id').startsWith('activity:').primaryKeys()),
    kept: async (ids) => {
      const keys = await db.draftCards
        .where('id')
        .anyOf([...ids])
        .primaryKeys();
      return new Set(keys);
    },
    save: async (record) => {
      await db.draftCards.put(record);
    },
    remove: (id) => db.draftCards.delete(id),
    clear: () => db.draftCards.clear(),
  };
}
