import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PopCultureDb } from '../data/db';
import { createRepositories } from '../data/repositories';
import { buildSeed } from '../data/seed';
import type { Source } from '../domain/types';
import { retrieve } from '../services/retrieval/retrieve';
import { RetrievalError, type RetrievedCandidate } from '../services/retrieval/types';
import {
  controllableRetrievalService,
  FIXED_NOW,
  fixtureGetJson,
  fixtureRetrievalService,
  type FixtureQuery,
} from '../test/fakeRetrieval';
import { createTestDatabase, renderApp } from '../test/renderApp';
import { StorageGate } from './StorageGate';

const fetchSpy = vi.fn();

/** Caches what an earlier online search for `query` found, as the app would have. */
async function cacheOnlineResults(db: PopCultureDb, query: FixtureQuery) {
  const result = await retrieve(query, { getJson: fixtureGetJson(query), now: () => FIXED_NOW });
  await createRepositories(db).retrieval.saveCandidates(result.candidates);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  // Phase 1 must never contact the network.
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('routing', () => {
  it('lands on /discover', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Decode any reference' })).toBeInTheDocument();
  });

  it('shows a not-found state for unknown references and routes', async () => {
    renderApp('/references/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Reference not found' })).toBeInTheDocument();
  });

  it('marks the current section in primary navigation', async () => {
    renderApp('/favourites');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Favourites' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('search', () => {
  it('shows every meaning of an ambiguous phrase without picking one', async () => {
    renderApp('/search?q=hakuna%20matata');
    expect(await screen.findByText(/can mean 2 different things/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hakuna matata \(Swahili phrase\)/ })).toBeInTheDocument();
  });

  it('updates results as the user types', async () => {
    const { user } = renderApp('/search');
    await user.type(await screen.findByRole('searchbox', { name: 'Search references' }), 'let it go');
    expect(await screen.findByText(/can mean 2 different things/)).toBeInTheDocument();
  });

  it('follows the URL when a suggestion link changes the query', async () => {
    const { user } = renderApp('/search');
    await user.click(await screen.findByRole('link', { name: 'bazinga' }));
    const searchbox = screen.getByRole('searchbox', { name: 'Search references' });
    await waitFor(() => expect(searchbox).toHaveValue('bazinga'));
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
  });

  it('offers user-triggered external search links when nothing matches', async () => {
    renderApp('/search?q=zzqx%20nothing');
    expect(await screen.findByText(/Nothing in your library/)).toBeInTheDocument();
    const wikipedia = screen.getByRole('link', { name: /Search Wikipedia/ });
    expect(wikipedia).toHaveAttribute('href', 'https://en.wikipedia.org/w/index.php?search=zzqx%20nothing');
    expect(wikipedia).toHaveAttribute('target', '_blank');
    expect(wikipedia).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('reference detail', () => {
  it('keeps spoilers hidden until revealed', async () => {
    const { user } = renderApp('/references/the-snap-avengers');
    expect(await screen.findByRole('heading', { level: 1, name: 'The snap (Avengers)' })).toBeInTheDocument();
    expect(screen.queryByText(/turn to dust/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal spoiler' }));
    expect(await screen.findByText(/turn to dust/)).toBeInTheDocument();
  });

  it('shows spoilers automatically when the setting says so', async () => {
    const db = createTestDatabase();
    await db.open();
    await createRepositories(db).settings.set('spoilers', 'show');
    renderApp('/references/the-snap-avengers', db);
    expect(await screen.findByText(/turn to dust/)).toBeInTheDocument();
  });

  it('links to the other meaning of a shared phrase', async () => {
    renderApp('/references/let-it-go-frozen');
    expect(await screen.findByRole('heading', { name: 'Same phrase, different meaning' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Let it go \(everyday saying\)/ })).toBeInTheDocument();
  });

  it('saves a favourite that survives remounting on the same database', async () => {
    const db = createTestDatabase();
    const first = renderApp('/references/doh-simpsons', db);
    await first.user.click(await screen.findByRole('button', { name: 'Favourite' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Favourite' })).toHaveAttribute('aria-pressed', 'true'),
    );
    first.unmount();

    renderApp('/favourites', db);
    expect(await screen.findByRole('link', { name: /D'oh! \(The Simpsons\)/ })).toBeInTheDocument();
  });
});

describe('discover', () => {
  it('filters eras by category', async () => {
    const { user } = renderApp('/discover');
    expect(await screen.findByRole('heading', { name: '1990s' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sayings' }));
    expect(screen.getByRole('button', { name: 'Sayings' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Timeless' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '1990s' })).not.toBeInTheDocument();
  });

  it('never lists results cached from online searches', async () => {
    const db = createTestDatabase();
    await db.open();
    await cacheOnlineResults(db, 'the matrix');
    renderApp('/discover', db);
    expect(await screen.findByRole('heading', { name: '1990s' })).toBeInTheDocument();
    expect(screen.queryByText('The Matrix')).not.toBeInTheDocument();
    expect(screen.queryByText('Found online · unverified')).not.toBeInTheDocument();
  });

  it('never claims surprise picks are trending', async () => {
    renderApp('/discover');
    expect(await screen.findByText(/not a trend/)).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('applies and persists theme and motion choices', async () => {
    const { user, db } = renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));
    await user.click(screen.getByRole('radio', { name: 'Reduce' }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    });
    expect(await createRepositories(db).settings.getAll()).toEqual(
      expect.arrayContaining([
        { key: 'theme', value: 'dark' },
        { key: 'motion', value: 'reduce' },
      ]),
    );
  });

  it('applies a choice immediately, before the database write finishes', async () => {
    const db = createTestDatabase();
    await db.open();
    // A write that never settles: the UI must not wait for IndexedDB.
    vi.spyOn(db.settings, 'put').mockImplementation(() => new Promise(() => {}) as never);

    const { user } = renderApp('/settings', db);
    await user.click(await screen.findByRole('radio', { name: 'Reduce' }));

    expect(screen.getByRole('radio', { name: 'Reduce' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
  });

  it('reverts a choice and explains when saving fails', async () => {
    const db = createTestDatabase();
    await db.open();
    vi.spyOn(db.settings, 'put').mockImplementation(
      () => Promise.reject(new Error('QuotaExceededError')) as never,
    );

    const { user } = renderApp('/settings', db);
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that setting");
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  });

  it('resets favourites, settings and saved online results after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const db = createTestDatabase();
    await db.open();
    const repos = createRepositories(db);
    await repos.favourites.toggle('ok-boomer');
    await repos.settings.set('theme', 'dark');
    await cacheOnlineResults(db, 'the matrix');

    const { user } = renderApp('/settings', db);
    await user.click(await screen.findByRole('button', { name: /Reset favourites/ }));

    expect(
      await screen.findByText('Favourites, settings and saved online results were cleared.'),
    ).toBeInTheDocument();
    expect(await repos.favourites.list()).toEqual([]);
    expect(await repos.settings.getAll()).toEqual([]);
    expect(await db.references.get('wd:Q83495')).toBeUndefined();
    expect(await db.sources.count()).toBe(0);
    // Curated content is untouched.
    expect(await db.references.count()).toBe(buildSeed().references.length);
  });
});

describe('offline and storage states', () => {
  it('shows an offline notice while the app keeps working', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp('/search?q=bazinga');
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
    expect(screen.getByText(/You're offline\. Everything saved/)).toBeInTheDocument();
    expect(screen.getByText(/these links need a connection/)).toBeInTheDocument();
  });

  it('explains when local storage cannot open', async () => {
    const brokenDb = {
      open: () => Promise.reject({ name: 'MissingAPIError' }),
    } as unknown as PopCultureDb;
    render(
      <StorageGate db={brokenDb}>
        <p>App content</p>
      </StorageGate>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocking local storage/);
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });
});

describe('online search (phase 2)', () => {
  async function withConsent() {
    const db = createTestDatabase();
    await db.open();
    await createRepositories(db).settings.set('retrieval', 'on');
    return db;
  }

  it('asks before sending anything, then searches and labels results as unverified', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    const { user } = renderApp('/search?q=the%20matrix', undefined, retrieval);

    expect(await screen.findByRole('heading', { name: 'Search online?' })).toBeInTheDocument();
    expect(retrieval.retrieve).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Search online' }));
    const title = await screen.findByText('The Matrix', { selector: 'span' });
    const card = title.closest('a');
    await waitFor(() => expect(card).toHaveTextContent('1999'));
    expect(card).toHaveTextContent('Found online · unverified');
    expect(retrieval.retrieve).toHaveBeenCalledWith(
      'the matrix',
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it('respects "Not now" for the rest of the session and never contacts providers', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    const { user } = renderApp('/search?q=the%20matrix', undefined, retrieval);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(await screen.findByText(/Online search skipped for now/)).toBeInTheDocument();
    expect(screen.queryByText(/Online search is off/)).not.toBeInTheDocument();

    // Leaving the search page and coming back keeps the choice: it lives in the session, not the page.
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('link', { name: 'Discover' }));
    await user.click(await within(nav).findByRole('link', { name: 'Search' }));
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search references' }),
      'zzqx nothing',
    );
    expect(await screen.findByText(/Online search skipped for now/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Search online?' })).not.toBeInTheDocument();
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it('keeps curated answers on top and stays offline after an online result for the same phrase is cached', async () => {
    const db = await withConsent();
    await cacheOnlineResults(db, 'hakuna matata');
    const cached = await db.references.filter((r) => r.editorialState === 'retrieved').toArray();
    // The cache now holds an exact-title match that used to outrank the curated aliases.
    expect(cached.some((r) => r.normalizedTitle === 'hakuna matata')).toBe(true);

    const retrieval = fixtureRetrievalService('hakuna matata');
    renderApp('/search?q=hakuna%20matata', db, retrieval);
    expect(await screen.findByText(/can mean 2 different things/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ })).toBeInTheDocument();
    expect(screen.queryByText(/Searching Wikipedia/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Saved from earlier online searches' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Found online · unverified')).not.toBeInTheDocument();
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it('does not go online when a curated local answer already resolves the query', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    renderApp('/search?q=bazinga', await withConsent(), retrieval);
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it('shows an offline state instead of searching', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const retrieval = fixtureRetrievalService('the matrix');
    renderApp('/search?q=the%20matrix', await withConsent(), retrieval);
    expect(await screen.findByText(/only what's saved on this device is shown/)).toBeInTheDocument();
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it('shows results saved from earlier online searches while offline, apart from the library', async () => {
    const db = await withConsent();
    await cacheOnlineResults(db, 'the matrix');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const retrieval = fixtureRetrievalService('the matrix');
    renderApp('/search?q=the%20matrix', db, retrieval);

    const saved = await screen.findByRole('region', { name: 'Saved from earlier online searches' });
    const film = within(saved)
      .getAllByRole('link', { name: /The Matrix/ })
      .find((link) => link.textContent?.includes('1999'));
    expect(film).toHaveTextContent('Found online · unverified');
    expect(screen.getByText(/only what's saved on this device is shown/)).toBeInTheDocument();
    expect(screen.getByText('0 matches in your library')).toBeInTheDocument();
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it('streams titles before types, then updates the same card in place', async () => {
    const { service, emit, finish } = controllableRetrievalService();
    renderApp('/search?q=the%20matrix', await withConsent(), service);
    expect(await screen.findByText(/^Searching Wikipedia, Wikidata/)).toBeInTheDocument();
    await waitFor(() => expect(service.retrieve).toHaveBeenCalled());

    const article: Source = {
      id: 'src:enwiki:30007',
      url: 'https://en.wikipedia.org/wiki/The_Matrix',
      title: 'The Matrix',
      publisher: 'Wikipedia',
      sourceType: 'encyclopedia',
      retrievedAt: FIXED_NOW,
      license: 'CC BY-SA 4.0',
      excerpt: 'A science fiction action film.',
    };
    const unclassified: RetrievedCandidate = {
      id: 'wd:Q83495',
      title: 'The Matrix',
      kind: 'other',
      category: 'other',
      classifying: true,
      role: 'topic',
      externalLinks: [],
      sources: [article],
    };
    act(() =>
      emit({
        candidates: [unclassified],
        outcomes: [
          { provider: 'wikipedia', status: 'ok' },
          { provider: 'wikidata', status: 'pending' },
          { provider: 'wiktionary', status: 'pending' },
        ],
      }),
    );

    const card = (await screen.findByText('The Matrix', { selector: 'span' })).closest('a');
    expect(card).toHaveTextContent('Checking type…');
    expect(card).not.toHaveTextContent('1999');
    expect(screen.getByText('Still searching Wikidata and Wiktionary…')).toBeInTheDocument();

    await act(async () =>
      finish({
        candidates: [
          {
            ...unclassified,
            kind: 'work',
            category: 'film',
            year: 1999,
            yearSourceId: 'src:wd:Q83495',
            classifying: false,
            role: 'work',
            externalLinks: [],
            sources: [
              article,
              {
                id: 'src:wd:Q83495',
                url: 'https://www.wikidata.org/wiki/Q83495',
                title: 'The Matrix',
                publisher: 'Wikidata',
                sourceType: 'structured_data',
                retrievedAt: FIXED_NOW,
                license: 'CC0 1.0',
              },
            ],
          },
        ],
        outcomes: [
          { provider: 'wikipedia', status: 'ok' },
          { provider: 'wikidata', status: 'ok' },
          { provider: 'wiktionary', status: 'empty' },
        ],
      }),
    );

    await waitFor(() => expect(card).toHaveTextContent('1999'));
    // Same element: keyed by candidate ID, so it updated in place rather than remounting.
    expect(card).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('Film')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Checking type…');
    expect(screen.queryByText(/Still searching/)).not.toBeInTheDocument();
  });

  it('names a failed provider but still shows what the others found', async () => {
    const retrieval = fixtureRetrievalService('hakuna matata', {
      wiktionary: new RetrievalError('network', 'down'),
    });
    renderApp('/search?q=hakuna%20matata%20song', await withConsent(), retrieval);
    expect(await screen.findByText("Wiktionary couldn't be reached.")).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Hakuna Matata \(song\)/ })).toBeInTheDocument();
  });

  it('does not cache results that Wikidata could not classify', async () => {
    const db = await withConsent();
    const retrieval = fixtureRetrievalService('the matrix', {
      wikidata: new RetrievalError('timeout', 'slow'),
    });
    renderApp('/search?q=the%20matrix', db, retrieval);
    expect(
      await screen.findByText("These results couldn't be saved for offline use."),
    ).toBeInTheDocument();
    expect(screen.getByText('Wikidata took too long to answer.')).toBeInTheDocument();
    expect(await db.references.get('wd:Q83495')).toBeUndefined();
  });

  it('explains when Wikimedia refuses the request (HTTP 403)', async () => {
    const retrieval = fixtureRetrievalService('the matrix', {
      wikipedia: new RetrievalError('blocked', 'Provider refused the request'),
      wiktionary: new RetrievalError('blocked', 'Provider refused the request'),
      wikiquote: new RetrievalError('blocked', 'Provider refused the request'),
    });
    renderApp('/search?q=the%20matrix', await withConsent(), retrieval);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Wikipedia refused the request.');
    expect(alert).toHaveTextContent('Wiktionary refused the request.');
    expect(alert).toHaveTextContent('Wikiquote refused the request.');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No matches online either.')).not.toBeInTheDocument();
  });

  it('explains a total failure and retries on request', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    retrieval.retrieve.mockRejectedValueOnce(new RetrievalError('rate_limited', 'slow down'));
    const { user } = renderApp('/search?q=the%20matrix', await withConsent(), retrieval);
    expect(await screen.findByRole('alert')).toHaveTextContent('asked us to slow down');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Found online' })).toBeInTheDocument();
    expect(retrieval.retrieve).toHaveBeenCalledTimes(2);
  });

  it('filters combined results by type', async () => {
    const retrieval = fixtureRetrievalService('hakuna matata');
    const { user } = renderApp('/search?q=hakuna%20matata%20song', await withConsent(), retrieval);
    // The Music chip only appears once Wikidata has classified the candidates.
    await user.click(await screen.findByRole('button', { name: 'Music' }));
    expect(screen.getByRole('link', { name: /Hakuna Matata \(song\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Lion King 1½/ })).not.toBeInTheDocument();
  });

  it('caches results and shows their citations on the reference page, even offline', async () => {
    const db = await withConsent();
    const retrieval = fixtureRetrievalService('the matrix');
    const first = renderApp('/search?q=the%20matrix', db, retrieval);
    await screen.findByRole('heading', { name: 'Found online' });
    await waitFor(async () => expect(await db.references.get('wd:Q83495')).toBeDefined());
    first.unmount();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp(`/references/${encodeURIComponent('wd:Q83495')}`, db, retrieval);
    expect(await screen.findByRole('heading', { name: 'Not explained yet' })).toBeInTheDocument();
    expect(screen.getByText('Film · 1999 (per Wikidata)')).toBeInTheDocument();
    const citation = screen.getByRole('link', { name: /Wikipedia: The Matrix/ });
    expect(citation).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/The_Matrix');
    expect(citation).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getAllByText(/CC BY-SA 4.0/).length).toBeGreaterThan(0);
  });
});
