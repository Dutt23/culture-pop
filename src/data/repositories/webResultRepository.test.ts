import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import type { DeviceResult, EphemeralResult } from '../../services/retrieval/webSearch';
import { createTestDatabase } from '../../test/renderApp';
import { createDatabase, SCHEMA_V1, SCHEMA_V2_CHANGES, SCHEMA_V4_CHANGES } from '../db';
import { createRepositories } from './index';
import { WEB_RESULTS_TTL_MS } from './webResultRepository';

const T0 = Date.UTC(2026, 10, 16, 9);
const FIELDS = {
  title: 'Why are Ferrari fans always sad?',
  url: 'https://www.reddit.com/r/formula1/comments/abc/',
  snippet: 'Because the team keeps throwing away wins.',
};
const DEVICE: DeviceResult = { ...FIELDS, storage: 'device' };
const EPHEMERAL: EphemeralResult = { ...FIELDS, storage: 'none' };

async function setup() {
  const db = createTestDatabase();
  await db.open();
  return { db, repos: createRepositories(db) };
}

describe('wider-web results kept on this device (D45)', () => {
  it('saves device results under the normalized query and reads them back', async () => {
    const { db, repos } = await setup();
    await repos.webResults.save('Why are Ferrari  fans depressed?', [DEVICE], T0);
    expect(await repos.webResults.get('why are ferrari fans depressed', T0)).toEqual({
      key: 'why are ferrari fans depressed',
      savedAt: T0,
      results: [DEVICE],
    });
    expect(await db.webResults.count()).toBe(1);
    db.close();
  });

  it('isolates scoped results from legacy rows and other contexts', async () => {
    const { db, repos } = await setup();
    await repos.webResults.save('biggest villains', [DEVICE], T0);
    await repos.webResults.save(
      'biggest villains',
      [{ ...DEVICE, title: 'Anime villains' }],
      T0,
      'anime',
    );
    expect((await repos.webResults.get('biggest villains', T0))?.results[0]?.title).toBe(
      DEVICE.title,
    );
    expect((await repos.webResults.get('biggest villains', T0, 'anime'))?.results[0]?.title).toBe(
      'Anime villains',
    );
    expect(await repos.webResults.get('biggest villains', T0, 'cartoons')).toBeUndefined();
    db.close();
  });

  it('never saves shown-once results: refused by type, skipped at run time', async () => {
    const { db, repos } = await setup();
    // @ts-expect-error `none` results can't be passed to the device store.
    await repos.webResults.save('ferrari fans', [EPHEMERAL], T0);
    const odd = [{ ...FIELDS }, { ...FIELDS, storage: 'shared' }, { ...FIELDS, storage: 'nope' }];
    await repos.webResults.save('ferrari fans', odd as never, T0);
    expect(await db.webResults.count()).toBe(0);
    db.close();
  });

  it('replaces an older row, and removes it when a newer search has nothing to keep', async () => {
    const { db, repos } = await setup();
    await repos.webResults.save('ferrari fans', [DEVICE], T0);
    await repos.webResults.save('ferrari fans', [{ ...DEVICE, title: 'Newer' }], T0 + 1);
    expect((await repos.webResults.get('ferrari fans', T0 + 1))?.results[0]?.title).toBe('Newer');
    await repos.webResults.save('ferrari fans', [], T0 + 2);
    expect(await repos.webResults.get('ferrari fans', T0 + 2)).toBeUndefined();
    expect(await db.webResults.count()).toBe(0);
    db.close();
  });

  it('keeps only the device results from a mixed batch', async () => {
    const { repos, db } = await setup();
    await repos.webResults.save('ferrari fans', [DEVICE, EPHEMERAL as never], T0);
    expect((await repos.webResults.get('ferrari fans', T0))?.results).toEqual([DEVICE]);
    db.close();
  });

  it('expires after 30 days and prunes expired rows on the next save', async () => {
    const { db, repos } = await setup();
    await repos.webResults.save('ferrari fans', [DEVICE], T0);
    expect(await repos.webResults.get('ferrari fans', T0 + WEB_RESULTS_TTL_MS - 1)).toBeDefined();
    expect(await repos.webResults.get('ferrari fans', T0 + WEB_RESULTS_TTL_MS)).toBeUndefined();
    await repos.webResults.save('bmw drivers', [DEVICE], T0 + WEB_RESULTS_TTL_MS);
    expect(await db.webResults.toCollection().primaryKeys()).toEqual(['bmw drivers']);
    db.close();
  });

  it('drops malformed rows on the way out', async () => {
    const { db, repos } = await setup();
    await db.webResults.put({
      key: 'ferrari fans',
      savedAt: T0,
      results: [{ ...FIELDS, url: 'javascript:alert(1)', storage: 'device' }],
    });
    expect(await repos.webResults.get('ferrari fans', T0)).toBeUndefined();
    db.close();
  });

  it('is deleted by Clear history', async () => {
    const { db, repos } = await setup();
    await repos.history.record({ text: 'ferrari fans' }, T0);
    await repos.webResults.save('ferrari fans', [DEVICE], T0);
    await repos.history.clear();
    expect(await db.webResults.count()).toBe(0);
    expect(await db.searchHistory.count()).toBe(0);
    db.close();
  });

  it('is deleted by Reset', async () => {
    const { db, repos } = await setup();
    await repos.webResults.save('ferrari fans', [DEVICE], T0);
    await repos.resetUserData();
    expect(await db.webResults.count()).toBe(0);
    db.close();
  });
});

describe('schema v5', () => {
  it('upgrades a real v4 database: adds an empty web results store, keeps the rest', async () => {
    const name = `upgrade-v4-${Math.random().toString(36).slice(2)}`;
    const v4 = new Dexie(name);
    v4.version(1).stores(SCHEMA_V1);
    v4.version(2).stores(SCHEMA_V2_CHANGES);
    v4.version(3).stores({});
    v4.version(4).stores(SCHEMA_V4_CHANGES);
    await v4.open();
    await v4.table('settings').add({ key: 'history', value: 'on' });
    await v4.table('searchHistory').add({
      id: 'ferrari fans',
      label: 'ferrari fans',
      lastSearchedAt: T0,
      tier: 'recent',
      score: 1,
    });
    v4.close();

    const db = createDatabase(name);
    await db.open();
    expect(db.verno).toBe(15);
    expect(db.tables.map((t) => t.name)).toContain('webResults');
    expect(await db.webResults.count()).toBe(0);
    expect(await db.searchHistory.count()).toBe(1);
    expect(await db.settings.toArray()).toEqual([{ key: 'history', value: 'on' }]);
    db.close();
  });
});

describe('device results never leave the device', () => {
  // The rule (D45): wider-web results kept on the device are never sent to /api, any server, or a
  // future sync. Network code lives in src/services and api/; none of it may touch the store.
  const sources = {
    ...import.meta.glob('/src/services/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    ...import.meta.glob('/api/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  } as Record<string, string>;

  it('has network code to check', () => {
    expect(Object.keys(sources).some((path) => path.endsWith('webSearch.ts'))).toBe(true);
    expect(Object.keys(sources).some((path) => path.endsWith('web-search.ts'))).toBe(true);
  });

  it.each(Object.entries(sources).filter(([path]) => !path.includes('.test.')))(
    '%s does not read the device store',
    (_path, text) => {
      expect(text).not.toMatch(
        /webResultRepository|webResults|SavedWebResults|savedLinkRepository|savedLinks|SavedLink/,
      );
    },
  );
});

describe('sweepExpired (D69)', () => {
  it('removes rows at or past 30 days and keeps newer ones', async () => {
    const { db, repos } = await setup();
    await db.webResults.bulkPut([
      { key: 'ancient', savedAt: T0 - WEB_RESULTS_TTL_MS - 1, results: [DEVICE] },
      { key: 'exactly-30-days', savedAt: T0 - WEB_RESULTS_TTL_MS, results: [DEVICE] },
      { key: 'just-inside', savedAt: T0 - WEB_RESULTS_TTL_MS + 1, results: [DEVICE] },
      { key: 'today', savedAt: T0, results: [DEVICE] },
    ]);
    expect(await repos.webResults.sweepExpired(T0)).toBe(2);
    expect((await db.webResults.toArray()).map((row) => row.key).sort()).toEqual([
      'just-inside',
      'today',
    ]);
    db.close();
  });

  it('removes nothing when every row is fresh', async () => {
    const { db, repos } = await setup();
    await db.webResults.put({ key: 'today', savedAt: T0, results: [DEVICE] });
    expect(await repos.webResults.sweepExpired(T0)).toBe(0);
    expect(await db.webResults.count()).toBe(1);
    db.close();
  });
});
