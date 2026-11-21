import { liveQuery } from 'dexie';
import type { ReferenceRepository, SearchIndex } from '../../data/repositories/referenceRepository';
import { groupBy } from '../../domain/collections';
import { needsRetrieval } from '../../domain/eligibility';
import {
  isAmbiguous,
  looksLikeMessage,
  rankReferences,
  type RankedMatch,
} from '../../domain/ranking';
import { relatedReferences, type RelatedReferences } from '../../domain/related';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import { isFromOnline, type Interpretation, type Reference } from '../../domain/types';

/**
 * Library search as plain functions (D69): what depends on the library alone is prepared once per
 * library load, so a key press only ranks, and summaries are made only for the cards shown. Used on
 * the main thread for small libraries, and (experimental) in `src/workers/search.worker.ts` above
 * `WORKER_FROM_CARDS` cards: one implementation, so both give the same answers.
 */

/** A result cached by an earlier online search: evidence only, shown apart from the library. */
export interface SavedOnlineMatch {
  reference: Reference;
  /** First source excerpt, so the card says what the source says and nothing more. */
  teaser?: string;
}

/** Plain data only: it crosses the worker boundary by structured clone. */
export interface LibraryResult {
  /** Curated library matches only; cached online results never rank against them. */
  matches: RankedMatch[];
  isAmbiguous: boolean;
  /**
   * True unless a curated top match, or a saved online result already explained from sources,
   * resolves the query from the cache (spec §6.1). Saved answers are refreshed only on request
   * (owner decision).
   */
  needsRetrieval: boolean;
  /** Only for the references in `matches` and `savedOnline`, so a reply stays small. */
  summaries: Map<string, CardSummary>;
  /** Empty when a library match already resolves the query. */
  savedOnline: SavedOnlineMatch[];
}

/** Everything that depends on the library alone, worked out once per library version. */
export interface PreparedLibrary {
  // The search index is cached on these arrays' identity (`miniSearchExtras.ts`), so they must
  // stay the same objects between keystrokes.
  curated: Reference[];
  fromOnline: Reference[];
  aliases: SearchIndex['aliases'];
  byReference: Map<string, Interpretation[]>;
  excerpts: Map<string, string | undefined>;
  validSourceIds: Set<string>;
}

export function prepareLibrary(index: SearchIndex): PreparedLibrary {
  return {
    // Anything from an online search (raw or explained) stays apart from the library list.
    curated: index.references.filter((r) => !isFromOnline(r.editorialState)),
    fromOnline: index.references.filter((r) => isFromOnline(r.editorialState)),
    aliases: index.aliases,
    byReference: groupBy(index.interpretations, (i) => i.referenceId),
    excerpts: new Map(index.sources.map((s) => [s.id, s.excerpt])),
    validSourceIds: index.validSourceIds,
  };
}

export function rankLibrary(library: PreparedLibrary, query: string): LibraryResult {
  const { curated, fromOnline, aliases, byReference, excerpts, validSourceIds } = library;
  const matches = rankReferences(query, curated, aliases);
  const onlineMatches = rankReferences(query, fromOnline, aliases);
  const isMessage = looksLikeMessage(query);
  const libraryResolves = !needsRetrieval(matches, byReference, validSourceIds, isMessage);
  // A library answer comes first; saved online results then stay out of the way.
  const savedOnline = libraryResolves
    ? []
    : onlineMatches.map(({ reference }) => ({
        reference,
        teaser: reference.sourceIds.map((id) => excerpts.get(id)).find(Boolean),
      }));
  const shownIds = new Set([...matches, ...savedOnline].map((m) => m.reference.id));
  return {
    matches,
    isAmbiguous: isAmbiguous(matches),
    needsRetrieval:
      !libraryResolves && needsRetrieval(onlineMatches, byReference, validSourceIds, isMessage),
    summaries: summarizeByReference([...shownIds].flatMap((id) => byReference.get(id) ?? [])),
    savedOnline,
  };
}

/**
 * Related cards for a card's page, from the library already held here, so the page never reads
 * the whole library itself (D69). `undefined` when the reference isn't in the library.
 */
export function relatedIn(
  library: PreparedLibrary,
  referenceId: string,
): RelatedReferences | undefined {
  const all = [...library.curated, ...library.fromOnline];
  const reference = all.find((r) => r.id === referenceId);
  return reference && relatedReferences(reference, all, library.aliases);
}

export interface LibrarySearch {
  search(query: string): Promise<LibraryResult>;
  related(referenceId: string): Promise<RelatedReferences | undefined>;
  /** Calls `listener` after the library changed, so the caller asks again. Returns unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/**
 * EXPERIMENTAL (D69): used by the search worker for libraries above `WORKER_FROM_CARDS` cards.
 *
 * Keeps the library loaded and prepared, following Dexie's live query (it also sees writes made in
 * other tabs and threads). After the first load, a burst of writes is rebuilt at most once per
 * `rebuildDelayMs`; 0 rebuilds on every change.
 */
export function watchLibrary(
  references: Pick<ReferenceRepository, 'getSearchIndex'>,
  rebuildDelayMs: number,
): LibrarySearch {
  const listeners = new Set<() => void>();
  let library: PreparedLibrary | undefined;
  let pending: SearchIndex | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let markLoaded: () => void = () => {};
  let failLoad: (error: unknown) => void = () => {};
  const loaded = new Promise<void>((resolve, reject) => {
    markLoaded = resolve;
    failLoad = reject;
  });
  // Nobody may be searching when a load fails; `search` still reports it.
  loaded.catch(() => {});

  const rebuild = () => {
    timer = undefined;
    if (!pending) return;
    library = prepareLibrary(pending);
    pending = undefined;
    markLoaded();
    listeners.forEach((listener) => listener());
  };

  liveQuery(() => references.getSearchIndex()).subscribe({
    next(index) {
      pending = index;
      if (!library || rebuildDelayMs === 0) rebuild();
      else timer ??= setTimeout(rebuild, rebuildDelayMs);
    },
    error: failLoad,
  });

  return {
    async search(query) {
      await loaded;
      return rankLibrary(library as PreparedLibrary, query);
    },
    async related(referenceId) {
      await loaded;
      return relatedIn(library as PreparedLibrary, referenceId);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
