import { expose } from 'comlink';
import { createDatabase } from '../data/db';
import { createReferenceRepository } from '../data/repositories/referenceRepository';
import { watchLibrary } from '../features/search/rankLibrary';
import type { SearchWorkerApi } from '../services/search/searchClient';

/**
 * EXPERIMENTAL (D69): started only for libraries above `WORKER_FROM_CARDS` cards.
 *
 * Holds the library and its search index off the main thread, exposed with Comlink (API in
 * `src/services/search/searchClient.ts`). Opens the app's database itself: Dexie tells this
 * worker's live query about the page's writes, so the index follows the library.
 */

/** A burst of library writes (an online search saving results) is rebuilt at most this often. */
const REBUILD_DELAY_MS = 250;

const library = watchLibrary(createReferenceRepository(createDatabase()), REBUILD_DELAY_MS);

const api: SearchWorkerApi = {
  search: (query) => library.search(query),
  related: (referenceId) => library.related(referenceId),
  onChange(listener) {
    library.subscribe(() => void listener());
  },
};

expose(api);
