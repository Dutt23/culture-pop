import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRepositories } from '../../data/repositories';
import type { Settings } from '../../domain/settings';
import type { WebResult, WebSearchClient } from '../../services/retrieval/webSearch';
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
});
