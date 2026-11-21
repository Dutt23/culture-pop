import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import type { DraftResponse } from '../../../shared/cardTypes.js';
import { createDatabase } from '../db';
import { createTestDatabase } from '../../test/renderApp';
import {
  CurationCapacityError,
  createCurationJobRepository,
  type CurationJob,
  type CurationJobInput,
} from './curationJobRepository';
import { createRepositories } from './index';

const input = (ownerId = 'tab-one'): CurationJobInput => ({
  ownerId,
  request: {
    search: 'bazinga',
    sources: [{ kind: 'app', from: 'app card', title: 'Bazinga', text: 'A catchphrase.' }],
  },
  sent: [
    { key: 'app:one', kind: 'app', from: 'app card', title: 'Bazinga', line: 'A catchphrase.' },
  ],
  color: 'sage',
  userContext: 'A joke in a group chat.',
});

const response: DraftResponse = {
  card: {
    label: 'Bazinga',
    gist: 'A catchphrase.',
    means: 'Gotcha!',
    reply: 'Nice one.',
    summary: [],
    context: [],
    example: null,
    spoiler: 'none',
  },
  notUsed: [],
  provider: 'fake',
  promptVersion: 'v1',
};

describe('curation activity jobs', () => {
  it('admits only five jobs when separate database connections create concurrently', async () => {
    const first = createTestDatabase();
    await first.open();
    const second = createDatabase(first.name, { readyPack: false });
    await second.open();
    try {
      const a = createCurationJobRepository(first);
      const b = createCurationJobRepository(second);
      const results = await Promise.allSettled(
        Array.from({ length: 9 }, (_, index) =>
          (index % 2 ? a : b).create(input(index % 2 ? 'tab-one' : 'tab-two')),
        ),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
      const refused = results.filter((result) => result.status === 'rejected');
      expect(refused).toHaveLength(4);
      for (const result of refused) {
        if (result.status === 'rejected')
          expect(result.reason).toBeInstanceOf(CurationCapacityError);
      }
      expect(await first.curationJobs.where('status').equals('running').count()).toBe(5);
    } finally {
      second.close();
      first.close();
    }
  });

  it('persists a request snapshot and ignores a late response after cancellation', async () => {
    const db = createTestDatabase();
    await db.open();
    try {
      const jobs = createCurationJobRepository(db);
      const original = input();
      const creation = jobs.create(original);
      original.request.search = 'changed later';
      original.sent[0]!.title = 'changed later';
      const job = await creation;
      expect(job.request.search).toBe('bazinga');
      expect(job.sent[0]?.title).toBe('Bazinga');
      expect(await jobs.cancel(job.id)).toBe(true);
      expect(await jobs.complete(job.id, response)).toBe(false);
      expect(await jobs.fail(job.id, 'late error')).toBe(false);
      expect((await jobs.get(job.id))?.status).toBe('cancelled');
      expect((await jobs.get(job.id))?.response).toBeUndefined();
      expect(await jobs.cancel('missing')).toBe(false);
    } finally {
      db.close();
    }
  });

  it('keeps completed responses and releases capacity after terminal transitions', async () => {
    const db = createTestDatabase();
    await db.open();
    try {
      const jobs = createCurationJobRepository(db);
      const pending = await Promise.all(Array.from({ length: 5 }, () => jobs.create(input())));
      expect(await jobs.complete(pending[0]!.id, response)).toBe(true);
      expect(
        await jobs.fail(pending[1]!.id, 'No evidence', 'no_card', [
          { source: 0, why: 'Unrelated source' },
        ]),
      ).toBe(true);
      await jobs.create(input());
      await jobs.create(input());
      await expect(jobs.create(input())).rejects.toBeInstanceOf(CurationCapacityError);
      expect((await jobs.get(pending[0]!.id))?.response).toEqual(response);
      expect(await jobs.get(pending[1]!.id)).toMatchObject({
        error: 'No evidence',
        failure: 'no_card',
        notUsed: [{ source: 0, why: 'Unrelated source' }],
      });
    } finally {
      db.close();
    }
  });

  it('interrupts only explicitly identified running jobs', async () => {
    const db = createTestDatabase();
    await db.open();
    try {
      const jobs = createCurationJobRepository(db);
      const abandoned = await jobs.create(input('old-tab'));
      const live = await jobs.create(input('live-tab'));
      const finished = await jobs.create(input('old-tab'));
      await jobs.complete(finished.id, response);
      expect(await jobs.interrupt([abandoned.id, abandoned.id, finished.id, 'missing'])).toBe(1);
      expect(await jobs.interrupt([])).toBe(0);
      expect((await jobs.get(abandoned.id))?.status).toBe('interrupted');
      expect((await jobs.get(live.id))?.status).toBe('running');
      expect((await jobs.get(finished.id))?.status).toBe('completed');
    } finally {
      db.close();
    }
  });

  it('excludes jobs from backups, retains them through history clear, and deletes them on Reset', async () => {
    const db = createTestDatabase();
    await db.open();
    try {
      const repos = createRepositories(db);
      const job = await repos.curationJobs.create(input());
      const backup = await repos.backup.create(new Date());
      expect(JSON.stringify(backup)).not.toContain(job.id);
      expect(JSON.stringify(backup)).not.toContain('A joke in a group chat.');
      await repos.history.clear();
      expect(await repos.curationJobs.get(job.id)).toBeDefined();
      await repos.resetUserData();
      expect(await repos.curationJobs.list()).toEqual([]);
      expect(await repos.curationJobs.complete(job.id, response)).toBe(false);
    } finally {
      db.close();
    }
  });

  it('adds the activity store when upgrading v13 without changing existing data', async () => {
    const db = createTestDatabase();
    await db.open();
    const schemas = Object.fromEntries(
      db.tables
        .filter((table) => table.name !== 'curationJobs')
        .map((table) => [
          table.name,
          [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(','),
        ]),
    );
    const name = db.name;
    db.close();
    await Dexie.delete(name);
    const old = new Dexie(name);
    old.version(13).stores(schemas);
    await old.open();
    await old.table('settings').put({ key: 'history', value: 'off' });
    await old.table('draftCards').put({
      id: 'existing',
      search: 'bazinga',
      card: response.card,
      sources: [],
      savedAt: '2026-11-19',
      promptVersion: 'v1',
    });
    old.close();
    const upgraded = createDatabase(name, { readyPack: false });
    try {
      await upgraded.open();
      expect(await upgraded.settings.get('history')).toEqual({ key: 'history', value: 'off' });
      expect(await upgraded.draftCards.get('existing')).toBeDefined();
      expect(await upgraded.curationJobs.count()).toBe(0);
      const repos = createCurationJobRepository(upgraded);
      await repos.create(input());
      expect(await repos.list()).toHaveLength(1);
    } finally {
      upgraded.close();
    }
  });
});

describe('curation job reads and retention (D69)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = Date.UTC(2026, 10, 21, 12);
  const iso = (ms: number) => new Date(ms).toISOString();
  /** `ageMs` is how long before NOW it was created; `touchedAgeMs` defaults to the same moment. */
  const job = (
    id: string,
    status: CurationJob['status'],
    ageMs: number,
    touchedAgeMs = ageMs,
  ): CurationJob => ({
    ...input(),
    id,
    status,
    createdAt: iso(NOW - ageMs),
    updatedAt: iso(NOW - touchedAgeMs),
  });
  /** Distinct creation times, `jobN` newer than `jobN-1`, all about `days` old. */
  const finishedBatch = (count: number, days: number) =>
    Array.from({ length: count }, (_, i) =>
      job(`job${String(i).padStart(3, '0')}`, 'completed', days * DAY - i * 60_000),
    );

  async function setup() {
    const db = createTestDatabase();
    await db.open();
    return { db, jobs: createCurationJobRepository(db) };
  }

  it('lists newest first, reads only `limit` rows, and counts them all', async () => {
    const { db, jobs } = await setup();
    await db.curationJobs.bulkPut([
      job('old', 'completed', 3 * DAY),
      job('new', 'running', 1 * DAY),
      job('mid', 'failed', 2 * DAY),
    ]);
    expect((await jobs.list()).map((j) => j.id)).toEqual(['new', 'mid', 'old']);
    expect((await jobs.list(2)).map((j) => j.id)).toEqual(['new', 'mid']);
    expect(await jobs.count()).toBe(3);
    db.close();
  });

  it('live returns running jobs plus recent changes, newest first, without duplicates', async () => {
    const { db, jobs } = await setup();
    await db.curationJobs.bulkPut([
      // Running and recently touched: matches both reads, must appear once.
      job('running-recent', 'running', 5 * DAY, 1 * DAY),
      // Running for ages and never touched since: still watched.
      job('running-stale', 'running', 90 * DAY),
      // Finished long ago but changed inside the window.
      job('finished-recent', 'completed', 20 * DAY, 2 * DAY),
      // Finished and untouched outside the window: left out.
      job('finished-old', 'completed', 40 * DAY),
    ]);
    const since = iso(NOW - 3 * DAY);
    expect((await jobs.live(since)).map((j) => j.id)).toEqual([
      'running-recent',
      'finished-recent',
      'running-stale',
    ]);
    db.close();
  });

  it('prune keeps exactly the newest 200 when more finished jobs are all past 30 days', async () => {
    const { db, jobs } = await setup();
    const batch = finishedBatch(205, 40);
    await db.curationJobs.bulkPut(batch);
    expect(await jobs.prune(NOW)).toBe(5);
    expect(await jobs.count()).toBe(200);
    const left = new Set((await jobs.list()).map((j) => j.id));
    for (const gone of batch.slice(0, 5)) expect(left.has(gone.id)).toBe(false);
    for (const kept of batch.slice(5)) expect(left.has(kept.id)).toBe(true);
    db.close();
  });

  it('prune deletes nothing when 200 or fewer finished jobs exist, however old', async () => {
    const { db, jobs } = await setup();
    await db.curationJobs.bulkPut(finishedBatch(10, 40));
    expect(await jobs.prune(NOW)).toBe(0);
    expect(await jobs.count()).toBe(10);
    db.close();
  });

  it('prune keeps jobs inside the 30 day window even beyond 200', async () => {
    const { db, jobs } = await setup();
    await db.curationJobs.bulkPut(finishedBatch(205, 10));
    expect(await jobs.prune(NOW)).toBe(0);
    expect(await jobs.count()).toBe(205);
    db.close();
  });

  it('prune never deletes a running job, however old', async () => {
    const { db, jobs } = await setup();
    await db.curationJobs.bulkPut([
      job('running-ancient', 'running', 90 * DAY),
      ...finishedBatch(205, 40),
    ]);
    expect(await jobs.prune(NOW)).toBe(5);
    expect(await jobs.get('running-ancient')).toBeDefined();
    expect(await jobs.count()).toBe(201);
    db.close();
  });
});
