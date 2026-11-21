import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRepositories } from '../../data/repositories';
import { createTestDatabase, renderApp } from '../../test/renderApp';

async function withPack() {
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  const pack = await repos.packs.create({ name: 'Before X-Men', ceiling: 'open' });
  await repos.packs.fileCard('ok-boomer', pack.id, Infinity);
  await repos.packs.fileCard('doh-simpsons', pack.id, Infinity);
  return { db, repos, pack, path: `/packs/${encodeURIComponent(pack.id)}` };
}

describe('"Got it"', () => {
  it('takes the card out of the pack list without counting or scoring anything', async () => {
    const { db, repos, pack, path } = await withPack();
    const { user } = renderApp(path, db);

    const controls = await screen.findByRole('group', { name: 'OK boomer' });
    await user.click(within(controls).getByRole('button', { name: 'Got it' }));

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'OK boomer' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('group', { name: "D'oh! (The Simpsons)" })).toBeInTheDocument();
    // The control that had focus is gone: the page heading takes it.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Before X-Men' })).toHaveFocus(),
    );
    expect(screen.getByText('1 card · My spoiler setting')).toBeInTheDocument();
    expect(screen.queryByText(/streak|score|learned \d/i)).not.toBeInTheDocument();
    // Still filed: the reference and its member row stay.
    expect(await repos.packs.members(pack.id)).toMatchObject([
      { referenceId: 'doh-simpsons' },
      { referenceId: 'ok-boomer', doneAt: expect.any(String) },
    ]);
  });

  it('lists done cards out of the way, and "Put back" returns one to the pack', async () => {
    const { db, repos, pack, path } = await withPack();
    await repos.packs.markDone(pack.id, 'ok-boomer');
    const { user } = renderApp(path, db);

    // Folded away until asked for.
    const fold = (await screen.findByText("Cards you've got")).closest('details');
    expect(fold).not.toHaveAttribute('open');
    await user.click(screen.getByText("Cards you've got"));
    expect(fold).toHaveAttribute('open');
    const done = screen.getByRole('list', { name: "Cards you've got" });
    expect(within(done).getByRole('link', { name: /OK boomer/ })).toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: 'Put back OK boomer' }));

    expect(await screen.findByRole('group', { name: 'OK boomer' })).toBeInTheDocument();
    expect(screen.queryByText("Cards you've got")).not.toBeInTheDocument();
    expect((await repos.packs.members(pack.id)).map((m) => [m.referenceId, m.doneAt])).toEqual([
      ['doh-simpsons', undefined],
      ['ok-boomer', undefined],
    ]);
  });

  it('moves cards still to learn up and down the list while a done card stays last', async () => {
    const { db, repos, pack, path } = await withPack();
    await repos.packs.fileCard('the-snap-avengers', pack.id, 0);
    await repos.packs.markDone(pack.id, 'the-snap-avengers');
    const { user } = renderApp(path, db);

    const controls = await screen.findByRole('group', { name: 'OK boomer' });
    await user.click(within(controls).getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Move down the list' }));
    await waitFor(async () =>
      expect((await repos.packs.members(pack.id)).map((m) => m.referenceId)).toEqual([
        'doh-simpsons',
        'ok-boomer',
        'the-snap-avengers',
      ]),
    );
    // The last card still to learn cannot move down past the done one.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Move down the list' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
  });

  it('says so when every card in the pack is done', async () => {
    const { db, repos, pack, path } = await withPack();
    await repos.packs.markDone(pack.id, 'ok-boomer');
    await repos.packs.markDone(pack.id, 'doh-simpsons');
    renderApp(path, db);

    expect(await screen.findByText('You get every card in this pack.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing in this pack.')).not.toBeInTheDocument();
  });
});

describe('the pack pass', () => {
  it('shows the pack with no count, and stamps it once every card is got', async () => {
    const { db, repos, pack, path } = await withPack();
    await repos.packs.markDone(pack.id, 'ok-boomer');
    const { user } = renderApp(path, db);

    const pass = await screen.findByRole('article', { name: 'Before X-Men' });
    expect(within(pass).getByText('Backstage pass')).toBeInTheDocument();
    expect(within(pass).queryByText(/\d+ of \d+/)).not.toBeInTheDocument();
    expect(within(pass).queryByText('All access')).not.toBeInTheDocument();

    const last = await screen.findByRole('group', { name: "D'oh! (The Simpsons)" });
    await user.click(within(last).getByRole('button', { name: 'Got it' }));
    // A new pass replaces the old one (so it can swing in): look it up again, not the old one.
    await waitFor(() =>
      expect(
        within(screen.getByRole('article', { name: 'Before X-Men' })).getByText('All access'),
      ).toBeInTheDocument(),
    );
  });
});
