import type { PopCultureDb } from '../db';
import { createFavouriteRepository, type FavouriteRepository } from './favouriteRepository';
import { createReferenceRepository, type ReferenceRepository } from './referenceRepository';
import { createRetrievalRepository, type RetrievalRepository } from './retrievalRepository';
import {
  createSearchHistoryRepository,
  type SearchHistoryRepository,
} from './searchHistoryRepository';
import { createSettingsRepository, type SettingsRepository } from './settingsRepository';

export interface Repositories {
  references: ReferenceRepository;
  favourites: FavouriteRepository;
  settings: SettingsRepository;
  retrieval: RetrievalRepository;
  history: SearchHistoryRepository;
  /**
   * Clears favourites, settings, search history and cached online results together in one
   * transaction. Curated reference content is untouched.
   */
  resetUserData(): Promise<void>;
}

export function createRepositories(db: PopCultureDb): Repositories {
  const retrieval = createRetrievalRepository(db);
  const history = createSearchHistoryRepository(db);
  return {
    references: createReferenceRepository(db),
    favourites: createFavouriteRepository(db),
    settings: createSettingsRepository(db),
    retrieval,
    history,
    resetUserData: () =>
      db.transaction(
        'rw',
        [
          db.favourites,
          db.settings,
          db.searchHistory,
          db.references,
          db.interpretations,
          db.sources,
        ],
        async () => {
          await db.favourites.clear();
          await db.settings.clear();
          await history.clear();
          await retrieval.clear();
        },
      ),
  };
}
