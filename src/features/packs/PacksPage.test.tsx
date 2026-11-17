import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OPEN_PACK_KEY } from '../../components/reference-card/openPack';
import { createRepositories } from '../../data/repositories';
import { createTestDatabase, renderApp } from '../../test/renderApp';
import { FROM_PACK_DRAG_TYPE, REFERENCE_DRAG_TYPE } from './usePacks';

const SNAP = /The snap \(Avengers\)/;

async function withPacks() {
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  const xMen = await repos.packs.create({ name: 'Before X-Men', ceiling: 'before_watching' });
  const doom = await repos.packs.create({ name: 'Before the Doom movie', ceiling: 'open' });
  return { db, repos, xMen, doom };
}

const packPage = (id: string) => `/packs/${encodeURIComponent(id)}`;

afterEach(() => {
  sessionStorage.clear();
});

describe('packs', () => {
  it('creates a pack that starts as "before you watch"', async () => {
    const { db, repos } = await withPacks();
    const { user } = renderApp('/packs', db);
    await user.type(await screen.findByLabelText('Pack name'), 'Before the finale');
    expect(screen.getByRole('radio', { name: 'Before you watch' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Create pack' }));
    expect(await screen.findByRole('link', { name: /Before the finale/ })).toBeInTheDocument();
    expect((await repos.packs.list()).find((p) => p.name === 'Before the finale')).toMatchObject({
      ceiling: 'before_watching',
    });
  });

  it('moves a card out of this pack into the pack chosen in the Move sheet', async () => {
    const { db, repos, xMen, doom } = await withPacks();
    await repos.packs.fileCard('ok-boomer', xMen.id, 0);
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 1);
    const { user } = renderApp(packPage(xMen.id), db);

    const controls = await screen.findByRole('group', { name: 'The snap (Avengers)' });
    await user.click(within(controls).getByRole('button', { name: 'Move' }));
    const sheet = screen.getByRole('dialog', { name: /to another pack/ });
    await user.click(await within(sheet).findByRole('button', { name: 'Before the Doom movie' }));

    await waitFor(async () =>
      expect((await repos.packs.members(doom.id)).map((m) => m.referenceId)).toEqual([
        'the-snap-avengers',
      ]),
    );
    expect(await repos.packs.members(xMen.id)).toMatchObject([
      { referenceId: 'ok-boomer', position: 0 },
    ]);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Before X-Men' })).toHaveFocus(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('files without unfiling from a reference page, where no pack is open', async () => {
    const { db, repos, xMen, doom } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    const { user } = renderApp('/references/the-snap-avengers', db);

    await user.click(await screen.findByRole('button', { name: /File in pack/ }));
    const sheet = screen.getByRole('dialog', { name: /in a pack/ });
    await user.click(await within(sheet).findByRole('button', { name: 'Before the Doom movie' }));

    await waitFor(async () =>
      expect((await repos.packs.packsOf('the-snap-avengers')).map((p) => p.id).sort()).toEqual(
        [xMen.id, doom.id].sort(),
      ),
    );
  });

  it('lists the packs a card is already in without letting it be filed there again', async () => {
    const { db, repos, xMen } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    const { user } = renderApp(packPage(xMen.id), db);

    const controls = await screen.findByRole('group', { name: 'The snap (Avengers)' });
    await user.click(within(controls).getByRole('button', { name: 'Move' }));
    const sheet = screen.getByRole('dialog', { name: /to another pack/ });
    expect(await within(sheet).findByRole('button', { name: /Filed here/ })).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: 'Before the Doom movie' })).toBeEnabled();
  });

  it('removes a card from the pack, keeps the reference, and moves focus to the heading', async () => {
    const { db, repos, xMen } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    const { user } = renderApp(packPage(xMen.id), db);

    const controls = await screen.findByRole('group', { name: 'The snap (Avengers)' });
    await user.click(within(controls).getByRole('button', { name: 'Move' }));
    await user.click(screen.getByRole('button', { name: 'Remove from this pack' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Before X-Men' })).toHaveFocus(),
    );
    expect(await repos.packs.members(xMen.id)).toEqual([]);
    expect(await db.references.get('the-snap-avengers')).toBeDefined();
  });

  it('opens a linked pack on "This pack", even from another pack showing all packs', async () => {
    const { db, repos, xMen, doom } = await withPacks();
    await repos.packs.fileCard('ok-boomer', doom.id, 0);
    const { user } = renderApp(packPage(xMen.id), db);

    await user.click(await screen.findByRole('radio', { name: 'All packs' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search all packs' }), 'boomer');
    await user.click(await screen.findByRole('link', { name: 'Before the Doom movie' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Before the Doom movie' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'This pack' })).toBeChecked();
    // The query comes along in `q`, now searching the opened pack.
    expect(screen.getByRole('searchbox', { name: 'Search this pack' })).toHaveValue('boomer');
  });

  it('keeps a favourite that was never filed out of pack search', async () => {
    const { db, repos } = await withPacks();
    await repos.favourites.toggle('ok-boomer');
    const { user } = renderApp('/packs', db);

    await user.type(await screen.findByRole('searchbox', { name: 'Search all packs' }), 'boomer');
    expect(await screen.findByText('Nothing in your packs.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /OK boomer/i })).not.toBeInTheDocument();
  });

  it('reorders with Up and Down', async () => {
    const { db, repos, xMen } = await withPacks();
    await repos.packs.fileCard('ok-boomer', xMen.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', xMen.id, Infinity);
    const { user } = renderApp(packPage(xMen.id), db);

    const controls = await screen.findByRole('group', { name: "D'oh! (The Simpsons)" });
    await user.click(within(controls).getByRole('button', { name: 'Up' }));
    await waitFor(async () =>
      expect((await repos.packs.members(xMen.id)).map((m) => m.referenceId)).toEqual([
        'doh-simpsons',
        'ok-boomer',
      ]),
    );
  });

  it('moves a card dragged out of this pack onto another pack row, like the Move sheet', async () => {
    const { db, repos, xMen, doom } = await withPacks();
    await repos.packs.fileCard('ok-boomer', xMen.id, 0);
    renderApp(packPage(xMen.id), db);

    const row = (await screen.findByRole('link', { name: /Before the Doom movie/ })).closest('li');
    if (!row) throw new Error('the pack row is missing');
    const data: Record<string, string> = {
      [REFERENCE_DRAG_TYPE]: 'ok-boomer',
      [FROM_PACK_DRAG_TYPE]: xMen.id,
    };
    fireEvent.drop(row, {
      dataTransfer: { types: Object.keys(data), getData: (type: string) => data[type] ?? '' },
    });

    await waitFor(async () =>
      expect((await repos.packs.members(doom.id)).map((m) => m.referenceId)).toEqual(['ok-boomer']),
    );
    expect(await repos.packs.members(xMen.id)).toEqual([]);
  });

  it('shows every pack a card is in, and a chip opens that pack', async () => {
    const { db, repos, xMen, doom } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    await repos.packs.fileCard('the-snap-avengers', doom.id, 0);
    const { user } = renderApp('/references/the-snap-avengers', db);

    expect(await screen.findByText('In your packs:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Before X-Men' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Before the Doom movie' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Before the Doom movie' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 card · My spoiler setting')).toBeInTheDocument();
  });

  it('shows no pack chips for a card in no pack', async () => {
    renderApp('/references/the-snap-avengers');
    expect(await screen.findByRole('heading', { level: 1, name: SNAP })).toBeInTheDocument();
    expect(screen.queryByText('In your packs:')).not.toBeInTheDocument();
  });

  it('keeps the ending hidden for a card opened from a "before you watch" pack until asked', async () => {
    const { db, repos, xMen } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    const { user } = renderApp(packPage(xMen.id), db);

    await user.click(await screen.findByRole('link', { name: SNAP }));
    expect(
      await screen.findByText('Filed for before you watch. The ending stays hidden.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Make something vanish instantly.')).toBeInTheDocument();
    expect(screen.queryByText(/half of all living things/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal spoiler' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem(OPEN_PACK_KEY)).toBe(xMen.id);

    await user.click(screen.getByRole('button', { name: 'Show the ending anyway' }));
    expect(await screen.findByText(/half of all living things/)).toBeInTheDocument();
    // For this visit only: the reader's spoiler setting is untouched.
    expect(await repos.settings.getAll()).toEqual([]);
  });

  it('keeps the ceiling after a refresh, from the pack stored for this tab', async () => {
    const { db, repos, xMen } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    sessionStorage.setItem(OPEN_PACK_KEY, xMen.id);
    // A refresh with no history state behind it: only the stored pack says where it came from.
    renderApp('/references/the-snap-avengers', db);
    expect(
      await screen.findByText('Filed for before you watch. The ending stays hidden.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/half of all living things/)).not.toBeInTheDocument();
  });

  it('forgets the pack when a card is opened from Search', async () => {
    const { db, repos, xMen } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    sessionStorage.setItem(OPEN_PACK_KEY, xMen.id);
    const { user } = renderApp('/search?q=the%20snap', db);

    const [card] = await screen.findAllByRole('link', { name: SNAP });
    await user.click(card);
    expect(await screen.findByRole('heading', { level: 1, name: SNAP })).toBeInTheDocument();
    expect(sessionStorage.getItem(OPEN_PACK_KEY)).toBeNull();
    expect(screen.queryByText(/The ending stays hidden/)).not.toBeInTheDocument();
  });

  it('searches this pack only, or every pack with the Now pack first', async () => {
    const { db, repos, xMen, doom } = await withPacks();
    await repos.packs.fileCard('the-snap-avengers', xMen.id, 0);
    await repos.packs.fileCard('ok-boomer', doom.id, 0);
    await repos.packs.setNow(doom.id);
    const { user } = renderApp(packPage(xMen.id), db);

    await user.type(await screen.findByRole('searchbox', { name: 'Search this pack' }), 'boomer');
    expect(await screen.findByText('Nothing in this pack.')).toBeInTheDocument();
    const lookUp = screen.getByRole('link', { name: 'Look up' });
    expect(lookUp).toHaveAttribute('href', '/search?q=boomer');

    await user.click(screen.getByRole('radio', { name: 'All packs' }));
    expect(await screen.findByRole('link', { name: /OK boomer/i })).toBeInTheDocument();
    expect(screen.queryByText('Nothing in your packs.')).not.toBeInTheDocument();
  });
});
