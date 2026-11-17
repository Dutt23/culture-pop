import { describe, expect, it } from 'vitest';
import { makeCandidate, makeSource } from '../../test/factories';
import { createTestDatabase } from '../../test/renderApp';
import { readBackup } from '../backup';
import { createRepositories } from './index';

const redPill = makeCandidate({
  id: 'wd:Q99',
  title: 'Red pill and blue pill',
  kind: 'meme',
  category: 'meme',
  sources: [
    makeSource('src:wd:Q99', 'Wikidata', {
      url: 'https://www.wikidata.org/wiki/Q99',
      title: 'Red pill and blue pill',
      sourceType: 'structured_data',
    }),
  ],
});

async function device() {
  const db = createTestDatabase();
  await db.open();
  return { db, repos: createRepositories(db) };
}

/** Device A: a bit of everything a backup holds, and things it must leave behind. */
async function filledDevice() {
  const a = await device();
  const { repos, db } = a;
  await repos.retrieval.saveCandidates([redPill]);
  await repos.favourites.toggle('ok-boomer');
  await repos.favourites.toggle(redPill.id);
  await repos.savedLinks.toggle({ url: 'https://example.org/page', title: 'A page' });
  await repos.settings.set('theme', 'dark');
  await repos.settings.set('webAccess', 'unlocked');
  await repos.settings.set('retrieval', 'on');
  await repos.history.record({ text: 'ferrari fans' }, Date.now());
  await repos.webResults.save(
    'ferrari fans',
    [{ title: 'Ferrari', url: 'https://www.reddit.com/r/f1/', snippet: 'Sad.', storage: 'device' }],
    Date.now(),
  );
  await db.settings.put({ key: 'searchTags', value: '["anime"]' });
  const pack = await repos.packs.create({ name: 'Before X-Men', ceiling: 'before_watching' });
  for (const id of ['doh-simpsons', redPill.id, 'ok-boomer']) {
    await repos.packs.fileCard(id, pack.id, Infinity);
  }
  await repos.packs.markDone(pack.id, 'doh-simpsons');
  await repos.packs.setNow(pack.id);
  return { ...a, pack };
}

/** What happens to a backup on its way through a file. */
async function throughFile(repos: Awaited<ReturnType<typeof device>>['repos']) {
  const text = JSON.stringify(await repos.backup.create(new Date('2026-11-17T09:00:00Z')));
  return { text, ...readBackup(text) };
}

describe('backup', () => {
  it('holds favourites, packs, saved links and settings, and nothing device-only', async () => {
    // Device-only: the sign-in flag, consent to send search text, history, kept web results.
    const { db, repos } = await filledDevice();
    const { text, backup, skipped } = await throughFile(repos);

    expect(skipped).toBe(0);
    expect(Object.keys(backup).sort()).toEqual(
      [
        'app',
        'version',
        'exportedAt',
        'favourites',
        'savedLinks',
        'settings',
        'packs',
        'references',
      ].sort(),
    );
    for (const leftBehind of ['webAccess', 'retrieval', 'ferrari', 'reddit']) {
      expect(text).not.toContain(leftBehind);
    }
    expect(backup.settings).toEqual(
      expect.arrayContaining([
        { key: 'theme', value: 'dark' },
        { key: 'searchTags', value: '["anime"]' },
      ]),
    );
    // Only the card found online travels; library cards ship with the app.
    expect(backup.references.map((r) => r.id)).toEqual([redPill.id]);
    db.close();
  });

  it('restores everything on another device, in order, and the online card opens', async () => {
    const { db, repos } = await filledDevice();
    const { backup } = await throughFile(repos);
    const b = await device();

    expect(await b.repos.backup.restore(backup)).toEqual({ missingCards: 0 });

    expect((await b.repos.favourites.list()).map((f) => f.referenceId).sort()).toEqual(
      ['ok-boomer', redPill.id].sort(),
    );
    expect(await b.db.references.get(redPill.id)).toMatchObject({
      title: 'Red pill and blue pill',
    });
    expect((await b.repos.savedLinks.list()).map((l) => l.url)).toEqual([
      'https://example.org/page',
    ]);
    const settings = await b.repos.settings.getAll();
    expect(settings).toContainEqual({ key: 'theme', value: 'dark' });
    expect(settings).toContainEqual({ key: 'searchTags', value: '["anime"]' });
    expect(settings.some((s) => s.key === 'webAccess')).toBe(false);

    const [pack] = await b.repos.packs.list();
    expect(pack).toMatchObject({ name: 'Before X-Men', ceiling: 'before_watching', now: true });
    expect(
      (await b.repos.packs.members(pack.id)).map((m) => [m.referenceId, m.position, !!m.doneAt]),
    ).toEqual([
      [redPill.id, 0, false],
      ['ok-boomer', 1, false],
      ['doh-simpsons', 2, true],
    ]);
    db.close();
    b.db.close();
  });

  it('only adds: what this device already has stays as it is', async () => {
    const { db, repos } = await filledDevice();
    const { backup } = await throughFile(repos);
    const b = await device();
    await b.repos.favourites.toggle('the-snap-avengers');
    await b.repos.settings.set('theme', 'light');
    const mine = await b.repos.packs.create({ name: 'Mine', ceiling: 'open' });
    await b.repos.packs.setNow(mine.id);

    await b.repos.backup.restore(backup);

    expect((await b.repos.favourites.list()).map((f) => f.referenceId)).toContain(
      'the-snap-avengers',
    );
    expect(await b.repos.settings.getAll()).toContainEqual({ key: 'theme', value: 'light' });
    // This device's Now pack stays the only Now.
    expect((await b.repos.packs.list()).map((p) => [p.name, p.now])).toEqual([
      ['Mine', true],
      ['Before X-Men', false],
    ]);
    db.close();
    b.db.close();
  });

  it('an older backup of the same pack keeps what was filed and marked since', async () => {
    const { db, repos, pack } = await filledDevice();
    const { backup } = await throughFile(repos);
    await repos.packs.fileCard('the-snap-avengers', pack.id, Infinity);
    await repos.packs.markDone(pack.id, 'ok-boomer');
    await repos.packs.rename(pack.id, 'Before X-Men (renamed)');
    await repos.packs.removeMember(pack.id, redPill.id);

    await repos.backup.restore(backup);

    expect(await repos.packs.get(pack.id)).toMatchObject({ name: 'Before X-Men (renamed)' });
    expect(
      (await repos.packs.members(pack.id)).map((m) => [m.referenceId, m.position, !!m.doneAt]),
    ).toEqual([
      ['the-snap-avengers', 0, false],
      // Only cards the pack no longer has come back, after the ones still to learn.
      [redPill.id, 1, false],
      ['doh-simpsons', 2, true],
      ['ok-boomer', 3, true],
    ]);
    db.close();
  });

  it('leaves out cards that are not in this library, and says how many', async () => {
    const b = await device();
    const { backup } = readBackup(
      JSON.stringify({
        app: 'pop-culture-decoder',
        version: 1,
        exportedAt: '2026-11-17T09:00:00Z',
        favourites: [{ referenceId: 'no-such-card', savedAt: '2026-11-17T09:00:00Z' }],
        savedLinks: [],
        settings: [],
        packs: [],
        references: [],
      }),
    );

    expect(await b.repos.backup.restore(backup)).toEqual({ missingCards: 1 });
    expect(await b.repos.favourites.list()).toEqual([]);
    b.db.close();
  });

  it('never changes a stored citation: a clashing source is left out with its card', async () => {
    const b = await device();
    await b.repos.retrieval.saveCandidates([redPill]);
    const before = await b.db.sources.toArray();
    const source = redPill.sources[0];
    const { backup } = readBackup(
      JSON.stringify({
        ...(await b.repos.backup.create(new Date())),
        references: [
          {
            ...redPill,
            id: 'wd:Q300',
            title: 'Same source ID, another page',
            sources: [{ ...source, url: 'https://www.wikidata.org/wiki/Q300' }],
          },
        ],
      }),
    );

    await b.repos.backup.restore(backup);

    expect(await b.db.sources.toArray()).toEqual(before);
    expect(await b.db.references.get('wd:Q300')).toBeUndefined();
    b.db.close();
  });

  it('never writes an online card over a library card with the same ID', async () => {
    const b = await device();
    const before = await b.db.references.get('ok-boomer');
    const { backup } = await throughFile(b.repos);

    await b.repos.backup.restore({
      ...backup,
      references: [{ ...redPill, id: 'ok-boomer', title: 'Hijacked' }],
    });

    expect(await b.db.references.get('ok-boomer')).toEqual(before);
    b.db.close();
  });
});
