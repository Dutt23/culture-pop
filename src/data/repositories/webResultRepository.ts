import { normalizePhrase } from '../../domain/normalize';
import { isDeviceResult, type DeviceResult } from '../../services/retrieval/webSearch';
import type { PopCultureDb } from '../db';

/** Wider-web results kept on this device, one row per normalized query (Dexie `webResults`). */
export interface SavedWebResults {
  /** `normalizePhrase` of the query. */
  key: string;
  /** Epoch ms; rows 30 days old are expired. */
  savedAt: number;
  results: DeviceResult[];
}

/** Owner choice (D45): device-kept wider-web results last 30 days, then a new search is needed. */
export const WEB_RESULTS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Wider-web results kept in this device's IndexedDB, for this person only (D45; Parallel's terms
 * 2(b)(i) as the owner reads them). Rules:
 * - only `device` results are kept: the type refuses others, and a run-time check skips them;
 * - the caller saves only while search history is on, because rows are keyed by the query;
 * - Clear history and Reset delete them (`SearchHistoryRepository.clear`);
 * - nothing here is ever sent to `/api` or any server. A future cross-device sync (Supabase) must
 *   skip this store entirely; a test checks that no network code imports it.
 */
export interface WebResultRepository {
  /** Keeps the `device` results for this query, replacing any older row; none → the row is removed. */
  save(
    query: string,
    results: readonly DeviceResult[],
    now: number,
    context?: string,
  ): Promise<void>;
  /** The saved results for this query, or undefined when there are none or they have expired. */
  get(query: string, now: number, context?: string): Promise<SavedWebResults | undefined>;
  clear(): Promise<void>;
}

const resultKey = (query: string, context?: string) =>
  context === undefined
    ? normalizePhrase(query)
    : JSON.stringify([normalizePhrase(query), context]);

const isExpired = (row: SavedWebResults, now: number) => now - row.savedAt >= WEB_RESULTS_TTL_MS;

export function createWebResultRepository(db: PopCultureDb): WebResultRepository {
  return {
    save: (query, results, now, context) =>
      db.transaction('rw', db.webResults, async () => {
        await db.webResults
          .where('savedAt')
          .belowOrEqual(now - WEB_RESULTS_TTL_MS)
          .delete();
        const kept = results.filter(isDeviceResult).map(({ title, url, snippet }) => ({
          title,
          url,
          snippet,
          storage: 'device' as const,
        }));
        const key = resultKey(query, context);
        if (!key) return;
        // A newer search with nothing keepable replaces the old row too: no stale results.
        if (kept.length === 0) await db.webResults.delete(key);
        else await db.webResults.put({ key, savedAt: now, results: kept });
      }),
    get: async (query, now, context) => {
      const row = await db.webResults.get(resultKey(query, context));
      // Stored data is untrusted too: only well-formed device results come back out.
      if (!row || isExpired(row, now)) return undefined;
      const results = Array.isArray(row.results) ? row.results.filter(isDeviceResult) : [];
      return results.length > 0 ? { ...row, results } : undefined;
    },
    clear: () => db.webResults.clear(),
  };
}
