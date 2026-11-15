import type { SettingKey, Settings } from '../../domain/settings';
import type { Setting } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface SettingsRepository {
  getAll(): Promise<Setting[]>;
  set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>;
  clear(): Promise<void>;
}

export function createSettingsRepository(db: PopCultureDb): SettingsRepository {
  return {
    getAll: () => db.settings.toArray(),
    async set(key, value) {
      await db.settings.put({ key, value });
    },
    clear: () => db.settings.clear(),
  };
}
