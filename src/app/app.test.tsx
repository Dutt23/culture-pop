import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PopCultureDb } from '../data/db';
import { createRepositories } from '../data/repositories';
import { createTestDatabase, renderApp } from '../test/renderApp';
import { StorageGate } from './StorageGate';

const fetchSpy = vi.fn();

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
    expect(screen.getByRole('heading', { name: 'Timeless sayings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '1990s' })).not.toBeInTheDocument();
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

  it('resets favourites and settings after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const db = createTestDatabase();
    await db.open();
    const repos = createRepositories(db);
    await repos.favourites.toggle('ok-boomer');
    await repos.settings.set('theme', 'dark');

    const { user } = renderApp('/settings', db);
    await user.click(await screen.findByRole('button', { name: /Reset favourites/ }));

    expect(await screen.findByText('Favourites and settings were reset.')).toBeInTheDocument();
    expect(await repos.favourites.list()).toEqual([]);
    expect(await repos.settings.getAll()).toEqual([]);
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
