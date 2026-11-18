import type { PopCultureDb } from '../db';
import { createBackupRepository, type BackupRepository } from './backupRepository';
import { createDraftRepository, type DraftRepository } from './draftRepository';
import { createFavouriteRepository, type FavouriteRepository } from './favouriteRepository';
import { createPackRepository, type PackRepository } from './packRepository';
import { createReferenceRepository, type ReferenceRepository } from './referenceRepository';
import { createRetrievalRepository, type RetrievalRepository } from './retrievalRepository';
import {
  createSearchHistoryRepository,
  type SearchHistoryRepository,
} from './searchHistoryRepository';
import { createSavedLinkRepository, type SavedLinkRepository } from './savedLinkRepository';
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
  /** Web links the reader saved (title and link only); device only, never synced or sent (D46). */
  savedLinks: SavedLinkRepository;
  /** Cards the reader kept from the AI draft; device only. Clear history leaves them. */
  drafts: DraftRepository;
  /** The reader's packs of existing references and their member rows. */
  packs: PackRepository;
  /** Backup files: what the reader made, never search history, kept web results or the code. */
  backup: BackupRepository;
  /**
   * Clears favourites, packs, saved web links, kept cards, settings, search history (with the wider-web results
   * kept for it) and cached online results together in one
   * transaction. Curated reference content is untouched.
   */
  resetUserData(): Promise<void>;
}

export function createRepositories(db: PopCultureDb): Repositories {
  const retrieval = createRetrievalRepository(db);
  const history = createSearchHistoryRepository(db);
  const savedLinks = createSavedLinkRepository(db);
  const drafts = createDraftRepository(db);
  return {
    references: createReferenceRepository(db),
    favourites: createFavouriteRepository(db),
    settings: createSettingsRepository(db),
    retrieval,
    history,
    webResults: createWebResultRepository(db),
    savedLinks,
    drafts,
    packs: createPackRepository(db),
    backup: createBackupRepository(db, retrieval, savedLinks),
    resetUserData: () =>
      db.transaction(
        'rw',
        [
          db.favourites,
          db.packs,
          db.packMembers,
          db.savedLinks,
          db.draftCards,
          db.settings,
          db.searchHistory,
          db.webResults,
          db.references,
          db.interpretations,
          db.sources,
        ],
        async () => {
          await db.favourites.clear();
          await db.packMembers.clear();
          await db.packs.clear();
          await savedLinks.clear();
          await drafts.clear();
          await db.settings.clear();
          await history.clear();
          await retrieval.clear();
        },
      ),
  };
}
