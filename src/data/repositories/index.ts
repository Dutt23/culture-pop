import type { PopCultureDb } from '../db';
import { createFavouriteRepository, type FavouriteRepository } from './favouriteRepository';
import { createReferenceRepository, type ReferenceRepository } from './referenceRepository';
import { createRetrievalRepository, type RetrievalRepository } from './retrievalRepository';
import {
  createSearchHistoryRepository,
  type SearchHistoryRepository,
} from './searchHistoryRepository';
import { createSettingsRepository, type SettingsRepository } from './settingsRepository';
import { createWebResultRepository, type WebResultRepository } from './webResultRepository';

export interface Repositories {
  references: ReferenceRepository;
  favourites: FavouriteRepository;
  settings: SettingsRepository;
  retrieval: RetrievalRepository;
  history: SearchHistoryRepository;
  /** Wider-web results kept on this device only; never synced or sent anywhere (D45). */
  webResults: WebResultRepository;
  /**
   * Clears favourites, settings, search history (with the wider-web results kept for it) and cached
   * online results together in one
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
    webResults: createWebResultRepository(db),
    resetUserData: () =>
      db.transaction(
        'rw',
        [
          db.favourites,
          db.settings,
          db.searchHistory,
          db.webResults,
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
