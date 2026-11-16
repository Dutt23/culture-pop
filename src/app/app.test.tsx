import MiniSearch from 'minisearch';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PopCultureDb } from '../data/db';
import { createRepositories } from '../data/repositories';
import { buildSeed } from '../data/seed';
import { formatDate } from '../domain/dates';
import { isFromOnline, type Reference, type Source } from '../domain/types';
import { makeReference } from '../test/factories';
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
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Decode any reference' }),
    ).toBeInTheDocument();
  });

  it('shows a not-found state for unknown references and routes', async () => {
    renderApp('/references/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Reference not found' })).toBeInTheDocument();
  });

  it('marks the current section in primary navigation', async () => {
    renderApp('/favourites');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Favourites' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('search', () => {
  it('shows every meaning of an ambiguous phrase without picking one', async () => {
    renderApp('/search?q=hakuna%20matata');
    expect(await screen.findByText(/can mean 2 different things/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Hakuna matata \(Swahili phrase\)/ }),
    ).toBeInTheDocument();
  });

  it('updates results as the user types', async () => {
    const { user } = renderApp('/search');
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search references' }),
      'let it go',
    );
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
    expect(wikipedia).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/w/index.php?search=zzqx%20nothing',
    );
    expect(wikipedia).toHaveAttribute('target', '_blank');
    expect(wikipedia).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('reference detail', () => {
  it('keeps spoilers hidden until revealed', async () => {
    const { user } = renderApp('/references/the-snap-avengers');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'The snap (Avengers)' }),
    ).toBeInTheDocument();
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
    expect(
      await screen.findByRole('heading', { name: 'Same phrase, different meaning' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Let it go \(everyday saying\)/ })).toBeInTheDocument();
  });

  it('saves a favourite that survives remounting on the same database', async () => {
    const db = createTestDatabase();
    const first = renderApp('/references/doh-simpsons', db);
    await first.user.click(await screen.findByRole('button', { name: 'Favourite' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Favourite' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    first.unmount();

    renderApp('/favourites', db);
    expect(await screen.findByRole('link', { name: /D'oh! \(The Simpsons\)/ })).toBeInTheDocument();
  });
});

describe('favourites from cards and saved web links', () => {
  const LINK = {
    title: 'Why are Ferrari fans always sad?',
    url: 'https://www.reddit.com/r/formula1/comments/abc/',
  };

  it('favourites a search result card without opening it, and it shows on Favourites', async () => {
    const db = createTestDatabase();
    const first = renderApp('/search?q=bazinga', db);
    await first.user.click(await screen.findByRole('button', { name: /^Favourite Bazinga!/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Favourite Bazinga!/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.queryByRole('heading', { level: 1, name: /Bazinga!/ })).not.toBeInTheDocument();
    first.unmount();

    renderApp('/favourites', db);
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
  });

  it('unfavourites from a card on the Favourites page', async () => {
    const db = createTestDatabase();
    await db.open();
    await createRepositories(db).favourites.toggle('doh-simpsons');
    const { user } = renderApp('/favourites', db);

    const heart = await screen.findByRole('button', { name: /^Favourite D'oh!/ });
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    await user.click(heart);

    const empty = await screen.findByRole('heading', { name: 'No favourites yet' });
    expect(empty).toBeInTheDocument();
    expect(screen.getByText(/web links/)).toBeInTheDocument();
  });

  it('lists a saved web link under "Saved web links", where it can be removed', async () => {
    const db = createTestDatabase();
    await db.open();
    await createRepositories(db).savedLinks.toggle(LINK);
    const { user } = renderApp('/favourites', db);

    const section = await screen.findByRole('region', { name: 'Saved web links' });
    const link = within(section).getByRole('link', { name: /Why are Ferrari fans always sad/ });
    expect(link).toHaveAttribute('href', LINK.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(section).toHaveTextContent('reddit.com');
    expect(section).toHaveTextContent('Web link, unverified');
    expect(screen.queryByRole('heading', { name: 'No favourites yet' })).not.toBeInTheDocument();

    const heart = within(section).getByRole('button', { name: `Save link ${LINK.title}` });
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    await user.click(heart);

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Saved web links' })).not.toBeInTheDocument(),
    );
    expect(await db.savedLinks.count()).toBe(0);
    expect(await screen.findByRole('heading', { name: 'No favourites yet' })).toBeInTheDocument();
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

  const DOOM_DATE = formatDate('2026-01-01T00:00:00.000Z');

  /** Online references as earlier searches left them: three explained, one bare, one quote page. */
  async function withOnlineReferences() {
    const db = createTestDatabase();
    await db.open();
    const online = (
      id: string,
      title: string,
      year: number,
      editorialState: Reference['editorialState'] = 'source_curated',
    ) => makeReference(id, title, { category: 'comics', kind: 'character', year, editorialState });
    await db.references.bulkPut([
      online('wd:Q1', 'Doctor Doom', 1962),
      online('wd:Q3', 'Galactus', 1966),
      online('wd:Q2', 'Unexplained Hero', 1970, 'retrieved'),
      online('enwikiquote:7', 'Doom quotes', 1970),
    ]);
    return db;
  }

  /** The reader opened these from a search, so each is in some search's `referenceIds`. */
  async function openedFromSearch(db: PopCultureDb, ...referenceIds: string[]) {
    const { history } = createRepositories(db);
    for (const referenceId of referenceIds) {
      await history.record({ text: 'doctor doom', referenceId }, Date.now());
    }
  }

  const browseOf = () => screen.findByRole('region', { name: 'Browse' });

  it('lists an explained found-online reference the reader opened, under its year, marked with its date', async () => {
    const db = await withOnlineReferences();
    await openedFromSearch(db, 'wd:Q1');
    renderApp('/discover', db);
    const doom = await within(await browseOf()).findByRole('link', { name: /Doctor Doom/ });
    expect(doom).toHaveTextContent('Explained from sources');
    expect(doom).toHaveTextContent(`Found online · Saved ${DOOM_DATE}`);
    expect(
      within(await browseOf()).getByRole('heading', { name: 'Before 1990' }),
    ).toBeInTheDocument();
  });

  it('lists a found-online reference the reader favourited', async () => {
    const db = await withOnlineReferences();
    await createRepositories(db).favourites.toggle('wd:Q3');
    renderApp('/discover', db);
    expect(
      await within(await browseOf()).findByRole('link', { name: /Galactus/ }),
    ).toBeInTheDocument();
  });

  it('leaves out found-online references nobody opened or favourited, and unexplained ones', async () => {
    const db = await withOnlineReferences();
    await openedFromSearch(db, 'wd:Q1', 'wd:Q2');
    renderApp('/discover', db);
    await within(await browseOf()).findByRole('link', { name: /Doctor Doom/ });
    expect(screen.queryByText('Galactus')).not.toBeInTheDocument();
    expect(screen.queryByText('Unexplained Hero')).not.toBeInTheDocument();
    expect(screen.queryByText('Found online · unverified')).not.toBeInTheDocument();
  });

  it('never lists a Wikiquote page, even one the reader opened', async () => {
    const db = await withOnlineReferences();
    await openedFromSearch(db, 'wd:Q1', 'enwikiquote:7');
    renderApp('/discover', db);
    await within(await browseOf()).findByRole('link', { name: /Doctor Doom/ });
    expect(screen.queryByText('Doom quotes')).not.toBeInTheDocument();
  });

  it('drops found-online references from Discover when saved online results are cleared', async () => {
    const db = await withOnlineReferences();
    await openedFromSearch(db, 'wd:Q1');
    await createRepositories(db).favourites.toggle('wd:Q3');
    renderApp('/discover', db);
    await within(await browseOf()).findByRole('link', { name: /Doctor Doom/ });

    await act(async () => createRepositories(db).retrieval.clear());

    await waitFor(() => expect(screen.queryByText('Doctor Doom')).not.toBeInTheDocument());
    expect(screen.queryByText('Galactus')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1990s' })).toBeInTheDocument();
  });

  it('browses by era by default and switches to one section per type, with counts', async () => {
    const db = await withOnlineReferences();
    await openedFromSearch(db, 'wd:Q1');
    const { user } = renderApp('/discover', db);
    const browse = await browseOf();
    expect(within(browse).getByRole('radio', { name: 'By era' })).toBeChecked();
    expect(within(browse).getByRole('group', { name: 'Filter by category' })).toBeInTheDocument();

    await user.click(within(browse).getByRole('radio', { name: 'By type' }));

    expect(within(browse).getByRole('radio', { name: 'By type' })).toBeChecked();
    expect(await within(browse).findByRole('heading', { name: 'Comics · 1' })).toBeInTheDocument();
    expect(within(browse).getByRole('heading', { name: /^Cartoons · \d+$/ })).toBeInTheDocument();
    expect(within(browse).queryByRole('heading', { name: /^Games/ })).not.toBeInTheDocument();
    expect(
      within(browse).queryByRole('group', { name: 'Filter by category' }),
    ).not.toBeInTheDocument();
    const comics = within(browse).getByRole('region', { name: 'Comics · 1' });
    expect(within(comics).getByRole('link', { name: /Doctor Doom/ })).toBeInTheDocument();
  });

  it('says, per empty type, how to find one, and never offers "Other"', async () => {
    const { user } = renderApp('/discover');
    const browse = await browseOf();
    await user.click(within(browse).getByRole('radio', { name: 'By type' }));

    expect(
      await within(browse).findByText(
        'No comics yet. Search a character, like Doctor Doom, to find one.',
      ),
    ).toBeInTheDocument();
    expect(
      within(browse).getByText('No games yet. Search a game, like Among Us, to find one.'),
    ).toBeInTheDocument();
    expect(within(browse).queryByText(/^No other/i)).not.toBeInTheDocument();
    expect(within(browse).queryByText(/^No cartoons/)).not.toBeInTheDocument();
  });

  it('says how to fill an empty category in the era view', async () => {
    const { user } = renderApp('/discover');
    await user.click(await screen.findByRole('button', { name: 'Comics' }));
    expect(
      await screen.findByRole('heading', { name: 'Nothing in Comics yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Search a character, like Doctor Doom, to find one.'),
    ).toBeInTheDocument();
  });

  it('offline, says once to browse the device instead of suggesting searches', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { user } = renderApp('/discover');
    const browse = await browseOf();
    await user.click(await within(browse).findByRole('radio', { name: 'By type' }));

    const offline =
      "You're offline. Browse what's on this device, or search when you're back online.";
    expect(await within(browse).findByText(offline)).toBeInTheDocument();
    expect(within(browse).getAllByText(/Browse what's on this device/)).toHaveLength(1);
    expect(within(browse).queryByText(/Search a/)).not.toBeInTheDocument();

    await user.click(within(browse).getByRole('radio', { name: 'By era' }));
    await user.click(within(browse).getByRole('button', { name: 'Comics' }));
    expect(await within(browse).findByText(offline)).toBeInTheDocument();
    expect(within(browse).queryByText(/Search a/)).not.toBeInTheDocument();
  });

  it('never claims surprise picks are trending, and says where they come from', async () => {
    renderApp('/discover');
    expect(
      await screen.findByText('A random pick from your library, not a trend.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/trending/i)).not.toBeInTheDocument();
  });

  it('says the surprise can include what the reader opened online', async () => {
    const db = await withOnlineReferences();
    await openedFromSearch(db, 'wd:Q1');
    renderApp('/discover', db);
    expect(
      await screen.findByText(
        "A random pick from your library and what you've opened online, not a trend.",
      ),
    ).toBeInTheDocument();
  });

  it('picks the surprise from the chosen category, and again after "Show another"', async () => {
    const { user } = renderApp('/discover');
    const surprise = await screen.findByRole('region', { name: 'Surprise me' });
    await user.click(screen.getByRole('button', { name: 'Sayings' }));

    const onlySayings = () =>
      waitFor(() => {
        const cards = within(surprise).getAllByRole('link');
        expect(cards).toHaveLength(1);
        expect(cards[0]).toHaveTextContent('Saying');
      });
    await onlySayings();
    expect(
      within(surprise).getByText('A random pick from Sayings, not a trend.'),
    ).toBeInTheDocument();
    await user.click(within(surprise).getByRole('button', { name: 'Show another' }));
    await onlySayings();
  });

  it('falls back to the whole library when the chosen category is empty, and says so', async () => {
    const { user } = renderApp('/discover');
    const surprise = await screen.findByRole('region', { name: 'Surprise me' });
    await user.click(await screen.findByRole('button', { name: 'Comics' }));

    expect(
      await within(surprise).findByText(
        'Nothing in Comics yet, so this is a random pick from everything.',
      ),
    ).toBeInTheDocument();
    const cards = within(surprise).getAllByRole('link');
    expect(cards).toHaveLength(1);
    expect(cards[0]).not.toHaveTextContent('Comics');
  });

  it('puts the category back to All when switching to By type, so the surprise never changes silently', async () => {
    const { user } = renderApp('/discover');
    const surprise = await screen.findByRole('region', { name: 'Surprise me' });
    await user.click(await screen.findByRole('button', { name: 'Sayings' }));
    expect(
      within(surprise).getByText('A random pick from Sayings, not a trend.'),
    ).toBeInTheDocument();

    await user.click(within(await browseOf()).getByRole('radio', { name: 'By type' }));
    expect(
      await within(surprise).findByText('A random pick from your library, not a trend.'),
    ).toBeInTheDocument();

    await user.click(within(await browseOf()).getByRole('radio', { name: 'By era' }));
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(surprise).getByText('A random pick from your library, not a trend.'),
    ).toBeInTheDocument();
  });

  it('favourites from a Discover card, and the reference shows on Favourites', async () => {
    const { user } = renderApp('/discover');
    const heart = await within(await browseOf()).findByRole('button', { name: /^Favourite D'oh!/ });
    await user.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));

    await user.click(screen.getByRole('link', { name: 'Favourites' }));
    const saved = await screen.findByRole('button', { name: /^Favourite D'oh!/ });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an alert when a favourite cannot be saved from Discover', async () => {
    const db = createTestDatabase();
    await db.open();
    vi.spyOn(db.favourites, 'add').mockRejectedValue(new Error('QuotaExceededError'));
    const { user } = renderApp('/discover', db);
    await user.click(
      await within(await browseOf()).findByRole('button', { name: /^Favourite D'oh!/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update your favourites");
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

  it('resets favourites, saved web links, settings and saved online results after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const db = createTestDatabase();
    await db.open();
    const repos = createRepositories(db);
    await repos.favourites.toggle('ok-boomer');
    await repos.savedLinks.toggle({ title: 'A link', url: 'https://example.test/page' });
    await repos.settings.set('theme', 'dark');
    await cacheOnlineResults(db, 'the matrix');

    const { user } = renderApp('/settings', db);
    await user.click(await screen.findByRole('button', { name: /Reset favourites/ }));

    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/saved web links/));
    expect(
      await screen.findByText(
        'Favourites, saved web links, search history, settings and saved online results were cleared.',
      ),
    ).toBeInTheDocument();
    expect(await repos.favourites.list()).toEqual([]);
    expect(await db.savedLinks.count()).toBe(0);
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

async function withConsent() {
  const db = createTestDatabase();
  await db.open();
  await createRepositories(db).settings.set('retrieval', 'on');
  return db;
}

describe('online search (phase 2)', () => {
  it('asks before sending anything, then searches and labels results as unverified', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    const { user } = renderApp('/search?q=the%20matrix', undefined, retrieval);

    expect(await screen.findByRole('heading', { name: 'Search online?' })).toBeInTheDocument();
    expect(retrieval.retrieve$).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Search online' }));
    const title = await screen.findByText('The Matrix', { selector: 'span' });
    const card = title.closest('a');
    await waitFor(() => expect(card).toHaveTextContent('1999'));
    expect(card).toHaveTextContent('Found online · unverified');
    expect(retrieval.retrieve$).toHaveBeenCalledWith('the matrix');
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
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
  });

  it('keeps curated answers on top and stays offline after an online result for the same phrase is cached', async () => {
    const db = await withConsent();
    await cacheOnlineResults(db, 'hakuna matata');
    const cached = await db.references.filter((r) => isFromOnline(r.editorialState)).toArray();
    // The cache now holds an exact-title match that used to outrank the curated aliases.
    expect(cached.some((r) => r.normalizedTitle === 'hakuna matata')).toBe(true);

    const retrieval = fixtureRetrievalService('hakuna matata');
    renderApp('/search?q=hakuna%20matata', db, retrieval);
    expect(await screen.findByText(/can mean 2 different things/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Searching Wikipedia/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Saved from earlier online searches' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Found online · unverified')).not.toBeInTheDocument();
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
  });

  it('does not go online when a curated local answer already resolves the query', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    renderApp('/search?q=bazinga', await withConsent(), retrieval);
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
  });

  it('still goes online when the library only matches a misspelling', async () => {
    const retrieval = fixtureRetrievalService('the matrix');
    renderApp('/search?q=bazingaa', await withConsent(), retrieval);
    // The library suggests Bazinga! ("Similar spelling"), but a guess never settles the search.
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
    await waitFor(() => expect(retrieval.retrieve$).toHaveBeenCalledWith('bazingaa'));
  });

  it('keeps the search index while the query changes', async () => {
    const build = vi.spyOn(MiniSearch.prototype, 'addAll');
    const { user } = renderApp(
      '/search',
      await withConsent(),
      fixtureRetrievalService('the matrix'),
    );
    const box = await screen.findByRole('searchbox', { name: 'Search references' });
    await user.type(box, 'bazinga');
    expect(await screen.findByRole('link', { name: /Bazinga!/ })).toBeInTheDocument();
    // One index for the curated library; typing seven letters must not add more.
    expect(build.mock.calls.length).toBeLessThanOrEqual(1);
    build.mockRestore();
  });

  it('shows an offline state instead of searching', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const retrieval = fixtureRetrievalService('the matrix');
    renderApp('/search?q=the%20matrix', await withConsent(), retrieval);
    expect(
      await screen.findByText(/only what's saved on this device is shown/),
    ).toBeInTheDocument();
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
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
    expect(film).toHaveTextContent('Explained from sources');
    expect(screen.getByText('0 matches in your library')).toBeInTheDocument();
    expect(retrieval.retrieve$).not.toHaveBeenCalled();
  });

  it('streams titles before types, then updates the same card in place', async () => {
    const { service, emit, finish } = controllableRetrievalService();
    renderApp('/search?q=the%20matrix', await withConsent(), service);
    expect(await screen.findByText(/^Searching Wikipedia, Wikidata/)).toBeInTheDocument();
    await waitFor(() => expect(service.retrieve$).toHaveBeenCalled());

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
    retrieval.retrieve$.mockReturnValueOnce(
      throwError(() => new RetrievalError('rate_limited', 'slow down')),
    );
    const { user } = renderApp('/search?q=the%20matrix', await withConsent(), retrieval);
    expect(await screen.findByRole('alert')).toHaveTextContent('asked us to slow down');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Found online' })).toBeInTheDocument();
    expect(retrieval.retrieve$).toHaveBeenCalledTimes(2);
  });

  it('filters combined results by type', async () => {
    const retrieval = fixtureRetrievalService('hakuna matata');
    const { user } = renderApp('/search?q=hakuna%20matata%20song', await withConsent(), retrieval);
    // The Music chip only appears once Wikidata has classified the candidates.
    await user.click(await screen.findByRole('button', { name: 'Music' }));
    expect(screen.getByRole('link', { name: /Hakuna Matata \(song\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Lion King 1½/ })).not.toBeInTheDocument();
  });

  it('keeps just-found results in the online section after saving explains them', async () => {
    const db = await withConsent();
    renderApp('/search?q=the%20matrix', db, fixtureRetrievalService('the matrix'));
    await screen.findByRole('heading', { name: 'Found online' });
    await waitFor(async () =>
      expect((await db.references.get('wd:Q83495'))?.editorialState).toBe('source_curated'),
    );
    // Only renders once the saved, explained results reach the page through the live query.
    await screen.findByRole('heading', { name: 'Not what you meant?' });

    const found = screen.getByRole('region', { name: 'Found online' });
    expect(within(found).getAllByRole('link', { name: /The Matrix/ }).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('heading', { name: 'Saved from earlier online searches' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('0 matches in your library')).toBeInTheDocument();
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
    expect(
      await screen.findByRole('heading', { name: 'Explained from sources' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Film · 1999 (per Wikidata)')).toBeInTheDocument();
    const citation = screen.getByRole('link', { name: /Wikipedia: The Matrix/ });
    expect(citation).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/The_Matrix');
    expect(citation).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getAllByText(/CC BY-SA 4.0/).length).toBeGreaterThan(0);
  });
});

describe('search history (D37)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** Types a search, submits it, then opens the result, the way a reader would. */
  async function searchAndOpenBazinga(db?: PopCultureDb) {
    const view = renderApp('/search', db);
    await view.user.type(
      await screen.findByRole('searchbox', { name: 'Search references' }),
      'bazinga',
    );
    await view.user.click(screen.getByRole('button', { name: 'Decode' }));
    await view.user.click(await screen.findByRole('link', { name: /Bazinga!/ }));
    await screen.findByRole('heading', { level: 1, name: /Bazinga!/ });
    return view;
  }

  it('records a submit and the result opened from it as one search, never each keystroke', async () => {
    const { db, user } = await searchAndOpenBazinga();
    await waitFor(async () =>
      expect(await db.searchHistory.toArray()).toEqual([
        expect.objectContaining({
          label: 'bazinga',
          count: 1,
          referenceIds: ['bazinga-big-bang-theory'],
        }),
      ]),
    );

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('link', { name: 'Search' }));
    const recent = await screen.findByRole('region', { name: 'Recent searches' });
    expect(within(recent).getByRole('link', { name: 'bazinga' })).toHaveAttribute(
      'href',
      '/search?q=bazinga',
    );
  });

  it('stores nothing while the history switch is off', async () => {
    const db = createTestDatabase();
    await db.open();
    await createRepositories(db).settings.set('history', 'off');
    const { user } = await searchAndOpenBazinga(db);
    // Reads queue behind any write the clicks started, so a stray record would be counted here.
    expect(await db.searchHistory.count()).toBe(0);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('link', { name: 'Search' }));
    await screen.findByRole('region', { name: 'Try one of these' });
    expect(screen.queryByRole('region', { name: 'Recent searches' })).not.toBeInTheDocument();
  });

  it('switches history off and clears the stored rows from Settings', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const db = createTestDatabase();
    await db.open();
    const repos = createRepositories(db);
    await repos.history.record({ text: 'bazinga' }, Date.now());

    const { user } = renderApp('/settings', db);
    const group = await screen.findByRole('group', { name: 'Search history' });
    expect(within(group).getByRole('radio', { name: 'On' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Off' }));
    await waitFor(async () =>
      expect(await repos.settings.getAll()).toContainEqual({ key: 'history', value: 'off' }),
    );

    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(await screen.findByText('Search history was cleared.')).toBeInTheDocument();
    expect(await db.searchHistory.count()).toBe(0);
  });

  it('shows "Your regulars" on Discover from the Frequent tier only', async () => {
    const db = createTestDatabase();
    await db.open();
    const { history } = createRepositories(db);
    const now = Date.now();
    await history.record({ text: 'bazinga' }, now - 2 * DAY);
    await history.record({ text: 'bazinga' }, now - DAY);
    await history.record({ text: 'ok boomer' }, now - DAY);

    renderApp('/discover', db);
    const regulars = await screen.findByRole('region', { name: 'Your regulars' });
    expect(within(regulars).getByRole('link', { name: 'bazinga' })).toBeInTheDocument();
    expect(within(regulars).queryByRole('link', { name: 'ok boomer' })).not.toBeInTheDocument();
  });

  it('hides "Your regulars" when nothing is Frequent yet', async () => {
    renderApp('/discover');
    expect(await screen.findByRole('heading', { name: '1990s' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your regulars' })).not.toBeInTheDocument();
  });
});

describe('search UX (D37)', () => {
  function film(id: string, title: string): RetrievedCandidate {
    return {
      id,
      title,
      kind: 'work',
      category: 'film',
      classifying: false,
      role: 'work',
      externalLinks: [],
      sources: [],
    };
  }

  it('holds later online results behind "N new results" instead of moving the list', async () => {
    const { service, emit } = controllableRetrievalService();
    const { user } = renderApp('/search?q=the%20matrix', await withConsent(), service);
    await waitFor(() => expect(service.retrieve$).toHaveBeenCalled());
    const first = film('wd:Q83495', 'The Matrix');
    const later = film('wd:Q83265', 'The Matrix Reloaded');
    const outcomes = [{ provider: 'wikipedia' as const, status: 'pending' as const }];

    act(() => emit({ candidates: [first], outcomes }));
    const found = await screen.findByRole('region', { name: 'Found online' });
    expect(within(found).getAllByRole('link')).toHaveLength(1);

    act(() => emit({ candidates: [later, first], outcomes }));
    const note = await screen.findByRole('button', { name: '1 new result, tap to show' });
    expect(within(found).getAllByRole('link')).toHaveLength(1);
    expect(within(found).queryByText('The Matrix Reloaded')).not.toBeInTheDocument();

    await user.click(note);
    const links = within(found).getAllByRole('link');
    // The card already on screen keeps its place; the new one goes below it.
    expect(links.map((link) => link.querySelector('span:nth-child(2)')?.textContent)).toEqual([
      'The Matrix',
      'The Matrix Reloaded',
    ]);
    expect(screen.queryByRole('button', { name: /new result/ })).not.toBeInTheDocument();
  });

  it('holds a slow Wikipedia batch behind "N new results" after a dictionary-first paint, then puts pages named like the search on top', async () => {
    const { service, emit } = controllableRetrievalService();
    const { user } = renderApp('/search?q=dune', await withConsent(), service);
    await waitFor(() => expect(service.retrieve$).toHaveBeenCalled());
    const dictionary = {
      ...film('enwiktionary:dune', 'dune'),
      kind: 'phrase' as const,
      role: 'definition' as const,
    };
    const first = film('wd:Q25391', 'Dune (novel)');
    const second = film('wd:Q3', 'Dune (2021 film)');

    // The dictionary entry is the fastest provider: it paints at once.
    act(() =>
      emit({
        candidates: [dictionary],
        outcomes: [
          { provider: 'wikipedia', status: 'pending' },
          { provider: 'wiktionary', status: 'ok' },
        ],
      }),
    );
    const found = await screen.findByRole('region', { name: 'Found online' });
    expect(within(found).getAllByRole('link')).toHaveLength(1);

    // Wikipedia answers later, reranked by the service (page first): held, nothing moves.
    act(() =>
      emit({
        candidates: [first, second, dictionary],
        outcomes: [
          { provider: 'wikipedia', status: 'ok' },
          { provider: 'wiktionary', status: 'ok' },
        ],
      }),
    );
    const note = await screen.findByRole('button', {
      name: '2 new results, including “Dune (novel)”, tap to show',
    });
    expect(within(found).getAllByRole('link')).toHaveLength(1);

    await user.click(note);
    const titles = within(found)
      .getAllByRole('link')
      .map((link) => link.querySelector('span:nth-child(2)')?.textContent);
    // Pages named like the search (disambiguator aside) go above the dictionary entry, in the
    // reranker's order; nothing moved until the tap.
    expect(titles).toEqual(['Dune (novel)', 'Dune (2021 film)', 'dune']);
  });

  it.each([
    [
      { kind: 'suggestion' as const, text: 'hakuna matata' },
      "Also searched \u201chakuna matata\u201d, Wikipedia's suggestion for your spelling.",
    ],
    [
      { kind: 'shorter_phrase' as const, text: 'babu bhaiya' },
      'Also searched \u201cbabu bhaiya\u201d, the start of your search.',
    ],
  ])('says so when a fallback search found the results (%o)', async (rewrite, note) => {
    const { service, finish } = controllableRetrievalService();
    renderApp('/search?q=zzqx%20nothing', await withConsent(), service);
    await waitFor(() => expect(service.retrieve$).toHaveBeenCalled());
    const found = { ...film('wd:Q1', 'Hakuna Matata'), via: rewrite.kind };
    await act(async () =>
      finish({
        candidates: [found],
        outcomes: [
          { provider: 'wikipedia', status: 'ok' },
          { provider: 'wikidata', status: 'ok' },
          { provider: 'wiktionary', status: 'empty' },
          { provider: 'wikiquote', status: 'empty' },
          { provider: 'tvmaze', status: 'skipped' },
        ],
        rewrite,
      }),
    );
    const region = await screen.findByRole('region', { name: 'Found online' });
    expect(within(region).getByText(note)).toBeInTheDocument();
  });

  describe('question-style searches', () => {
    const topic = (id: string, title: string) => ({
      ...film(id, title),
      kind: 'other' as const,
      category: 'other' as const,
      role: 'topic' as const,
    });
    const outcomes = [
      { provider: 'wikipedia' as const, status: 'ok' as const },
      { provider: 'wikidata' as const, status: 'ok' as const },
      { provider: 'wiktionary' as const, status: 'empty' as const },
      { provider: 'wikiquote' as const, status: 'empty' as const },
      { provider: 'tvmaze' as const, status: 'skipped' as const },
    ];
    async function open(
      candidates: RetrievedCandidate[],
      searched?: string,
      question = 'why are ferrari fans depressed',
    ) {
      const { service, finish } = controllableRetrievalService();
      renderApp(`/search?q=${encodeURIComponent(question)}`, await withConsent(), service);
      await waitFor(() => expect(service.retrieve$).toHaveBeenCalled());
      await act(async () => finish({ candidates, outcomes, ...(searched ? { searched } : {}) }));
      return screen.findByRole('region', { name: 'Found online' });
    }

    it('puts the community sites first, in question wording, and says what was searched', async () => {
      const found = await open(
        [topic('wd:Q1', 'Pink Floyd'), topic('wd:Q2', 'Scuderia Ferrari')],
        'ferrari fans depressed',
      );
      const heading = await screen.findByRole('heading', { name: 'Where people talk about it' });
      expect(screen.getByText(/This sounds like a running joke or a question/)).toBeInTheDocument();
      // The community block comes before the online results.
      expect(
        heading.compareDocumentPosition(found) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        within(found).getByText(/Searched for \u201cferrari fans depressed\u201d/),
      ).toBeInTheDocument();
    });

    it('folds away related pages that share nothing with the question, but keeps a film that does', async () => {
      const found = await open(
        [
          topic('wd:Q1', 'Pink Floyd'),
          film('wd:Q2', 'Ferrari fans: the film'),
          topic('wd:Q3', 'Lando Norris'),
        ],
        'ferrari fans depressed',
      );
      const folded = within(found).getByText('Other pages found (2)').closest('details');
      expect(folded).not.toHaveAttribute('open');
      expect(within(folded as HTMLElement).getByText('Pink Floyd')).toBeInTheDocument();
      expect(within(folded as HTMLElement).getByText('Lando Norris')).toBeInTheDocument();
      const visible = within(found)
        .getAllByRole('link')
        .filter((link) => !(folded as HTMLElement).contains(link));
      expect(visible.map((link) => link.textContent)).toEqual([
        expect.stringContaining('Ferrari fans: the film'),
      ]);
    });

    it('folds a real-world page, and offers the wider web when nothing pop culture is left', async () => {
      const found = await open(
        [topic('wd:Q1', 'Genocides in history (WWI\u2013WWII)')],
        undefined,
        'who committed the worst genocides',
      );
      const folded = within(found).getByText('Other pages found (1)').closest('details');
      expect(folded).not.toHaveAttribute('open');
      expect(within(folded as HTMLElement).getByText(/Genocides in history/)).toBeInTheDocument();
      // Not hidden behind "Not what I meant": nothing visible answers the question.
      expect(screen.getByRole('button', { name: 'Search the wider web' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Not what I meant' })).toBeNull();
    });

    it('shows no community block or folded section when a candidate explains the question', async () => {
      const explained = { ...topic('wd:Q9', 'Ferrari fans'), kind: 'meme' as const };
      const found = await open([explained, topic('wd:Q1', 'Pink Floyd')], 'ferrari fans depressed');
      await waitFor(() => expect(screen.queryByText(/Still searching/)).toBeNull());
      expect(screen.queryByRole('heading', { name: 'Where people talk about it' })).toBeNull();
      // Pink Floyd is still weak, so it is folded; the meme is not.
      expect(within(found).getByText('Other pages found (1)')).toBeInTheDocument();
    });
  });

  it('shows no fallback note for a plain search', async () => {
    const { service, finish } = controllableRetrievalService();
    renderApp('/search?q=zzqx%20nothing', await withConsent(), service);
    await waitFor(() => expect(service.retrieve$).toHaveBeenCalled());
    await act(async () =>
      finish({
        candidates: [film('wd:Q1', 'Hakuna Matata')],
        outcomes: [
          { provider: 'wikipedia', status: 'ok' },
          { provider: 'wikidata', status: 'ok' },
          { provider: 'wiktionary', status: 'empty' },
          { provider: 'wikiquote', status: 'empty' },
          { provider: 'tvmaze', status: 'skipped' },
        ],
      }),
    );
    const region = await screen.findByRole('region', { name: 'Found online' });
    expect(within(region).queryByText(/Also searched|Also looked for/)).not.toBeInTheDocument();
  });

  it('shows when a saved answer was saved and refreshes it only on request', async () => {
    const db = await withConsent();
    await cacheOnlineResults(db, 'the matrix');
    const retrieval = fixtureRetrievalService('the matrix');
    const { user } = renderApp('/search?q=the%20matrix', db, retrieval);

    const saved = await screen.findByRole('region', { name: 'Saved from earlier online searches' });
    const card = within(saved)
      .getAllByRole('link', { name: /The Matrix/ })
      .find((link) => link.textContent?.includes('1999'));
    expect(card).toHaveTextContent(/Saved \d{1,2} \w{3,4} \d{4}/);
    // No timed refresh: a saved answer that resolves the query stays offline.
    expect(retrieval.retrieve$).not.toHaveBeenCalled();

    const saves = vi.spyOn(db.sources, 'bulkPut');
    await user.click(within(saved).getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('heading', { name: 'Found online' })).toBeInTheDocument();
    expect(retrieval.retrieve$).toHaveBeenCalledWith('the matrix');
    await waitFor(() => expect(saves).toHaveBeenCalled());
  });

  it('"Not what I meant" brings up other places to look under online results', async () => {
    const db = createTestDatabase();
    await db.open();
    await cacheOnlineResults(db, 'the matrix');
    const { user } = renderApp('/search?q=the%20matrix', db);

    await screen.findByRole('region', { name: 'Saved from earlier online searches' });
    expect(screen.queryByRole('link', { name: /Search Wikipedia/ })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Not what I meant' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Search Wikipedia/ })).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/w/index.php?search=the%20matrix',
    );
  });
});
