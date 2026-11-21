import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { usePagedList, type PagedList } from '../../app/usePagedList';
import { useRepositories } from '../../app/RepositoriesContext';
import { safeHref } from '../../components/ui/safeHref';
import { requestPersistentStorage } from '../../data/persistentStorage';
import type { SavedLink } from '../../domain/types';

const TOGGLE_ERROR = "Couldn't update your saved links. Please try again.";
const NONE: ReadonlySet<string> = new Set();

export interface SavedLinksState {
  /** Compares in the normalised form the store keeps, so any spelling of a saved URL matches. */
  isSaved: (url: string) => boolean;
  /** Saves the link, or removes it when it is already saved. Only the title and link are kept. */
  toggle: (link: { url: string; title: string }) => Promise<void>;
  error: string | null;
}

/**
 * Save buttons for the links a screen shows. Only those links are looked up, never every saved
 * link (D69): pass the URLs on screen.
 */
export function useSavedLinks(shownUrls: readonly string[] = []): SavedLinksState {
  const { savedLinks } = useRepositories();
  const key = useMemo(
    () =>
      shownUrls
        .map((url) => safeHref(url))
        .filter((url): url is string => Boolean(url))
        .join('\n'),
    [shownUrls],
  );
  const urls =
    useLiveQuery(() => (key ? savedLinks.savedUrls(key.split('\n')) : NONE), [savedLinks, key]) ??
    NONE;
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async ({ url, title }: { url: string; title: string }) => {
      setError(null);
      try {
        const added = await savedLinks.toggle({ url, title });
        // The first saved link is worth keeping: ask the browser not to evict it.
        // Not awaited: the tap is answered at once, the check runs alongside.
        if (added)
          void savedLinks.count().then((n) => {
            if (n === 1) void requestPersistentStorage();
          });
      } catch {
        setError(TOGGLE_ERROR);
      }
    },
    [savedLinks],
  );

  const isSaved = useCallback((url: string) => urls.has(safeHref(url) ?? ''), [urls]);

  return { isSaved, toggle, error };
}

/** Saved links, newest first, read 1,000 at a time as the reader scrolls (D69, D70). */
export function useSavedLinkList(): PagedList<SavedLink> {
  const { savedLinks } = useRepositories();
  return usePagedList(
    (limit) => savedLinks.list(limit),
    () => savedLinks.count(),
    [savedLinks],
  );
}
