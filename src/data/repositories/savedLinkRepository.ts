import { hostOf, safeHref } from '../../components/ui/safeHref';
import type { SavedLink } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface SavedLinkRepository {
  /** Newest first; malformed stored rows are skipped. */
  list(): Promise<SavedLink[]>;
  /** Returns the new state: true when now saved. A link that isn't https is refused (false). */
  toggle(link: { url: string; title: string }): Promise<boolean>;
  clear(): Promise<void>;
}

/** The stored URL must be exactly the normalised form `toggle` writes, or toggling would duplicate it. */
const isWellFormed = (row: SavedLink) =>
  typeof row.title === 'string' &&
  row.title.trim() !== '' &&
  typeof row.savedAt === 'string' &&
  typeof row.url === 'string' &&
  safeHref(row.url) === row.url;

/**
 * Wider-web links the reader saved, on this device only (D46). Only the title and link are kept,
 * never the snippet; nothing here is ever sent anywhere, and a future sync must skip this store.
 */
export function createSavedLinkRepository(db: PopCultureDb): SavedLinkRepository {
  return {
    list: async () => {
      const rows = await db.savedLinks.orderBy('savedAt').reverse().toArray();
      // Stored data is untrusted too: only https links with a title come back out.
      return rows.filter(isWellFormed);
    },
    toggle: ({ url, title }) => {
      const safe = safeHref(url);
      if (!safe) return Promise.resolve(false);
      return db.transaction('rw', db.savedLinks, async () => {
        if (await db.savedLinks.get(safe)) {
          await db.savedLinks.delete(safe);
          return false;
        }
        // Fields are picked one by one so nothing else a caller passes can be stored.
        await db.savedLinks.add({
          url: safe,
          // A link always shows something to tap: the site name when the title is empty.
          title: title.trim() || hostOf(safe),
          savedAt: new Date().toISOString(),
        });
        return true;
      });
    },
    clear: () => db.savedLinks.clear(),
  };
}
