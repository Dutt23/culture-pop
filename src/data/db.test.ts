import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { groupBy } from '../domain/collections';
import { needsRetrieval } from '../domain/eligibility';
import { rankReferences } from '../domain/ranking';
import { retrieve } from '../services/retrieval/retrieve';
import { FIXED_NOW, fixtureGetJson } from '../test/fakeRetrieval';
import { createTestDatabase } from '../test/renderApp';
import { createDatabase, SCHEMA_V1 } from './db';
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

describe('schema v2 upgrade', () => {
  it('upgrades a real v1 database, backfilling kind and keeping user data', async () => {
    const name = `upgrade-${Math.random().toString(36).slice(2)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    const legacy = { title: 'x', normalizedTitle: 'x', category: 'cartoon', tags: [], editorialState: 'demo', createdAt: 't', updatedAt: 't' };
    await v1.table('references').bulkAdd([
      { ...legacy, id: 'doh-simpsons' },
      { ...legacy, id: 'legacy-unknown' },
    ]);
    await v1.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    v1.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect(await db.references.get('doh-simpsons')).toMatchObject({ kind: 'quote', sourceIds: [] });
    expect(await db.references.get('legacy-unknown')).toMatchObject({ kind: 'other', sourceIds: [] });
    expect(await db.favourites.count()).toBe(1);
    // Upgrading must not re-seed: populate only runs for brand-new databases.
    expect(await db.references.count()).toBe(2);
    expect(await db.references.where('kind').equals('quote').count()).toBe(1);
    db.close();
  });
});

describe('retrieval cache', () => {
  async function cacheMatrix() {
    const db = createTestDatabase();
    await db.open();
    const result = await retrieve('the matrix', { getJson: fixtureGetJson('the matrix'), now: () => FIXED_NOW });
    await createRepositories(db).retrieval.saveCandidates(result.candidates);
    return { db, result };
  }

  it('stores candidates and citations as structured records, without the query', async () => {
    const { db } = await cacheMatrix();
    expect(await db.references.get('wd:Q83495')).toMatchObject({
      editorialState: 'retrieved',
      category: 'film',
      year: 1999,
      yearSourceId: 'src:wd:Q83495',
      sourceIds: ['src:enwiki:30007', 'src:wd:Q83495'],
    });
    expect(await db.sources.get('src:enwiki:30007')).toMatchObject({
      url: 'https://en.wikipedia.org/wiki/The_Matrix',
      license: 'CC BY-SA 4.0',
    });
    // No query history: aliases and settings are untouched by retrieval.
    expect(await db.aliases.where('normalizedPhrase').equals('the matrix').count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
    db.close();
  });

  it('never makes retrieved candidates cache-eligible, so online lookups still run', async () => {
    const { db } = await cacheMatrix();
    const { references, aliases, interpretations, sources, validSourceIds } =
      await createRepositories(db).references.getSearchIndex();
    expect(sources.map((s) => s.id)).toEqual(expect.arrayContaining(['src:enwiki:30007']));
    const matches = rankReferences('the matrix', references, aliases);
    expect(matches[0].reference.id).toBe('wd:Q83495');
    const byReference = groupBy(interpretations, (i) => i.referenceId);
    expect(needsRetrieval(matches, byReference, validSourceIds)).toBe(true);
    db.close();
  });

  it('never overwrites curated content with retrieved metadata', async () => {
    const db = createTestDatabase();
    await db.open();
    const curated = await db.references.get('ok-boomer');
    await createRepositories(db).retrieval.saveCandidates([
      {
        id: 'ok-boomer',
        title: 'Overwritten',
        kind: 'other',
        category: 'other',
        classifying: false,
        role: 'topic',
        externalLinks: [],
        sources: [],
      },
    ]);
    expect(await db.references.get('ok-boomer')).toEqual(curated);
    db.close();
  });

  it('replaces a stored source whose page came back under a new ID instead of failing the save', async () => {
    const { db, result } = await cacheMatrix();
    const film = result.candidates.find((c) => c.id === 'wd:Q83495');
    if (!film) throw new Error('fixture changed: The Matrix is missing');
    const [article] = film.sources;
    // The same URL (unique index) now arrives with a different page ID, e.g. a deleted and re-created page.
    const recreated = { ...film, sources: [{ ...article, id: 'src:enwiki:999' }] };

    await createRepositories(db).retrieval.saveCandidates([recreated]);

    expect(await db.sources.get(article.id)).toBeUndefined();
    expect(await db.sources.get('src:enwiki:999')).toMatchObject({ url: article.url });
    expect(await db.references.get('wd:Q83495')).toMatchObject({ sourceIds: ['src:enwiki:999'] });
    db.close();
  });

  it('clears cached results and their sources, leaving curated content alone', async () => {
    const { db } = await cacheMatrix();
    await createRepositories(db).retrieval.clear();
    expect(await db.references.filter((r) => r.editorialState === 'retrieved').count()).toBe(0);
    expect(await db.sources.count()).toBe(0);
    expect(await db.references.count()).toBe(buildSeed().references.length);
    db.close();
  });
});
