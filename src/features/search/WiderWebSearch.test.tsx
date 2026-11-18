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
import { unusedRetrievalService } from '../../test/fakeRetrieval';
import { createTestDatabase, renderApp } from '../../test/renderApp';

const QUESTION = 'why are ferrari fans depressed';
const ROUTE = `/search?q=${encodeURIComponent(QUESTION)}`;
const CODE = 'open-sesame-42';
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
    unlock: vi.fn<WebSearchClient['unlock']>(async () => {}),
    lock: vi.fn<WebSearchClient['lock']>(async () => {}),
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
  it('asks first, shows unverified links, and keeps them only in the device store', async () => {
    const db = await databaseWith({});
    const before = await storedText(db, ['webResults']);
    const retrieval = serviceWith(async () => [RESULT]);
    const { user } = renderApp(ROUTE, db, retrieval);

    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const consent = screen.getByRole('region', { name: 'Search the wider web?' });
    expect(consent).toHaveTextContent(/Parallel/);
    expect(consent).toHaveTextContent(/The card is kept only on this device/);
    expect(consent).toHaveTextContent(/may use them to improve its service/);
    expect(consent).toHaveTextContent(/kept on this device, for you only/);
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();

    await user.click(within(consent).getByRole('button', { name: 'Search the wider web' }));
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    const link = within(block).getByRole('link', { name: /Why are Ferrari fans always sad/ });
    expect(link).toHaveAttribute('href', RESULT.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(block).toHaveTextContent('reddit.com');
    expect(block).toHaveTextContent(RESULT.snippet);
    expect(block).toHaveTextContent('Kept on this device for 30 days, for you only.');
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
    expect((await repos.webResults.get(QUESTION, Date.now()))?.results).toEqual([RESULT]);
    // Nothing else changed: not the library, sources, history, favourites; no online lookup ran.
    expect(await storedText(db, ['webResults'])).toBe(before);
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
  });

  it('keeps nothing while search history is off', async () => {
    const db = await databaseWith({ webSearch: 'on', history: 'off' });
    const retrieval = serviceWith(async () => [RESULT]);
    const { user } = renderApp(ROUTE, db, retrieval);
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
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
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
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
    const { user } = renderApp(
      ROUTE,
      db,
      serviceWith(async () => [RESULT]),
    );
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
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
    const { user } = renderApp(ROUTE, db, retrieval);
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent('Not saved on this device.');
    await waitFor(async () => expect(await db.webResults.get('old search')).toBeUndefined());
    expect(await db.webResults.count()).toBe(0);
  });

  it('shows kept results with their date, and Refresh asks the server again', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    // Relative to now, so the row is never past its 30 days whenever the test runs.
    const savedAt = Date.now() - 24 * 60 * 60 * 1000;
    await createRepositories(db).webResults.save(QUESTION, [RESULT], savedAt);
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
      expect((await repos.webResults.get(QUESTION, Date.now()))?.results).toEqual([fresh]),
    );
  });

  it('does not show kept results while search history is off', async () => {
    const db = await databaseWith({ webSearch: 'on', history: 'off' });
    await createRepositories(db).webResults.save(QUESTION, [RESULT], Date.now());
    renderApp(
      ROUTE,
      db,
      serviceWith(async () => []),
    );
    expect(await screen.findByRole('button', { name: 'Search the wider web' })).toBeInTheDocument();
    expect(screen.queryByText(/Saved \d/)).not.toBeInTheDocument();
  });

  it('"Not now" closes the card and sends nothing', async () => {
    const retrieval = serviceWith(async () => [RESULT]);
    const { user } = renderApp(ROUTE, await databaseWith({}), retrieval);
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Search the wider web?' })).not.toBeInTheDocument();
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
  });

  it('with "On" stored, one tap searches without asking', async () => {
    const retrieval = serviceWith(async () => []);
    const { user } = renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    expect(screen.queryByRole('region', { name: 'Search the wider web?' })).not.toBeInTheDocument();
    const nothing = await screen.findByText('The wider web had nothing for this either.');
    expect(nothing).toBeInTheDocument();
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
  });

  it('"Off" hides the button', async () => {
    renderApp(
      ROUTE,
      await databaseWith({ webSearch: 'off' }),
      serviceWith(async () => []),
    );
    await screen.findByRole('region', { name: 'Look it up elsewhere' });
    expect(screen.queryByRole('button', { name: 'Search the wider web' })).not.toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
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

  it('asks first, searches videos only, and keeps nothing', async () => {
    const db = await databaseWith({});
    const retrieval = serviceWith(async () => [VIDEO]);
    const { user } = renderApp(ROUTE, db, retrieval);

    await user.click(await screen.findByRole('button', { name: 'Search videos' }));
    const consent = screen.getByRole('region', { name: 'Search the wider web?' });
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
    await user.click(within(consent).getByRole('button', { name: 'Search videos' }));

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
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    const repos = createRepositories(db);
    await waitFor(async () =>
      expect((await repos.webResults.get(QUESTION, Date.now()))?.results).toEqual([RESULT]),
    );

    retrieval.webSearch.search.mockResolvedValueOnce([VIDEO]);
    await user.click(screen.getByRole('button', { name: 'Search videos' }));
    await screen.findByRole('region', { name: 'Videos found… (unverified)' });
    expect((await repos.webResults.get(QUESTION, Date.now()))?.results).toEqual([RESULT]);
  });

  it('says so when there are no videos', async () => {
    const { user } = renderApp(
      ROUTE,
      await databaseWith({ webSearch: 'on' }),
      serviceWith(async () => []),
    );
    await user.click(await screen.findByRole('button', { name: 'Search videos' }));
    expect(await screen.findByText('No videos found for this.')).toBeInTheDocument();
  });
});

describe('access code', () => {
  it('asks for the code on 401, unlocks, retries, and never keeps the code', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    const retrieval = serviceWith(async () => [RESULT]);
    retrieval.webSearch.search.mockRejectedValueOnce(new WebSearchError('locked', 'HTTP 401'));
    const { user } = renderApp(ROUTE, db, retrieval);

    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const form = await screen.findByRole('region', { name: 'Enter access code' });
    const input = within(form).getByLabelText('Access code');
    expect(input).toHaveAttribute('type', 'password');
    await user.type(input, CODE);
    await user.click(within(form).getByRole('button', { name: 'Unlock' }));

    expect(
      await screen.findByRole('region', { name: 'Community suggests… (unverified)' }),
    ).toBeInTheDocument();
    expect(retrieval.webSearch.unlock).toHaveBeenCalledWith(CODE);
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(2);

    // The HttpOnly cookie (set by the server, not visible here) is the only credential.
    const settings = await createRepositories(db).settings.getAll();
    expect(await storedText(db)).not.toContain(CODE);
    expect(JSON.stringify(settings)).not.toContain(CODE);
    expect(JSON.stringify({ ...localStorage })).not.toContain(CODE);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(CODE);
    expect(document.cookie).not.toContain(CODE);
  });

  it('says so when the code is wrong and clears the field', async () => {
    const retrieval = serviceWith(async () => [RESULT]);
    retrieval.webSearch.search.mockRejectedValueOnce(new WebSearchError('locked', 'HTTP 401'));
    retrieval.webSearch.unlock.mockRejectedValueOnce(new WebSearchError('wrong_code', 'HTTP 401'));
    const { user } = renderApp(ROUTE, await databaseWith({ webSearch: 'on' }), retrieval);

    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    const form = await screen.findByRole('region', { name: 'Enter access code' });
    const input = within(form).getByLabelText('Access code');
    await user.type(input, 'wrong');
    await user.click(within(form).getByRole('button', { name: 'Unlock' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent("That code didn't work.");
    expect(input).toHaveValue('');
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
  });
});

describe('searching by itself once unlocked (D50)', () => {
  const webAccessOf = async (db: PopCultureDb) =>
    (await createRepositories(db).settings.getAll()).find((row) => row.key === 'webAccess')?.value;

  it('runs without a tap when "On" and a search has worked on this device', async () => {
    const db = await databaseWith({ webSearch: 'on', webAccess: 'unlocked' });
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, db, retrieval);
    expect(
      await screen.findByRole('region', { name: 'Community suggests… (unverified)' }),
    ).toBeInTheDocument();
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
  });

  it('waits for a tap until a search has worked, then remembers it without searching twice', async () => {
    const db = await databaseWith({ webSearch: 'on' });
    const retrieval = serviceWith(async () => [RESULT]);
    const { user } = renderApp(ROUTE, db, retrieval);
    await user.click(await screen.findByRole('button', { name: 'Search the wider web' }));
    await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    await waitFor(async () => expect(await webAccessOf(db)).toBe('unlocked'));
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
  });

  it('still asks first under "Ask first", even on an unlocked device', async () => {
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, await databaseWith({ webSearch: 'ask', webAccess: 'unlocked' }), retrieval);
    expect(await screen.findByRole('button', { name: 'Search the wider web' })).toBeInTheDocument();
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
  });

  it('shows kept results instead of paying for the same search again', async () => {
    const db = await databaseWith({ webSearch: 'on', webAccess: 'unlocked' });
    await createRepositories(db).webResults.save(QUESTION, [RESULT], Date.now());
    const retrieval = serviceWith(async () => [RESULT]);
    renderApp(ROUTE, db, retrieval);
    const block = await screen.findByRole('region', { name: 'Community suggests… (unverified)' });
    expect(block).toHaveTextContent(/Saved /);
    expect(retrieval.webSearch.search).not.toHaveBeenCalled();
  });

  it('on "locked", forgets the device was unlocked and brings the button back, no code form', async () => {
    const db = await databaseWith({ webSearch: 'on', webAccess: 'unlocked' });
    const retrieval = serviceWith(async () => {
      throw new WebSearchError('locked', 'HTTP 401');
    });
    renderApp(ROUTE, db, retrieval);
    expect(await screen.findByRole('button', { name: 'Search the wider web' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Enter access code' })).not.toBeInTheDocument();
    await waitFor(async () => expect(await webAccessOf(db)).toBe('unknown'));
    expect(retrieval.webSearch.search).toHaveBeenCalledTimes(1);
  });

  it('"Forget access code" also stops searches running by themselves', async () => {
    const db = await databaseWith({ webAccess: 'unlocked' });
    const { user } = renderApp(
      '/settings',
      db,
      serviceWith(async () => []),
    );
    await user.click(await screen.findByRole('button', { name: 'Forget access code' }));
    await waitFor(async () => expect(await webAccessOf(db)).toBe('unknown'));
  });
});

describe('"Stories & myths" (D50)', () => {
  it('is offered only for a question', async () => {
    renderApp(
      '/search?q=zzqx%20flarb',
      await databaseWith({}),
      serviceWith(async () => []),
    );
    await screen.findByRole('button', { name: 'Search the wider web' });
    expect(screen.queryByRole('checkbox', { name: /Stories & myths/ })).not.toBeInTheDocument();
  });

  it('is ticked by default, and unticking searches the question as plain text', async () => {
    const db = await databaseWith({ webSearch: 'on', webAccess: 'unlocked' });
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
    expect(within(group).getByRole('radio', { name: 'Ask first' })).toBeChecked();
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

  it('"Forget access code" asks the server to clear the cookie', async () => {
    const retrieval = serviceWith(async () => []);
    const { user } = renderApp('/settings', undefined, retrieval);
    await user.click(await screen.findByRole('button', { name: 'Forget access code' }));
    expect(retrieval.webSearch.lock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('The access code was forgotten on this device.')).toBeVisible();
  });
});
