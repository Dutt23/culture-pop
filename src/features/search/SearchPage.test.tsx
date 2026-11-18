import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

async function setUp(webSearch: Settings['webSearch']) {
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  await repos.settings.set('retrieval', 'off');
  await repos.settings.set('webSearch', webSearch);
  const retrieval = unusedRetrievalService();
  retrieval.webSearch.search.mockImplementation(
    vi.fn<WebSearchClient['search']>(async () => [RESULT]),
  );
  return renderApp(ROUTE, db, retrieval);
}

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
    const { user, retrieval } = await setUp('on');
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    await user.click(await screen.findByRole('button', { name: 'Make a card from these' }));
    await user.click(await screen.findByRole('button', { name: /^reddit\.com\s*Why are Ferrari/ }));
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();

    // A new lean starts the wider web afresh; this time it fails, so nothing is on screen.
    vi.mocked(retrieval.webSearch.search).mockRejectedValue(
      new WebSearchError('failed', 'HTTP 500'),
    );
    await user.click(screen.getByRole('checkbox', { name: /Stories & myths/ }));
    await waitFor(() => expect(retrieval.webSearch.search).toHaveBeenCalledTimes(2));
    await screen.findByRole('alert');

    expect(screen.queryByRole('region', { name: 'Community suggests… (unverified)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
  });
});
