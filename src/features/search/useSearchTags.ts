import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useRepositories } from '../../app/useRepositories';
import type { BrowsableCategory } from '../../domain/discovery';
import {
  addCustomTag,
  parseSearchTags,
  removeCustomTag,
  serializeSearchTags,
  tasteLean,
  toggleCustomTag,
  toggleType,
  type AddTagResult,
  type SearchTagState,
} from '../../domain/searchTags';

export interface SearchTagsControls {
  state: SearchTagState;
  toggleType: (type: BrowsableCategory) => void;
  toggleCustom: (text: string) => void;
  /** Saves a new tag; says why when it can't. */
  add: (text: string) => AddTagResult;
  remove: (text: string) => void;
  /** True after a write failed; the tags on screen went back to what is stored. */
  saveFailed: boolean;
  /** False until the stored tags are read; a tap before then would save over them. */
  loaded: boolean;
}

/** The reader's tags, kept on this device in the settings table. */
export function useSearchTags(): SearchTagsControls {
  const { settings } = useRepositories();
  // undefined while loading, null when nothing is stored.
  const stored = useLiveQuery(async () => (await settings.getSearchTags()) ?? null, [settings]);
  // The tap shows at once; the stored row takes over once the write has landed.
  const [pending, setPending] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  if (pending !== null && stored === pending) setPending(null);
  const state = parseSearchTags(pending ?? stored ?? undefined);

  const save = (next: SearchTagState) => {
    // A tap before the stored tags load would save over them.
    if (stored === undefined) return;
    const raw = serializeSearchTags(next);
    setPending(raw);
    setSaveFailed(false);
    settings.setSearchTags(raw).catch(() => {
      setPending(null);
      setSaveFailed(true);
    });
  };

  return {
    state,
    toggleType: (type) => save(toggleType(state, type)),
    toggleCustom: (text) => save(toggleCustomTag(state, text)),
    add: (text) => {
      const result = addCustomTag(state, text);
      if (result.ok) save(result.state);
      return result;
    },
    remove: (text) => save(removeCustomTag(state, text)),
    saveFailed,
    loaded: stored !== undefined,
  };
}

// Search history holds at most a couple of hundred searches; this asks for all of them.
const ALL_SEARCHES = Number.MAX_SAFE_INTEGER;

export interface Taste {
  lean: BrowsableCategory;
  /** Whether opened results counted, for the note's wording. */
  usesHistory: boolean;
}

/**
 * The category the reader's favourites (and, with history on, results opened from a search) lean
 * to. Read on this device only; nothing new is recorded.
 */
/** The lean follows the newest favourites; this many are plenty to tell a taste (D69). */
const TASTE_FAVOURITES = 500;

export function useTaste(enabled: boolean, historyOn: boolean): Taste | undefined {
  const { references, history, favourites } = useRepositories();
  return useLiveQuery(async () => {
    if (!enabled) return undefined;
    const [searches, saved] = await Promise.all([
      historyOn ? history.recent(ALL_SEARCHES, Date.now()) : Promise.resolve([]),
      favourites.list(TASTE_FAVOURITES),
    ]);
    const ids = new Set([
      ...saved.map((row) => row.referenceId),
      ...searches.flatMap((search) => search.referenceIds),
    ]);
    // Only these cards, by ID: never the whole library (D69).
    const liked = await references.getByIds([...ids]);
    const lean = tasteLean(liked.map((r) => r.category));
    return lean && { lean, usesHistory: searches.some((search) => search.referenceIds.length > 0) };
  }, [references, history, favourites, enabled, historyOn]);
}
