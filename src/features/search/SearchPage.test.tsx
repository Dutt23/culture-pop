import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepositories } from '../../data/repositories';
import type { Settings } from '../../domain/settings';
import {
  WebSearchError,
  type WebResult,
  type WebSearchClient,
} from '../../services/retrieval/webSearch';
import { unusedRetrievalService } from '../../test/fakeRetrieval';
import { createTestDatabase, renderApp } from '../../test/renderApp';

const QUESTION = 'why are ferrari fans depressed';
const ROUTE = `/search?q=${encodeURIComponent(QUESTION)}`;
const RESULT: WebResult = {
  title: 'Why are Ferrari fans always sad?',
  url: 'https://www.reddit.com/r/formula1/comments/abc/',
  snippet: 'Because the team keeps throwing away wins.',
  storage: 'none',
};

/**
 * `signedIn`: this device signed in before, so with "On" the wider web searches by itself (D50,
 * D65), as it does for a new search lean or new tags.
 */
async function setUp(webSearch: Settings['webSearch'], signedIn = false) {
  if (signedIn) localStorage.setItem('pcd-account', 'reader@example.test');
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  await repos.settings.set('retrieval', 'off');
  await repos.settings.set('webSearch', webSearch);
  const retrieval = unusedRetrievalService();
  retrieval.webSearch.search.mockImplementation(
    vi.fn<WebSearchClient['search']>(async () => [RESULT]),
  );
  return { ...renderApp(ROUTE, db, retrieval), repos };
}

// Closing the card dialog steps history back; jsdom does that late, into the next test. Not here.
beforeEach(() => {
  vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  localStorage.removeItem('pcd-account');
  vi.mocked(window.history.back).mockRestore();
});

describe('search page: make a card', () => {
  it('offers "Make a card from these" under wider-web results and opens the film', async () => {
    const { user } = await setUp('on');
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    await screen.findByRole('region', { name: 'Community suggests… (unverified)' });

    await user.click(screen.getByRole('button', { name: 'Make a card from these' }));
    // A frame's name starts with the site on its film edge (the heart's starts with "Save link").
    const frame = await screen.findByRole('button', { name: /^reddit\.com\s*Why are Ferrari/ });
    expect(frame).toHaveAttribute('aria-pressed', 'false');
  });

  it('reruns the wider web with changed tags and removes old-context results', async () => {
    const { user, retrieval } = await setUp('on', true);
    await screen.findByRole('link', { name: /Why are Ferrari fans always sad/ });
    vi.mocked(retrieval.webSearch.search).mockResolvedValueOnce([]);
    const row = await screen.findByRole('group', { name: /Search tags/ });
    await user.click(within(row).getByRole('button', { name: 'Anime' }));
    await waitFor(() => expect(retrieval.webSearch.search).toHaveBeenCalledTimes(2));
    expect(vi.mocked(retrieval.webSearch.search).mock.calls[1]?.[3]).toEqual(['anime']);
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Why are Ferrari fans always sad/ })).toBeNull(),
    );
  });

  it('puts the entry above the results and opens the flow in a dialog', async () => {
    const { user } = await setUp('on');
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const result = await screen.findByRole('link', { name: /Why are Ferrari fans always sad/ });

    // One entry, before the first result: on screen as the results arrive, not under them.
    const [entry, ...others] = screen.getAllByRole('button', { name: 'Make a card from these' });
    expect(others).toHaveLength(0);
    expect(entry!.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(entry!);
    const dialog = await screen.findByRole('dialog', { name: `Make a card from “${QUESTION}”` });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    // The page under the sheet doesn't scroll while it's open.
    expect(document.documentElement).toHaveAttribute('data-sheet-open');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(entry).toHaveFocus();
    expect(document.documentElement).not.toHaveAttribute('data-sheet-open');
  });

  it('has no entry before any results', async () => {
    await setUp('on');
    await screen.findByRole('button', { name: 'Search the wider web' });
    expect(screen.queryByRole('button', { name: 'Make a card from these' })).toBeNull();
  });

  it('hides the entry again when a later wider-web run fails', async () => {
    const { user, retrieval } = await setUp('on');
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    await screen.findByRole('button', { name: 'Make a card from these' });

    vi.mocked(retrieval.webSearch.search).mockRejectedValueOnce(
      new WebSearchError('failed', 'HTTP 500'),
    );
    await user.click(screen.getByRole('button', { name: 'Search videos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("didn't answer");
    expect(screen.queryByRole('button', { name: 'Make a card from these' })).toBeNull();
  });

  it('keeps an open flow and its picks when the results on the page go away', async () => {
    const { user, retrieval, repos } = await setUp('on', true);
    await user.click(await screen.findByRole('button', { name: 'Make a card from these' }));
    const flow = await screen.findByRole('dialog');
    await user.click(
      await within(flow).findByRole('button', { name: /^reddit\.com\s*Why are Ferrari/ }),
    );
    expect(within(flow).getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();

    // A new lean starts the wider web afresh; this time it fails, so nothing is on screen. The
    // page under the dialog can't be tapped, so the lean changes in storage, as Settings would.
    vi.mocked(retrieval.webSearch.search).mockRejectedValue(
      new WebSearchError('failed', 'HTTP 500'),
    );
    await act(() => repos.settings.set('stories', 'off'));
    await waitFor(() => expect(retrieval.webSearch.search).toHaveBeenCalledTimes(2));
    await screen.findByRole('alert');

    expect(screen.queryByRole('region', { name: 'Community suggests… (unverified)' })).toBeNull();
    expect(within(flow).getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();

    // The entry went with the results: closing hands focus to the search box instead.
    expect(screen.queryByRole('button', { name: 'Make a card from these' })).toBeNull();
    await user.click(within(flow).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('searchbox', { name: 'Search references' })).toHaveFocus();
  });
});
