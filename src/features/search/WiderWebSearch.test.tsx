import { searchContextKey } from '../../../shared/text';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PopCultureDb } from '../../data/db';
import { createRepositories } from '../../data/repositories';
import { WEB_RESULTS_TTL_MS } from '../../data/repositories/webResultRepository';
import { formatDate } from '../../domain/dates';
import type { Settings } from '../../domain/settings';
import {
  WebSearchError,
  type DeviceResult,
  type EphemeralResult,
  type WebSearchClient,
} from '../../services/retrieval/webSearch';
import { fakeAuthClient } from '../../test/fakeAuth';
import { unusedRetrievalService } from '../../test/fakeRetrieval';
import type { RetrievalService } from '../../app/retrievalServiceContext';
import type { AuthClient } from '../../services/auth/authClient';
import { createTestDatabase, renderApp as renderAppAs, widerWebOn } from '../../test/renderApp';

/** Signed in with the wider web on for the account, unless a test says otherwise (D65). */
const renderApp = (
  route: string,
  db?: PopCultureDb,
  retrieval?: RetrievalService,
  client: AuthClient = widerWebOn,
) => renderAppAs(route, db, retrieval, client);

const QUESTION = 'why are ferrari fans depressed';
const ROUTE = `/search?q=${encodeURIComponent(QUESTION)}`;
const FIELDS = {
  title: 'Why are Ferrari fans always sad?',
  url: 'https://www.reddit.com/r/formula1/comments/abc/',
  snippet: 'Because the team keeps throwing away wins.',
};
const RESULT: DeviceResult = { ...FIELDS, storage: 'device' };
const SHOWN_ONCE: EphemeralResult = { ...FIELDS, storage: 'none' };

async function databaseWith(settings: Partial<Settings>): Promise<PopCultureDb> {
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  // Online search off keeps the page to the library miss and the wider-web button.
  await repos.settings.set('retrieval', 'off');
  for (const [key, value] of Object.entries(settings)) {
    await repos.settings.set(key as keyof Settings, value as never);
  }
  return db;
}

function serviceWith(search: WebSearchClient['search']) {
  const webSearch = {
    search: vi.fn(search),
    draftCard: vi.fn(),
  };
  return { ...unusedRetrievalService(), webSearch };
}

/** Every row outside settings and the given tables, as text. */
async function storedText(db: PopCultureDb, skip: readonly string[] = []): Promise<string> {
  const tables = db.tables.filter((table) => !['settings', ...skip].includes(table.name));
  const rows = await Promise.all(tables.map(async (table) => [table.name, await table.toArray()]));
  return JSON.stringify(rows);
}

describe('wider-web search (D45)', () => {
  it('runs by itself the first time, says once where it went, and keeps links only on the device', async () => {
    const db = await databaseWith({});
    const before = await storedText(db, ['webResults']);
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, db, retrieval);

    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    const link = within(block).getByRole('link', { name: /Why are Ferrari fans always sad/ });
    expect(link).toHaveAttribute('href', RESULT.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(block).toHaveTextContent('reddit.com');
    expect(block).toHaveTextContent(RESULT.snippet);
    expect(block).toHaveTextContent('Kept on this device for 30 days, for you only.');
    expect(
      screen.getByText(/also go through our server to our web-search provider/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Turn this off in Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.queryByRole('region', { name: 'Search the wider web?' })).not.toBeInTheDocument();
    // Text and links only: no media element is ever made from a result.
    expect(block.querySelector('img, video, iframe, picture, source')).toBeNull();
    expect(retrieval.webSearch.search).toHaveBeenCalledWith(
      QUESTION,
      expect.any(AbortSignal),
      true,
    );

    const repos = createRepositories(db);
    await waitFor(async () =>
      expect(await repos.settings.getAll()).toContainEqual({ key: 'webSearch', value: 'on' }),
    );
    await waitFor(async () => expect(await db.webResults.count()).toBe(1));
    expect(
      (await repos.webResults.get(QUESTION, Date.now(), searchContextKey(true)))?.results,
    ).toEqual([RESULT]);
    // Nothing else changed: not the library, sources, history, favourites; no online lookup ran.
    expect(await storedText(db, ['webResults'])).toBe(before);
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
  });

  it('keeps nothing while search history is off', async () => {
    const db = await databaseWith({ webSearch: 'on', history: 'off' });
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, db, retrieval);
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent('Not saved on this device.');
    expect(await db.webResults.count()).toBe(0);
  });

  it('saves a result as a link with its title and URL only, and removes it again', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    const { user } = renderApp(
      ROUTE,
      db,
      serviceWith(async () => [RESULT]),
    );
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent('Tap the heart to save a link until you remove it.');
    const heart = () => within(block).getByRole('button', { name: `Save link ${RESULT.title}` });
    expect(heart()).toHaveAttribute('aria-pressed', 'false');

    await user.click(heart());
    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'true'));
    // The snippet is the provider's text: it is never kept with a saved link.
    expect(await db.savedLinks.toArray()).toEqual([
      { title: RESULT.title, url: RESULT.url, savedAt: expect.any(String) },
    ]);

    await user.click(heart());
    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'false'));
    expect(await db.savedLinks.count()).toBe(0);
  });

  it('saves a link even while search history is off, and shows a saved link as saved', async () => {
    const db = await databaseWith({ webSearch: 'on', history: 'off' });
    await createRepositories(db).savedLinks.toggle(RESULT);
    renderApp(
      ROUTE,
      db,
      serviceWith(async () => [RESULT]),
    );
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent('Not saved on this device.');
    await waitFor(() =>
      expect(
        within(block).getByRole('button', { name: `Save link ${RESULT.title}` }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(await db.webResults.count()).toBe(0);
  });

  it('never keeps shown-once results', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    // An expired row elsewhere: the save prunes it, which proves the save finished before we look.
    const expired = Date.now() - WEB_RESULTS_TTL_MS - 1;
    await createRepositories(db).webResults.save('old search', [RESULT], expired);
    const retrieval = serviceWith(async () => [SHOWN_ONCE]);
    renderApp(ROUTE, db, retrieval);
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent('Not saved on this device.');
    await waitFor(async () => expect(await db.webResults.get('old search')).toBeUndefined());
    expect(await db.webResults.count()).toBe(0);
  });

  it('shows kept results with their date, and Refresh asks the server again', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    // Relative to now, so the row is never past its 30 days whenever the test runs.
    const savedAt = Date.now() - 24 * 60 * 60 * 1000;
    await createRepositories(db).webResults.save(
      QUESTION,
      [RESULT],
      savedAt,
      searchContextKey(true),
    );
    const fresh: DeviceResult = { ...RESULT, title: 'Fresh answer', url: 'https://example.test/' };
    const retrieval = serviceWith(async () => [fresh]);
    const { user } = renderApp(ROUTE, db, retrieval);

    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent(`Saved ${formatDate(new Date(savedAt).toISOString())}`);
    expect(within(block).getByRole('link', { name: /Why are Ferrari fans/ })).toBeInTheDocument();
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Search the wider web' })).not.toBeInTheDocument();

    await user.click(within(block).getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('link', { name: /Fresh answer/ })).toBeInTheDocument();
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
    const repos = createRepositories(db);
    await waitFor(async () =>
      expect(
        (await repos.webResults.get(QUESTION, Date.now(), searchContextKey(true)))?.results,
      ).toEqual([fresh]),
    );
  });

  it('does not show kept results while search history is off', async () => {
    const db = await databaseWith({ webSearch: 'on', history: 'off' });
    await createRepositories(db).webResults.save(
      QUESTION,
      [RESULT],
      Date.now(),
      searchContextKey(true),
    );
    renderApp(
      ROUTE,
      db,
      serviceWith(async () => []),
    );
    expect(
      await screen.findByText('The wider web had nothing for this either.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Saved \d/)).not.toBeInTheDocument();
  });

  it('with "On" stored, runs by itself with no notice', async () => {
    const retrieval = serviceWith(async () => []);
    renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);
    const nothing = await screen.findByText('The wider web had nothing for this either.');
    expect(nothing).toBeInTheDocument();
    expect(screen.queryByText(/also go through our server/)).not.toBeInTheDocument();
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
  });

  it('"Off" sends nothing and hides the button', async () => {
    const retrieval = serviceWith(async () => []);
    renderApp(ROUTE, await databaseWith({ webSearch: 'off' }), retrieval);
    await screen.findByRole('region', { name: 'Look it up elsewhere' });
    expect(screen.queryByRole('button', { name: 'Search the wider web' })).not.toBeInTheDocument();
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
  });

  it('is not offered when the library already answers the search', async () => {
    renderApp(
      '/search?q=hakuna%20matata',
      await databaseWith({}),
      serviceWith(async () => []),
    );
    await screen.findByRole('region', { name: 'Not what you meant?' });
    expect(screen.queryByRole('button', { name: 'Search the wider web' })).not.toBeInTheDocument();
  });

  it('explains a failure and can try again', async () => {
    const retrieval = serviceWith(async () => [RESULT]);
    retrieval.webSearch.search.mockRejectedValueOnce(new WebSearchError('daily_cap', 'HTTP 429'));
    const { user } = renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);
    expect(await screen.findByRole('alert')).toHaveTextContent(/used up/);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('region', { name: 'Community suggests… (unverified)' }),
    ).toBeInTheDocument();
  });
});

describe('"Search videos"', () => {
  const VIDEO: DeviceResult = {
    title: 'Ferrari fans react (video)',
    url: 'https://www.youtube.com/watch?v=abc',
    snippet: 'Fans watch the last lap.',
    storage: 'device',
  };

  it('searches videos only, and keeps nothing', async () => {
    const db = await databaseWith({ webSearch: 'on', history: 'off' });
    const retrieval = serviceWith(async () => []);
    const { user } = renderApp(ROUTE, db, retrieval);
    await screen.findByText('The wider web had nothing for this either.');

    retrieval.webSearch.search.mockResolvedValueOnce([VIDEO]);
    await user.click(screen.getByRole('button', { name: 'Search videos' }));

    const block = await screen.findByRole('region', { name: 'Videos found… (unverified)' });
    expect(within(block).getByRole('link', { name: /Ferrari fans react/ })).toHaveAttribute(
      'href',
      VIDEO.url,
    );
    expect(block).toHaveTextContent('YouTube links found by a web search.');
    expect(block).toHaveTextContent('Not saved on this device.');
    expect(block.querySelector('img, video, iframe, picture, source')).toBeNull();
    expect(retrieval.webSearch.search).toHaveBeenCalledWith(
      QUESTION,
      expect.any(AbortSignal),
      true,
      undefined,
      true,
    );
    expect(await db.webResults.count()).toBe(0);
    // The way back to the ordinary search.
    expect(screen.getByRole('button', { name: 'Search the wider web' })).toBeEnabled();
  });

  it('is offered after wider-web results and never replaces the kept ones', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    const retrieval = serviceWith(async () => [RESULT]);
    const { user } = renderApp(ROUTE, db, retrieval);
    await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    const repos = createRepositories(db);
    await waitFor(async () =>
      expect(
        (await repos.webResults.get(QUESTION, Date.now(), searchContextKey(true)))?.results,
      ).toEqual([RESULT]),
    );

    retrieval.webSearch.search.mockResolvedValueOnce([VIDEO]);
    await user.click(screen.getByRole('button', { name: 'Search videos' }));
    await screen.findByRole('region', { name: 'Videos found… (unverified)' });
    expect(
      (await repos.webResults.get(QUESTION, Date.now(), searchContextKey(true)))?.results,
    ).toEqual([RESULT]);
  });

  it('says so when there are no videos', async () => {
    const { user } = renderApp(
      ROUTE,
      await databaseWith({ webSearch: 'on' }),
      serviceWith(async () => []),
    );
    await screen.findByText('The wider web had nothing for this either.');
    await user.click(screen.getByRole('button', { name: 'Search videos' }));
    expect(await screen.findByText('No videos found for this.')).toBeInTheDocument();
  });
});

/** Signed in, and the wider web is not turned on for the account (or the server couldn't say). */
const notAllowed = (widerWeb: boolean | null) =>
  fakeAuthClient({ signedIn: true, email: 'reader@example.test', widerWeb });

describe('who may search (D64, D65)', () => {
  it.each([
    ['not turned on', false],
    ['unknown', null],
  ])('%s for the account: no button, no notice, nothing sent', async (_name, widerWeb) => {
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, await databaseWith({}), retrieval, notAllowed(widerWeb));
    await screen.findByRole('region', { name: 'Look it up elsewhere' });
    expect(screen.queryByRole('button', { name: 'Search the wider web' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search videos' })).not.toBeInTheDocument();
    expect(screen.queryByText(/web-search provider/)).not.toBeInTheDocument();
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
  });

  it('a search by itself the server refuses: the button comes back with no message', async () => {
    const retrieval = serviceWith(async () => {
      throw new WebSearchError('signed_out', 'HTTP 401');
    });
    renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);
    // The button also shows before the search starts, so wait for the search itself first.
    await waitFor(() => expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Search the wider web' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('signed out, on a tap: says so plainly with a link to sign in, and no "Try again"', async () => {
    const retrieval = serviceWith(async () => {
      throw new WebSearchError('signed_out', 'HTTP 401');
    });
    const { user } = renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);
    await waitFor(() => expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sign in to search the wider web.');
    expect(within(alert).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('turned off on the server since, on a tap: says to ask the owner, no link, no retry', async () => {
    const retrieval = serviceWith(async () => {
      throw new WebSearchError('not_allowed', 'HTTP 403');
    });
    const { user } = renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);
    await waitFor(() => expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("isn't turned on for your account yet. Ask the owner.");
    expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('searching by itself (D50, D65)', () => {
  it('shows the notice only the first time', async () => {
    const db = await databaseWith({});
    const first = renderApp(
      ROUTE,
      db,
      serviceWith(async () => [RESULT]),
    );
    await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(screen.getByText(/also go through our server/)).toBeInTheDocument();
    await waitFor(async () =>
      expect(await createRepositories(db).settings.getAll()).toContainEqual({
        key: 'webSearch',
        value: 'on',
      }),
    );
    first.unmount();

    renderApp(
      '/search?q=why%20do%20cats%20sit%20in%20boxes',
      db,
      serviceWith(async () => []),
    );
    await screen.findByText('The wider web had nothing for this either.');
    expect(screen.queryByText(/also go through our server/)).not.toBeInTheDocument();
  });

  it('shows kept results instead of paying for the same search again', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    await createRepositories(db).webResults.save(
      QUESTION,
      [RESULT],
      Date.now(),
      searchContextKey(true),
    );
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, db, retrieval);
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent(/Saved /);
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
  });
});

describe('"Stories & myths" (D50)', () => {
  it('is offered only for a question', async () => {
    renderApp(
      '/search?q=zzqx%20flarb',
      await databaseWith({}),
      serviceWith(async () => []),
    );
    await screen.findByText('The wider web had nothing for this either.');
    expect(screen.queryByRole('checkbox', { name: /Stories & myths/ })).not.toBeInTheDocument();
  });

  it('is ticked by default, and unticking searches the question as plain text', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    const retrieval = serviceWith(async () => [RESULT]);
    const { user } = renderApp(ROUTE, db, retrieval);
    const box = await screen.findByRole('checkbox', { name: /Stories & myths/ });
    expect(box).toBeChecked();
    await waitFor(() =>
      expect(retrieval.webSearch.search).toHaveBeenLastCalledWith(
        QUESTION,
        expect.any(AbortSignal),
        true,
      ),
    );

    await user.click(box);
    await waitFor(() =>
      expect(retrieval.webSearch.search).toHaveBeenLastCalledWith(
        QUESTION,
        expect.any(AbortSignal),
        false,
      ),
    );
    expect(box).not.toBeChecked();
    expect(await createRepositories(db).settings.getAll()).toContainEqual({
      key: 'stories',
      value: 'off',
    });
  });
});

describe('wider-web search settings', () => {
  it('discloses the provider and device-only keeping, and stores the choice', async () => {
    const db = createTestDatabase();
    await db.open();
    const { user } = renderApp('/settings', db);
    const group = await screen.findByRole('group', { name: 'Wider web search' });
    // Never chose: reads as On, and there is no "Ask first" any more.
    expect(within(group).getByRole('radio', { name: 'On' })).toBeChecked();
    expect(within(group).queryByRole('radio', { name: 'Ask first' })).not.toBeInTheDocument();
    const note = screen.getByText(/goes through our server to a web-search provider/);
    expect(note).toHaveTextContent(/kept on this device, for you only/);

    await user.click(within(group).getByRole('radio', { name: 'Off' }));
    await waitFor(async () =>
      expect(await createRepositories(db).settings.getAll()).toContainEqual({
        key: 'webSearch',
        value: 'off',
      }),
    );
  });

  it('says it is not turned on for an account without it, with no switch', async () => {
    renderApp('/settings', undefined, undefined, notAllowed(false));
    expect(
      await screen.findByText(/Not turned on for your account/, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Wider web search' })).not.toBeInTheDocument();
  });
});
