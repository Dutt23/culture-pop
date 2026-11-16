import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { safeHref } from '../../components/ui/safeHref';
import { requestPersistentStorage } from '../../data/persistentStorage';
import type { SavedLink } from '../../domain/types';

const TOGGLE_ERROR = "Couldn't update your saved links. Please try again.";

export interface SavedLinksState {
  /** Newest first; undefined while loading. */
  links: SavedLink[] | undefined;
  urls: ReadonlySet<string>;
  /** Compares in the normalised form the store keeps, so any spelling of a saved URL matches. */
  isSaved: (url: string) => boolean;
  /** Saves the link, or removes it when it is already saved. Only the title and link are kept. */
  toggle: (link: { url: string; title: string }) => Promise<void>;
  error: string | null;
}

export function useSavedLinks(): SavedLinksState {
  const { savedLinks } = useRepositories();
  const links = useLiveQuery(() => savedLinks.list(), [savedLinks]);
  const [error, setError] = useState<string | null>(null);
  const urls = useMemo(() => new Set((links ?? []).map((link) => link.url)), [links]);

  const toggle = useCallback(
    async ({ url, title }: { url: string; title: string }) => {
      setError(null);
      try {
        const added = await savedLinks.toggle({ url, title });
        // The first saved link is worth keeping: ask the browser not to evict it.
        if (added && urls.size === 0) void requestPersistentStorage();
      } catch {
        setError(TOGGLE_ERROR);
      }
    },
    [savedLinks, urls],
  );

  const isSaved = useCallback((url: string) => urls.has(safeHref(url) ?? ''), [urls]);

  return { links, urls, isSaved, toggle, error };
}
