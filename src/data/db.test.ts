import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { groupBy } from '../domain/collections';
import { needsRetrieval } from '../domain/eligibility';
import { rankReferences } from '../domain/ranking';
import { retrieve } from '../services/retrieval/retrieve';
import { FIXED_NOW, fixtureGetJson } from '../test/fakeRetrieval';
import { makeCandidate, makeReference, makeSource } from '../test/factories';
import { createTestDatabase } from '../test/renderApp';
import { isFromOnline } from '../domain/types';
import {
  createDatabase,
  SCHEMA_V1,
  SCHEMA_V2_CHANGES,
  SCHEMA_V4_CHANGES,
  SCHEMA_V5_CHANGES,
  SCHEMA_V6_CHANGES,
  SCHEMA_V8_CHANGES,
  type PopCultureDb,
} from './db';
import { createRepositories } from './repositories';
import { buildSeed } from './seed';
import { PACK_1_DEFINITIONS } from './seedPack1';
import { PACK_2_DEFINITIONS } from './seedPack2';
import { PACK_3_DEFINITIONS } from './seedPack3';
import { CHAINSMOKERS_DEFINITIONS, CHAINSMOKERS_PACK } from './seedPackChainsmokers';
import { DOOMSDAY_DEFINITIONS, DOOMSDAY_PACK } from './seedPackDoomsday';

describe('database', () => {
  it('starts fresh databases with an interpretations store and no meanings store', async () => {
    const db = createTestDatabase();
    await db.open();

    const tables = db.tables.map((t) => t.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'references',
        'interpretations',
        'aliases',
        'sources',
        'favourites',
        'settings',
      ]),
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

describe('schema upgrades', () => {
  it('upgrades a real v1 database, backfilling kind and keeping user data', async () => {
    const name = `upgrade-${Math.random().toString(36).slice(2)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    const legacy = {
      title: 'x',
      normalizedTitle: 'x',
      category: 'cartoon',
      tags: [],
      editorialState: 'demo',
      createdAt: 't',
      updatedAt: 't',
    };
    await v1.table('references').bulkAdd([
      { ...legacy, id: 'doh-simpsons' },
      { ...legacy, id: 'legacy-unknown' },
    ]);
    await v1.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    v1.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.references.get('doh-simpsons')).toMatchObject({ kind: 'quote', sourceIds: [] });
    expect(await db.references.get('legacy-unknown')).toMatchObject({
      kind: 'other',
      sourceIds: [],
    });
    expect(await db.favourites.count()).toBe(1);
    // v7 refreshes the built-in entries; a row the seed doesn't know is kept as it was.
    expect(await db.references.count()).toBe(buildSeed().references.length + 1);
    db.close();
  });

  it('upgrades a real v2 database: relations backfilled, cached results curated from their sources', async () => {
    const name = `upgrade-v2-${Math.random().toString(36).slice(2)}`;
    const v2 = new Dexie(name);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).stores(SCHEMA_V2_CHANGES);
    await v2.open();
    const stamp = { createdAt: 't', updatedAt: 't', tags: [] };
    await v2.table('references').bulkAdd([
      {
        ...stamp,
        id: 'doh-simpsons',
        title: "D'oh!",
        normalizedTitle: 'doh',
        category: 'cartoon',
        kind: 'quote',
        sourceIds: [],
        editorialState: 'demo',
      },
      {
        ...stamp,
        id: 'wd:Q83495',
        title: 'The Matrix',
        normalizedTitle: 'the matrix',
        category: 'film',
        kind: 'work',
        year: 1999,
        yearSourceId: 'src:wd:Q83495',
        sourceIds: ['src:wd:Q83495'],
        editorialState: 'retrieved',
      },
      {
        ...stamp,
        id: 'enwiki:5',
        title: 'Someone',
        normalizedTitle: 'someone',
        category: 'other',
        kind: 'other',
        sourceIds: [],
        editorialState: 'retrieved',
      },
    ]);
    await v2.table('interpretations').add({
      id: 'doh-simpsons.1',
      referenceId: 'doh-simpsons',
      label: 'L',
      summary: 'S',
      context: 'C',
      usageExample: 'E',
      spoiler: 'none',
      sourceIds: [],
      provenance: 'seed_curated',
      evidence: 'unverified',
      selection: null,
      createdAt: 't',
      updatedAt: 't',
    });
    await v2.table('sources').add(wikidataSource('Q83495'));
    await v2.table('favourites').add({ referenceId: 'wd:Q83495', savedAt: 't' });
    v2.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    // The built-in meaning is replaced by the current seed (v7), glance lines included.
    expect(await db.interpretations.get('doh-simpsons.1')).toMatchObject({
      relation: 'original',
      gist: expect.any(String),
    });
    expect(await db.references.get('wd:Q83495')).toMatchObject({
      editorialState: 'source_curated',
    });
    expect(await db.interpretations.get('wd:Q83495#original')).toMatchObject({
      summary: '“The Matrix” is a 1999 film (Wikidata).',
      sourceIds: ['src:wd:Q83495'],
      provenance: 'source_supported',
      evidence: 'supported',
    });
    // Nothing to template: stays an unexplained cached result.
    expect(await db.references.get('enwiki:5')).toMatchObject({ editorialState: 'retrieved' });
    expect(await db.interpretations.where('referenceId').equals('enwiki:5').count()).toBe(0);
    expect(await db.favourites.count()).toBe(1);
    expect(await db.references.count()).toBe(buildSeed().references.length + 2);
    db.close();
  });

  it('upgrades a real v3 database: adds an empty search history and keeps everything else', async () => {
    const name = `upgrade-v3-${Math.random().toString(36).slice(2)}`;
    const v3 = new Dexie(name);
    v3.version(1).stores(SCHEMA_V1);
    v3.version(2).stores(SCHEMA_V2_CHANGES);
    v3.version(3).stores({});
    await v3.open();
    const stamp = { createdAt: 't', updatedAt: 't', tags: [] };
    await v3.table('references').add({
      ...stamp,
      id: 'doh-simpsons',
      title: "D'oh!",
      normalizedTitle: 'doh',
      category: 'cartoon',
      kind: 'quote',
      sourceIds: [],
      editorialState: 'demo',
    });
    await v3.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    await v3.table('settings').add({ key: 'theme', value: 'dark' });
    v3.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(db.tables.map((t) => t.name)).toContain('searchHistory');
    expect(await db.searchHistory.count()).toBe(0);
    expect(await db.references.count()).toBe(buildSeed().references.length);
    expect(await db.favourites.count()).toBe(1);
    expect(await db.settings.toArray()).toEqual([{ key: 'theme', value: 'dark' }]);
    db.close();
  });

  it('upgrades a real v5 database: adds an empty saved links store and keeps everything else', async () => {
    const name = `upgrade-v5-${Math.random().toString(36).slice(2)}`;
    const v5 = new Dexie(name);
    v5.version(1).stores(SCHEMA_V1);
    v5.version(2).stores(SCHEMA_V2_CHANGES);
    v5.version(3).stores({});
    v5.version(4).stores(SCHEMA_V4_CHANGES);
    v5.version(5).stores(SCHEMA_V5_CHANGES);
    await v5.open();
    await v5.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    await v5.table('settings').add({ key: 'theme', value: 'dark' });
    await v5.table('webResults').add({ key: 'ferrari fans', savedAt: 1, results: [] });
    v5.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(db.tables.map((t) => t.name)).toContain('savedLinks');
    expect(await db.savedLinks.count()).toBe(0);
    expect(await db.favourites.count()).toBe(1);
    expect(await db.settings.toArray()).toEqual([{ key: 'theme', value: 'dark' }]);
    expect(await db.webResults.count()).toBe(1);
    db.close();
  });

  it('upgrades a real v6 database: built-in entries gain glance lines, reader data is kept', async () => {
    const name = `upgrade-v6-${Math.random().toString(36).slice(2)}`;
    const v6 = new Dexie(name);
    v6.version(1).stores(SCHEMA_V1);
    v6.version(2).stores(SCHEMA_V2_CHANGES);
    v6.version(3).stores({});
    v6.version(4).stores(SCHEMA_V4_CHANGES);
    v6.version(5).stores(SCHEMA_V5_CHANGES);
    v6.version(6).stores(SCHEMA_V6_CHANGES);
    await v6.open();
    const seed = buildSeed();
    // A v6 install: built-in rows without glance lines, plus things the reader made.
    await v6.table('interpretations').bulkAdd(
      seed.interpretations.map((i) => ({
        ...i,
        gist: undefined,
        socialMove: undefined,
        reply: undefined,
      })),
    );
    await v6.table('references').bulkAdd(seed.references);
    await v6.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    await v6.table('savedLinks').add({ url: 'https://example.test/', title: 'x', savedAt: 't' });
    v6.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.interpretations.get('doh-simpsons.1')).toMatchObject({
      gist: 'Ugh, I just did something stupid.',
      socialMove: "They're laughing at their own mistake.",
    });
    expect(await db.references.count()).toBe(seed.references.length);
    expect(await db.favourites.count()).toBe(1);
    expect(await db.savedLinks.count()).toBe(1);
    db.close();
  });

  it('upgrades a real v7 database: adds empty packs and members, references untouched', async () => {
    const name = `upgrade-v7-${Math.random().toString(36).slice(2)}`;
    const v7 = new Dexie(name);
    v7.version(1).stores(SCHEMA_V1);
    v7.version(2).stores(SCHEMA_V2_CHANGES);
    v7.version(3).stores({});
    v7.version(4).stores(SCHEMA_V4_CHANGES);
    v7.version(5).stores(SCHEMA_V5_CHANGES);
    v7.version(6).stores(SCHEMA_V6_CHANGES);
    v7.version(7).stores({});
    await v7.open();
    const seed = buildSeed();
    // A v7 install: the current built-in rows, a cached online result and a favourite.
    await v7
      .table('references')
      .bulkAdd([
        ...seed.references,
        makeReference('wd:Q1', 'Zzqx', { editorialState: 'retrieved' }),
      ]);
    await v7.table('interpretations').bulkAdd(seed.interpretations);
    await v7.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    const before = await v7.table('references').toArray();
    v7.close();

    const db = createDatabase(name, { readyPack: false });
    await db.open();
    expect(db.verno).toBe(15);
    expect(db.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['packs', 'packMembers']));
    expect(await db.packs.count()).toBe(0);
    expect(await db.packMembers.count()).toBe(0);
    expect(await db.references.toArray()).toEqual(before);
    expect(await db.favourites.count()).toBe(1);
    db.close();
  });

  it('upgrades a real v8 database: adds the pack batch 1 cards, keeps packs and favourites', async () => {
    const name = `upgrade-v8-${Math.random().toString(36).slice(2)}`;
    const v8 = new Dexie(name);
    v8.version(1).stores(SCHEMA_V1);
    v8.version(2).stores(SCHEMA_V2_CHANGES);
    v8.version(3).stores({});
    v8.version(4).stores(SCHEMA_V4_CHANGES);
    v8.version(5).stores(SCHEMA_V5_CHANGES);
    v8.version(6).stores(SCHEMA_V6_CHANGES);
    v8.version(7).stores({});
    v8.version(8).stores(SCHEMA_V8_CHANGES);
    await v8.open();
    const seed = buildSeed();
    const batch = new Set(PACK_1_DEFINITIONS.map((def) => def.id));
    // A v8 install: the built-in rows from before batch 1, plus a pack and a favourite.
    await v8.table('references').bulkAdd(seed.references.filter((r) => !batch.has(r.id)));
    await v8
      .table('interpretations')
      .bulkAdd(seed.interpretations.filter((i) => !batch.has(i.referenceId)));
    await v8.table('aliases').bulkAdd(seed.aliases.filter((a) => !batch.has(a.referenceId)));
    await v8.table('packs').add({
      id: 'pack:1',
      name: 'Mine',
      normalizedName: 'mine',
      ceiling: 'open',
      now: false,
      createdAt: 't',
      updatedAt: 't',
    });
    await v8
      .table('packMembers')
      .add({ id: 'pm:1', packId: 'pack:1', referenceId: 'ok-boomer', position: 0, addedAt: 't' });
    await v8.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    v8.close();

    const db = createDatabase(name, { readyPack: false });
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.references.count()).toBe(seed.references.length);
    expect(await db.interpretations.count()).toBe(seed.interpretations.length);
    expect(await db.aliases.count()).toBe(seed.aliases.length);
    expect(await db.packMembers.toArray()).toEqual([
      expect.objectContaining({ packId: 'pack:1', referenceId: 'ok-boomer' }),
    ]);
    expect(await db.favourites.count()).toBe(1);
    db.close();
  });

  it('upgrades a real v9 database: adds the pack batch 2 cards, keeps packs and favourites', async () => {
    const name = `upgrade-v9-${Math.random().toString(36).slice(2)}`;
    const v9 = new Dexie(name);
    v9.version(1).stores(SCHEMA_V1);
    v9.version(2).stores(SCHEMA_V2_CHANGES);
    v9.version(3).stores({});
    v9.version(4).stores(SCHEMA_V4_CHANGES);
    v9.version(5).stores(SCHEMA_V5_CHANGES);
    v9.version(6).stores(SCHEMA_V6_CHANGES);
    v9.version(7).stores({});
    v9.version(8).stores(SCHEMA_V8_CHANGES);
    v9.version(9).stores({});
    await v9.open();
    const seed = buildSeed();
    const batch = new Set(PACK_2_DEFINITIONS.map((def) => def.id));
    // A v9 install: the built-in rows from before batch 2, plus a pack member and a favourite.
    await v9.table('references').bulkAdd(seed.references.filter((r) => !batch.has(r.id)));
    await v9
      .table('interpretations')
      .bulkAdd(seed.interpretations.filter((i) => !batch.has(i.referenceId)));
    await v9.table('aliases').bulkAdd(seed.aliases.filter((a) => !batch.has(a.referenceId)));
    await v9
      .table('packMembers')
      .add({ id: 'pm:1', packId: 'pack:1', referenceId: 'ok-boomer', position: 0, addedAt: 't' });
    await v9.table('favourites').add({ referenceId: 'doh-simpsons', savedAt: 't' });
    v9.close();

    const db = createDatabase(name, { readyPack: false });
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.references.count()).toBe(seed.references.length);
    expect(await db.interpretations.count()).toBe(seed.interpretations.length);
    expect(await db.aliases.count()).toBe(seed.aliases.length);
    expect(await db.packMembers.count()).toBe(1);
    expect(await db.favourites.count()).toBe(1);
    db.close();
  });

  it('upgrades a real v10 database: files the built-in Pokémon entry as anime and nothing else', async () => {
    const name = `upgrade-v10-${Math.random().toString(36).slice(2)}`;
    const v10 = new Dexie(name);
    v10.version(1).stores(SCHEMA_V1);
    v10.version(2).stores(SCHEMA_V2_CHANGES);
    v10.version(3).stores({});
    v10.version(4).stores(SCHEMA_V4_CHANGES);
    v10.version(5).stores(SCHEMA_V5_CHANGES);
    v10.version(6).stores(SCHEMA_V6_CHANGES);
    v10.version(7).stores({});
    v10.version(8).stores(SCHEMA_V8_CHANGES);
    v10.version(9).stores({});
    v10.version(10).stores({});
    await v10.open();
    // A v10 install: built-in rows still filed as cartoons, and a saved online result.
    await v10
      .table('references')
      .bulkAdd(
        buildSeed().references.map((r) =>
          r.category === 'anime' ? { ...r, category: 'cartoon' } : r,
        ),
      );
    await v10.table('references').add(
      makeReference('wd:Q239937', 'Saved cartoon', {
        category: 'cartoon',
        editorialState: 'source_curated',
      }),
    );
    await v10.table('favourites').add({ referenceId: 'i-choose-you-pokemon', savedAt: 't' });
    v10.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.references.get('i-choose-you-pokemon')).toMatchObject({ category: 'anime' });
    expect(await db.references.get('doh-simpsons')).toMatchObject({ category: 'cartoon' });
    // A saved online result can't be re-filed without asking Wikidata again, so it stays.
    expect(await db.references.get('wd:Q239937')).toMatchObject({ category: 'cartoon' });
    expect(await db.favourites.count()).toBe(1);
    db.close();
  });

  it('upgrades a real v11 database: adds batch 3 and the ready-made packs with their cards', async () => {
    const name = `upgrade-v11-${Math.random().toString(36).slice(2)}`;
    const v11 = new Dexie(name);
    v11.version(1).stores(SCHEMA_V1);
    v11.version(2).stores(SCHEMA_V2_CHANGES);
    v11.version(3).stores({});
    v11.version(4).stores(SCHEMA_V4_CHANGES);
    v11.version(5).stores(SCHEMA_V5_CHANGES);
    v11.version(6).stores(SCHEMA_V6_CHANGES);
    v11.version(7).stores({});
    v11.version(8).stores(SCHEMA_V8_CHANGES);
    v11.version(9).stores({});
    v11.version(10).stores({});
    v11.version(11).stores({});
    await v11.open();
    const seed = buildSeed();
    const batch = new Set(
      [...PACK_3_DEFINITIONS, ...DOOMSDAY_DEFINITIONS, ...CHAINSMOKERS_DEFINITIONS].map(
        (def) => def.id,
      ),
    );
    // A v11 install: the built-in rows from before v12, plus the reader's own pack.
    await v11.table('references').bulkAdd(seed.references.filter((r) => !batch.has(r.id)));
    await v11
      .table('interpretations')
      .bulkAdd(seed.interpretations.filter((i) => !batch.has(i.referenceId)));
    await v11.table('aliases').bulkAdd(seed.aliases.filter((a) => !batch.has(a.referenceId)));
    await v11.table('packs').add({
      id: 'pack:1',
      name: 'Mine',
      normalizedName: 'mine',
      ceiling: 'open',
      now: true,
      createdAt: 't',
      updatedAt: 't',
    });
    await v11
      .table('packMembers')
      .add({ id: 'pm:1', packId: 'pack:1', referenceId: 'ok-boomer', position: 0, addedAt: 't' });
    v11.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.references.count()).toBe(seed.references.length);
    expect(await db.aliases.count()).toBe(seed.aliases.length);
    expect(await db.packs.get(DOOMSDAY_PACK.id)).toMatchObject({
      name: 'Before Avengers: Doomsday',
      ceiling: 'before_watching',
      now: false,
    });
    for (const pack of [DOOMSDAY_PACK, CHAINSMOKERS_PACK]) {
      const members = await db.packMembers.where('packId').equals(pack.id).sortBy('position');
      expect(members.map((m) => m.referenceId)).toEqual(pack.referenceIds);
      for (const id of pack.referenceIds) {
        expect(await db.references.get(id)).toBeDefined();
      }
    }
    // The reader's pack and its pin are untouched.
    expect(await db.packs.get('pack:1')).toMatchObject({ now: true });
    expect(await db.packMembers.where('packId').equals('pack:1').count()).toBe(1);
    db.close();
  });

  it('upgrades a v12 database with an empty draftCards table and keeps saved links', async () => {
    const name = `upgrade-v12-${Math.random().toString(36).slice(2)}`;
    const v12 = new Dexie(name);
    v12.version(1).stores(SCHEMA_V1);
    v12.version(2).stores(SCHEMA_V2_CHANGES);
    v12.version(3).stores({});
    v12.version(4).stores(SCHEMA_V4_CHANGES);
    v12.version(5).stores(SCHEMA_V5_CHANGES);
    v12.version(6).stores(SCHEMA_V6_CHANGES);
    v12.version(7).stores({});
    v12.version(8).stores(SCHEMA_V8_CHANGES);
    v12.version(9).stores({});
    v12.version(10).stores({});
    v12.version(11).stores({});
    v12.version(12).stores({});
    await v12.open();
    await v12.table('savedLinks').add({ url: 'https://example.com/a', title: 'A', savedAt: 't' });
    v12.close();

    const db = createDatabase(name, { readyPack: false });
    await db.open();
    expect(db.verno).toBe(15);
    expect(await db.draftCards.count()).toBe(0);
    expect(await db.savedLinks.count()).toBe(1);
    db.close();
  });

  it('upgrades a v14 database to v15 keeping its jobs and making the new indexes queryable', async () => {
    const name = `upgrade-v14-${Math.random().toString(36).slice(2)}`;
    const v14 = new Dexie(name);
    v14.version(1).stores(SCHEMA_V1);
    v14.version(2).stores(SCHEMA_V2_CHANGES);
    v14.version(3).stores({});
    v14.version(4).stores(SCHEMA_V4_CHANGES);
    v14.version(5).stores(SCHEMA_V5_CHANGES);
    v14.version(6).stores(SCHEMA_V6_CHANGES);
    v14.version(7).stores({});
    v14.version(8).stores(SCHEMA_V8_CHANGES);
    v14.version(9).stores({});
    v14.version(10).stores({});
    v14.version(11).stores({});
    v14.version(12).stores({});
    v14.version(13).stores({ draftCards: 'id, savedAt' });
    v14.version(14).stores({ curationJobs: 'id, status, createdAt, ownerId' });
    await v14.open();
    await v14.table('curationJobs').bulkPut([
      {
        id: 'job-1',
        status: 'completed',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-02T00:00:00.000Z',
      },
      {
        id: 'job-2',
        status: 'running',
        createdAt: '2026-11-03T00:00:00.000Z',
        updatedAt: '2026-11-04T00:00:00.000Z',
      },
    ]);
    await v14.table('references').bulkPut([
      makeReference('cached', 'Cached', { editorialState: 'retrieved', updatedAt: '2026-11-05' }),
      makeReference('curated', 'Curated', {
        editorialState: 'published',
        updatedAt: '2026-11-06',
      }),
    ]);
    v14.close();

    const db = createDatabase(name, { readyPack: false });
    await db.open();
    expect(db.verno).toBe(15);
    expect((await db.curationJobs.toArray()).map((job) => job.id).sort()).toEqual([
      'job-1',
      'job-2',
    ]);
    expect(
      (await db.curationJobs.where('updatedAt').aboveOrEqual('2026-11-03').toArray()).map(
        (job) => job.id,
      ),
    ).toEqual(['job-2']);
    expect(await db.references.where('editorialState').equals('retrieved').primaryKeys()).toEqual([
      'cached',
    ]);
    expect(await db.references.orderBy('updatedAt').primaryKeys()).toEqual(['cached', 'curated']);
    db.close();
  });

  it('starts a fresh install with the ready-made pack, and never puts it back once deleted', async () => {
    const name = `fresh-${Math.random().toString(36).slice(2)}`;
    const db = createDatabase(name);
    await db.open();
    expect(await db.packMembers.where('packId').equals(DOOMSDAY_PACK.id).count()).toBe(
      DOOMSDAY_PACK.referenceIds.length,
    );
    await createRepositories(db).packs.deletePack(DOOMSDAY_PACK.id);
    db.close();

    const reopened = createDatabase(name);
    await reopened.open();
    expect(await reopened.packs.get(DOOMSDAY_PACK.id)).toBeUndefined();
    reopened.close();
  });
});

describe('search history store', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const T0 = Date.UTC(2026, 10, 15, 9);

  it('records through the domain rules and reads Recent and Frequent from the indexes', async () => {
    const db = createTestDatabase();
    await db.open();
    const { history } = createRepositories(db);
    await history.record({ text: 'point break' }, T0);
    await history.record({ text: 'point breakz' }, T0 + DAY);
    await history.record({ text: 'bazinga' }, T0 + 2 * DAY);

    expect((await history.recent(10, T0 + 2 * DAY)).map((e) => e.label)).toEqual([
      'bazinga',
      'point breakz',
    ]);
    expect((await history.frequent(10, T0 + 2 * DAY)).map((e) => e.id)).toEqual(['point break']);
    // Reads hide expired rows even before the next write prunes them.
    expect(await history.recent(10, T0 + 200 * DAY)).toEqual([]);
    db.close();
  });

  it('replaces an expired entry that has the same ID instead of failing the write', async () => {
    const db = createTestDatabase();
    await db.open();
    const { history } = createRepositories(db);
    await history.record({ text: 'bazinga' }, T0);
    await history.record({ text: 'bazinga' }, T0 + 100 * DAY);
    expect(await db.searchHistory.toArray()).toEqual([
      expect.objectContaining({ id: 'bazinga', count: 1, lastSearchedAt: T0 + 100 * DAY }),
    ]);
    db.close();
  });

  it('clears every stored row', async () => {
    const db = createTestDatabase();
    await db.open();
    const { history } = createRepositories(db);
    await history.record({ text: 'bazinga' }, T0);
    await history.clear();
    expect(await db.searchHistory.count()).toBe(0);
    db.close();
  });
});

describe('retrieval cache', () => {
  async function cacheMatrix() {
    const db = createTestDatabase();
    await db.open();
    const result = await retrieve('the matrix', {
      getJson: fixtureGetJson('the matrix'),
      now: () => FIXED_NOW,
    });
    await createRepositories(db).retrieval.saveCandidates(result.candidates);
    return { db, result };
  }

  it('stores candidates and citations as structured records, without the query', async () => {
    const { db } = await cacheMatrix();
    expect(await db.references.get('wd:Q83495')).toMatchObject({
      editorialState: 'source_curated',
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

  /** Spec §6 step 1 over what the search page ranks: everything except unexplained `retrieved` rows. */
  async function lookUp(db: PopCultureDb, query: string) {
    const { references, aliases, interpretations, sources, validSourceIds } =
      await createRepositories(db).references.getSearchIndex();
    const ranked = references.filter((r) => r.editorialState !== 'retrieved');
    const matches = rankReferences(query, ranked, aliases);
    const byReference = groupBy(interpretations, (i) => i.referenceId);
    return { matches, sources, needs: needsRetrieval(matches, byReference, validSourceIds) };
  }

  it('curates on save: a source-supported interpretation resolves the next lookup offline', async () => {
    const { db } = await cacheMatrix();
    expect(await db.interpretations.get('wd:Q83495#original')).toMatchObject({
      summary: '“The Matrix” is a 1999 film (Wikidata).',
      provenance: 'source_supported',
      evidence: 'supported',
    });
    const { matches, sources, needs } = await lookUp(db, 'the matrix');
    expect(sources.map((s) => s.id)).toEqual(expect.arrayContaining(['src:enwiki:30007']));
    expect(matches[0].reference.id).toBe('wd:Q83495');
    expect(needs).toBe(false);
    db.close();
  });

  it('never lets an unverified interpretation resolve a lookup', async () => {
    const db = createTestDatabase();
    await db.open();
    // Typed as a film, but the Wikidata record that states the type is not among its sources.
    await createRepositories(db).retrieval.saveCandidates([
      makeCandidate({
        id: 'wd:Q9',
        title: 'Zzqx film',
        kind: 'work',
        category: 'film',
        role: 'work',
      }),
    ]);
    expect(await db.interpretations.get('wd:Q9#original')).toMatchObject({
      provenance: 'unverified',
      evidence: 'unverified',
    });
    expect(await db.references.get('wd:Q9')).toMatchObject({ editorialState: 'retrieved' });
    expect((await lookUp(db, 'zzqx film')).needs).toBe(true);
    db.close();
  });

  it('stops resolving lookups once a cited source disappears', async () => {
    const { db } = await cacheMatrix();
    await db.sources.delete('src:wd:Q83495');
    expect((await lookUp(db, 'the matrix')).needs).toBe(true);
    db.close();
  });

  it('never overwrites editorial content with retrieved metadata', async () => {
    const db = createTestDatabase();
    await db.open();
    const curated = await db.references.get('ok-boomer');
    const meanings = await db.interpretations.where('referenceId').equals('ok-boomer').toArray();
    await createRepositories(db).retrieval.saveCandidates([
      makeCandidate({ id: 'ok-boomer', title: 'Overwritten' }),
    ]);
    expect(await db.references.get('ok-boomer')).toEqual(curated);
    expect(await db.interpretations.where('referenceId').equals('ok-boomer').toArray()).toEqual(
      meanings,
    );
    db.close();
  });

  it('re-curates when its sources change, keeping the interpretation ID and creation time', async () => {
    const { db } = await cacheMatrix();
    const before = await db.interpretations.get('wd:Q83495#original');
    // Same film, but this time Wikidata gave no year.
    await createRepositories(db).retrieval.saveCandidates([
      makeCandidate({
        id: 'wd:Q83495',
        title: 'The Matrix',
        kind: 'work',
        category: 'film',
        role: 'work',
        sources: [wikidataSource('Q83495')],
      }),
    ]);
    expect(await db.interpretations.get('wd:Q83495#original')).toMatchObject({
      summary: '“The Matrix” is a film (Wikidata).',
      createdAt: before?.createdAt,
    });
    expect(await db.interpretations.where('referenceId').equals('wd:Q83495').count()).toBe(1);
    db.close();
  });

  it('re-curates another cached result whose source a new save replaced', async () => {
    const db = createTestDatabase();
    await db.open();
    const repo = createRepositories(db).retrieval;
    const sense = (id: string) => ({
      id,
      url: 'https://en.wiktionary.org/wiki/zzqx',
      title: 'zzqx',
      publisher: 'Wiktionary',
      sourceType: 'dictionary' as const,
      retrievedAt: FIXED_NOW,
      license: 'CC BY-SA 4.0',
      excerpt: 'A test word.',
    });
    const entry = (id: string, sourceId: string) =>
      makeCandidate({
        id,
        title: 'zzqx',
        kind: 'phrase',
        category: 'saying',
        role: 'definition',
        sources: [sense(sourceId)],
      });
    await repo.saveCandidates([entry('enwiktionary:old', 'src:old')]);
    expect(await db.references.get('enwiktionary:old')).toMatchObject({
      editorialState: 'source_curated',
    });

    await repo.saveCandidates([entry('enwiktionary:new', 'src:new')]);

    expect(await db.references.get('enwiktionary:old')).toMatchObject({
      editorialState: 'retrieved',
    });
    expect(await db.interpretations.where('referenceId').equals('enwiktionary:old').count()).toBe(
      0,
    );
    expect(await db.references.get('enwiktionary:new')).toMatchObject({
      editorialState: 'source_curated',
    });
    db.close();
  });

  it('clears a cached year once a new save replaces the source that gave it', async () => {
    const db = createTestDatabase();
    await db.open();
    const repo = createRepositories(db).retrieval;
    const yearSource = wikidataSource('Q5');
    await repo.saveCandidates([
      makeCandidate({
        id: 'wd:Q5',
        title: 'Zzqx',
        kind: 'work',
        category: 'film',
        role: 'work',
        year: 1999,
        yearSourceId: yearSource.id,
        sources: [yearSource],
      }),
    ]);
    expect(await db.references.get('wd:Q5')).toMatchObject({ year: 1999 });

    // Another result brings the same page under a new ID, replacing the year's source.
    await repo.saveCandidates([
      makeCandidate({
        id: 'wd:Q6',
        title: 'Zzqx again',
        sources: [{ ...yearSource, id: 'src:wd:Q5-new' }],
      }),
    ]);

    const film = await db.references.get('wd:Q5');
    expect(film?.year).toBeUndefined();
    expect(film?.yearSourceId).toBeUndefined();
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

  it('clears cached results, their curated interpretations and sources, leaving editorial content alone', async () => {
    const { db } = await cacheMatrix();
    await createRepositories(db).retrieval.clear();
    expect(await db.references.filter((r) => isFromOnline(r.editorialState)).count()).toBe(0);
    expect(await db.sources.count()).toBe(0);
    expect(await db.references.count()).toBe(buildSeed().references.length);
    expect(await db.interpretations.count()).toBe(buildSeed().interpretations.length);
    db.close();
  });
});

function wikidataSource(qid: string) {
  return makeSource(`src:wd:${qid}`, 'Wikidata', {
    url: `https://www.wikidata.org/wiki/${qid}`,
    title: qid,
    sourceType: 'structured_data',
    license: 'CC0 1.0',
  });
}
