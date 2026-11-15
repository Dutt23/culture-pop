import type { PopCultureDb } from '../db';
import { createFavouriteRepository, type FavouriteRepository } from './favouriteRepository';
import { createReferenceRepository, type ReferenceRepository } from './referenceRepository';
import { createSettingsRepository, type SettingsRepository } from './settingsRepository';

export interface Repositories {
  references: ReferenceRepository;
  favourites: FavouriteRepository;
  settings: SettingsRepository;
  /** Clears favourites and settings together in one transaction. Reference content is untouched. */
  resetUserData(): Promise<void>;
}

export function createRepositories(db: PopCultureDb): Repositories {
  return {
    references: createReferenceRepository(db),
    favourites: createFavouriteRepository(db),
    settings: createSettingsRepository(db),
    resetUserData: () =>
      db.transaction('rw', db.favourites, db.settings, async () => {
        await db.favourites.clear();
        await db.settings.clear();
      }),
  };
}
