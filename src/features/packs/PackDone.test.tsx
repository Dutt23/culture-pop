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

describe('"I get this now"', () => {
  it('takes the card out of the pack list without counting or scoring anything', async () => {
    const { db, repos, pack, path } = await withPack();
    const { user } = renderApp(path, db);

    const controls = await screen.findByRole('group', { name: 'OK boomer' });
    await user.click(within(controls).getByRole('button', { name: 'I get this now' }));

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
    const fold = (await screen.findByText('Cards you get')).closest('details');
    expect(fold).not.toHaveAttribute('open');
    await user.click(screen.getByText('Cards you get'));
    expect(fold).toHaveAttribute('open');
    const done = screen.getByRole('list', { name: 'Cards you get' });
    expect(within(done).getByRole('link', { name: /OK boomer/ })).toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: 'Put back OK boomer' }));

    expect(await screen.findByRole('group', { name: 'OK boomer' })).toBeInTheDocument();
    expect(screen.queryByText('Cards you get')).not.toBeInTheDocument();
    expect((await repos.packs.members(pack.id)).map((m) => [m.referenceId, m.doneAt])).toEqual([
      ['doh-simpsons', undefined],
      ['ok-boomer', undefined],
    ]);
  });

  it('moves cards still to learn with Up and Down while a done card stays last', async () => {
    const { db, repos, pack, path } = await withPack();
    await repos.packs.fileCard('the-snap-avengers', pack.id, 0);
    await repos.packs.markDone(pack.id, 'the-snap-avengers');
    const { user } = renderApp(path, db);

    const controls = await screen.findByRole('group', { name: 'OK boomer' });
    await user.click(within(controls).getByRole('button', { name: 'Down' }));
    await waitFor(async () =>
      expect((await repos.packs.members(pack.id)).map((m) => m.referenceId)).toEqual([
        'doh-simpsons',
        'ok-boomer',
        'the-snap-avengers',
      ]),
    );
    // The last card still to learn cannot move down past the done one.
    await waitFor(() =>
      expect(within(controls).getByRole('button', { name: 'Down' })).toHaveAttribute(
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
