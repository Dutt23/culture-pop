import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../test/renderApp';
import { createDatabase } from './db';
import { createRepositories } from './repositories';
import { buildSeed } from './seed';

describe('database', () => {
  it('starts fresh databases with an interpretations store and no meanings store', async () => {
    const db = createTestDatabase();
    await db.open();

    const tables = db.tables.map((t) => t.name);
    expect(tables).toEqual(
      expect.arrayContaining(['references', 'interpretations', 'aliases', 'sources', 'favourites', 'settings']),
    );
    expect(tables).not.toContain('meanings');
    db.close();
  });

  it('seeds the library on first open, stored as structured objects', async () => {
    const db = createTestDatabase();
    await db.open();

    const seed = buildSeed();
    expect(await db.references.count()).toBe(seed.references.length);
    expect(await db.interpretations.count()).toBe(seed.interpretations.length);
    const stored = await db.interpretations.get(seed.interpretations[0].id);
    expect(stored).toEqual(seed.interpretations[0]);
    expect(Array.isArray(stored?.sourceIds)).toBe(true);
    db.close();
  });

  it('allows one phrase for many references but not duplicate (phrase, reference) pairs', async () => {
    const db = createTestDatabase();
    await db.open();

    const shared = await db.aliases.where('normalizedPhrase').equals('let it go').toArray();
    expect(new Set(shared.map((a) => a.referenceId)).size).toBeGreaterThanOrEqual(2);

    const duplicate = { ...shared[0], id: 'duplicate-id' };
    await expect(db.aliases.add(duplicate)).rejects.toMatchObject({ name: 'ConstraintError' });
    db.close();
  });

  it('keeps favourites and settings across a close and reopen (reload)', async () => {
    const first = createTestDatabase();
    await first.open();
    const repos = createRepositories(first);
    expect(await repos.favourites.toggle('bazinga-big-bang-theory')).toBe(true);
    await repos.settings.set('theme', 'dark');
    first.close();

    const reopened = createDatabase(first.name);
    await reopened.open();
    const reopenedRepos = createRepositories(reopened);
    expect((await reopenedRepos.favourites.list()).map((f) => f.referenceId)).toEqual([
      'bazinga-big-bang-theory',
    ]);
    expect(await reopenedRepos.settings.getAll()).toEqual([{ key: 'theme', value: 'dark' }]);
    // Reopening must not re-seed or duplicate content.
    expect(await reopened.references.count()).toBe(buildSeed().references.length);
    reopened.close();
  });

  it('toggles a favourite off again', async () => {
    const db = createTestDatabase();
    await db.open();
    const { favourites } = createRepositories(db);
    await favourites.toggle('ok-boomer');
    expect(await favourites.toggle('ok-boomer')).toBe(false);
    expect(await favourites.list()).toEqual([]);
    db.close();
  });
});
