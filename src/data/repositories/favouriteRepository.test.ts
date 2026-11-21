import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/renderApp';
import { createRepositories } from './index';

async function setup() {
  const db = createTestDatabase();
  await db.open();
  return { db, repos: createRepositories(db) };
}

describe('favourites, paged reads (D69)', () => {
  it('lists only `limit` newest first and counts them all', async () => {
    const { db, repos } = await setup();
    await db.favourites.bulkPut([
      { referenceId: 'a', savedAt: '2026-11-14T09:00:00.000Z' },
      { referenceId: 'c', savedAt: '2026-11-16T09:00:00.000Z' },
      { referenceId: 'b', savedAt: '2026-11-15T09:00:00.000Z' },
    ]);
    expect((await repos.favourites.list()).map((f) => f.referenceId)).toEqual(['c', 'b', 'a']);
    expect((await repos.favourites.list(2)).map((f) => f.referenceId)).toEqual(['c', 'b']);
    expect(await repos.favourites.count()).toBe(3);
    db.close();
  });

  it('says which of the given references are favourites', async () => {
    const { db, repos } = await setup();
    await repos.favourites.toggle('a');
    await repos.favourites.toggle('b');
    expect(await repos.favourites.favouriteIds(['b', 'x', 'a'])).toEqual(new Set(['a', 'b']));
    expect(await repos.favourites.favouriteIds(['x'])).toEqual(new Set());
    expect(await repos.favourites.favouriteIds([])).toEqual(new Set());
    db.close();
  });
});
