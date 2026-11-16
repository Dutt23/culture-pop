import Dexie from 'dexie';
import {
  isExpired,
  recordSearch,
  type HistoryEntry,
  type HistorySearch,
} from '../../domain/history';
import type { PopCultureDb } from '../db';

export interface SearchHistoryRepository {
  /** Applies the domain rules (merge, promote, demote, evict, expire) in one transaction. */
  record(search: HistorySearch, now: number): Promise<void>;
  /** Latest searches from both tiers, newest first. */
  recent(limit: number, now: number): Promise<HistoryEntry[]>;
  /** Frequent tier only, highest score first. */
  frequent(limit: number, now: number): Promise<HistoryEntry[]>;
  /** Deletes every stored search. */
  clear(): Promise<void>;
}

export function createSearchHistoryRepository(db: PopCultureDb): SearchHistoryRepository {
  return {
    record: (search, now) =>
      db.transaction('rw', db.searchHistory, async () => {
        // shortcut: reads every row (at most 200) because sound-alike merging compares each one; fine at this cap.
        const { put, remove } = recordSearch(await db.searchHistory.toArray(), search, now);
        // Delete first: an expired entry and its fresh replacement can share an ID.
        await db.searchHistory.bulkDelete(remove);
        await db.searchHistory.bulkPut(put);
      }),
    recent: (limit, now) =>
      db.searchHistory
        .orderBy('lastSearchedAt')
        .reverse()
        .filter((e) => !isExpired(e, now))
        .limit(limit)
        .toArray(),
    frequent: (limit, now) =>
      db.searchHistory
        .where('[tier+score]')
        .between(['frequent', Dexie.minKey], ['frequent', Dexie.maxKey])
        .reverse()
        .filter((e) => !isExpired(e, now))
        .limit(limit)
        .toArray(),
    clear: () => db.searchHistory.clear(),
  };
}
