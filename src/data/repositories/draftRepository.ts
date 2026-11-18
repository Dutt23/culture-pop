import type { DraftCard } from '../../../api/_lib/cardTypes.js';
import type { PopCultureDb } from '../db';

export interface DraftCardRecord {
  id: string;
  search: string;
  card: DraftCard;
  sources: { from: string; title: string; url?: string }[];
  promptVersion: string;
  savedAt: string;
}

export interface DraftRepository {
  /** Newest first. */
  list(): Promise<DraftCardRecord[]>;
  save(record: DraftCardRecord): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Cards the reader kept, on this device only: never synced or sent anywhere. */
export function createDraftRepository(db: PopCultureDb): DraftRepository {
  return {
    list: () => db.draftCards.orderBy('savedAt').reverse().toArray(),
    save: async (record) => {
      await db.draftCards.put(record);
    },
    remove: (id) => db.draftCards.delete(id),
    clear: () => db.draftCards.clear(),
  };
}
