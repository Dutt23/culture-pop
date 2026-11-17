import type { SettingKey, Settings } from '../../domain/settings';
import type { Setting } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface SettingsRepository {
  getAll(): Promise<Setting[]>;
  set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>;
  clear(): Promise<void>;
  /** Search tags (docs/SEARCH_TAGS_PLAN.md) as stored text, untrusted; parse with `parseSearchTags`. */
  getSearchTags(): Promise<string | undefined>;
  setSearchTags(serialized: string): Promise<void>;
}

/** A free-form row beside the enumerated settings: `parseSettings` ignores unknown keys. */
const SEARCH_TAGS_KEY = 'searchTags';

export function createSettingsRepository(db: PopCultureDb): SettingsRepository {
  return {
    getAll: () => db.settings.toArray(),
    async set(key, value) {
      await db.settings.put({ key, value });
    },
    clear: () => db.settings.clear(),
    getSearchTags: async () => (await db.settings.get(SEARCH_TAGS_KEY))?.value,
    async setSearchTags(serialized) {
      await db.settings.put({ key: SEARCH_TAGS_KEY, value: serialized });
    },
  };
}
