import { proxy, wrap, type Remote } from 'comlink';
import type { ReferenceRepository } from '../../data/repositories/referenceRepository';
import type { RelatedReferences } from '../../domain/related';
import {
  watchLibrary,
  type LibraryResult,
  type LibrarySearch,
} from '../../features/search/rankLibrary';

/**
 * EXPERIMENTAL (D69, `LARGE_LIBRARY_MODE` in src/data/scale.ts): used only for libraries above
 * `WORKER_FROM_CARDS` cards, which no reader has yet.
 *
 * Main-thread side of library search. The library is loaded, indexed and ranked in
 * `src/workers/search.worker.ts`, so typing never waits for ranking; only the query goes in and
 * the shown results come back (Comlink, structured clone). Where no worker can start (jsdom tests,
 * a failed load) the same code runs here instead.
 */

export interface SearchWorkerApi {
  search(query: string): Promise<LibraryResult>;
  related(referenceId: string): Promise<RelatedReferences | undefined>;
  /** Called after each library rebuild in the worker. */
  onChange(listener: () => void): void;
}

const onMainThread = new WeakMap<Pick<ReferenceRepository, 'getSearchIndex'>, LibrarySearch>();
let inWorker: LibrarySearch | undefined;

function mainThreadSearch(references: Pick<ReferenceRepository, 'getSearchIndex'>): LibrarySearch {
  let search = onMainThread.get(references);
  if (!search) {
    // Tests see a write's results straight away, as before the worker.
    search = watchLibrary(references, 0);
    onMainThread.set(references, search);
  }
  return search;
}

/**
 * The worker opens the app's own database (`createDatabase()`), not `references`: `references` is
 * used only when the worker cannot run.
 */
function startWorker(references: Pick<ReferenceRepository, 'getSearchIndex'>): LibrarySearch {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  let fallback: LibrarySearch | undefined;
  let remote: Remote<SearchWorkerApi> | undefined;

  // Callers waiting on a dead worker are told to ask again, and get the main-thread answer.
  const toMainThread = (): LibrarySearch => {
    if (!fallback) {
      fallback = mainThreadSearch(references);
      fallback.subscribe(notify);
      notify();
    }
    return fallback;
  };

  try {
    const worker = new Worker(new URL('../../workers/search.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener(
      'error',
      () => {
        worker.terminate();
        toMainThread();
      },
      { once: true },
    );
    remote = wrap<SearchWorkerApi>(worker);
    void remote.onChange(proxy(notify));
  } catch {
    toMainThread();
  }

  return {
    search(query) {
      if (fallback || !remote) return toMainThread().search(query);
      return remote.search(query).catch(() => toMainThread().search(query));
    },
    related(referenceId) {
      if (fallback || !remote) return toMainThread().related(referenceId);
      return remote.related(referenceId).catch(() => toMainThread().related(referenceId));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** One worker for the app, created on first use. */
export function getSearchClient(
  references: Pick<ReferenceRepository, 'getSearchIndex'>,
): LibrarySearch {
  if (typeof Worker === 'undefined') return mainThreadSearch(references);
  inWorker ??= startWorker(references);
  return inWorker;
}
