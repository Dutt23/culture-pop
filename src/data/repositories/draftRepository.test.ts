import { describe, expect, it } from 'vitest';
import type { DraftCard } from '../../../shared/cardTypes.js';
import { createTestDatabase } from '../../test/renderApp';
import type { DraftCardRecord } from './draftRepository';
import { createRepositories } from './index';

const CARD: DraftCard = {
  label: 'Bazinga',
  gist: 'A catchphrase.',
  means: 'Gotcha!',
  reply: 'Nice one.',
  summary: [],
  context: [],
  example: null,
  spoiler: 'none',
};

const record = (id: string, savedAt: string): DraftCardRecord => ({
  id,
  search: 'bazinga',
  card: CARD,
  sources: [{ from: 'library', title: 'Bazinga' }],
  promptVersion: 'v1',
  savedAt,
});

async function setup() {
  const db = createTestDatabase();
  await db.open();
  return { db, repos: createRepositories(db) };
}

describe('kept cards', () => {
  it('lists kept cards newest first', async () => {
    const { db, repos } = await setup();
    await repos.drafts.save(record('a', '2026-11-16T09:00:00.000Z'));
    await repos.drafts.save(record('b', '2026-11-17T09:00:00.000Z'));
    expect((await repos.drafts.list()).map((r) => r.id)).toEqual(['b', 'a']);
    await repos.drafts.remove('b');
    expect((await repos.drafts.list()).map((r) => r.id)).toEqual(['a']);
    db.close();
  });

  it('is deleted by Reset', async () => {
    const { db, repos } = await setup();
    await repos.drafts.save(record('a', '2026-11-16T09:00:00.000Z'));
    await repos.resetUserData();
    expect(await db.draftCards.count()).toBe(0);
    db.close();
  });

  it('is kept by Clear history', async () => {
    const { db, repos } = await setup();
    await repos.history.record({ text: 'bazinga' }, Date.parse('2026-11-16T09:00:00.000Z'));
    await repos.drafts.save(record('a', '2026-11-16T09:00:00.000Z'));
    await repos.history.clear();
    expect(await db.draftCards.count()).toBe(1);
    db.close();
  });
});

describe('kept cards, paged reads (D69)', () => {
  it('lists only `limit` newest, counts them all, and says which ids are kept', async () => {
    const { db, repos } = await setup();
    await repos.drafts.save(record('a', '2026-11-16T09:00:00.000Z'));
    await repos.drafts.save(record('c', '2026-11-18T09:00:00.000Z'));
    await repos.drafts.save(record('b', '2026-11-17T09:00:00.000Z'));
    expect((await repos.drafts.list(2)).map((r) => r.id)).toEqual(['c', 'b']);
    expect(await repos.drafts.count()).toBe(3);
    expect(await repos.drafts.kept(['a', 'missing', 'c'])).toEqual(new Set(['a', 'c']));
    expect(await repos.drafts.kept([])).toEqual(new Set());
    db.close();
  });
});
