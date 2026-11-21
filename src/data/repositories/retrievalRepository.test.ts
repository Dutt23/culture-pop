import { describe, expect, it } from 'vitest';
import type { DeviceResult, EphemeralResult } from '../../services/retrieval/webSearch';
import { makeCandidate, makeInterpretation, makeReference, makeSource } from '../../test/factories';
import { createTestDatabase } from '../../test/renderApp';
import { createRetrievalRepository, isLibraryCandidate } from './retrievalRepository';

const FIELDS = {
  title: 'Why are Ferrari fans always sad?',
  url: 'https://www.reddit.com/r/formula1/comments/abc/',
  snippet: 'Because the team keeps throwing away wins.',
};
const EPHEMERAL: EphemeralResult = { ...FIELDS, storage: 'none' };
const DEVICE: DeviceResult = { ...FIELDS, storage: 'device' };

async function setup() {
  const db = createTestDatabase();
  await db.open();
  // The seed fills the library on open, so tests compare counts rather than expect empty tables.
  const counts = async () => ({
    references: await db.references.count(),
    sources: await db.sources.count(),
    interpretations: await db.interpretations.count(),
  });
  return { db, repo: createRetrievalRepository(db), counts, before: await counts() };
}

describe('library save path locks (D45)', () => {
  it('refuses wider-web results of either level by type, and skips them at run time', async () => {
    const { repo, counts, before } = await setup();
    // @ts-expect-error Shown-once results must never reach the library.
    await repo.saveCandidates([EPHEMERAL]);
    // @ts-expect-error Device-only results have their own store, never the library.
    await repo.saveCandidates([DEVICE]);
    expect(await counts()).toEqual(before);
  });

  it('refuses a candidate carrying a storage level at compile time, and skips it', async () => {
    const { db, repo, counts, before } = await setup();
    const tagged = { ...makeCandidate({ id: 'enwiki:1', title: 'Tagged' }), storage: 'device' };
    // @ts-expect-error A `storage` level of any kind is refused by the type.
    await repo.saveCandidates([tagged]);
    expect(await db.references.get('enwiki:1')).toBeUndefined();
    expect(await counts()).toEqual(before);
  });

  it('still saves ordinary candidates next to refused ones', async () => {
    const { db, repo, before } = await setup();
    const kept = makeCandidate({ id: 'enwiki:2', title: 'Kept' });
    await repo.saveCandidates([kept, DEVICE as never]);
    expect(await db.references.get('enwiki:2')).toBeDefined();
    expect(await db.references.count()).toBe(before.references + 1);
  });

  it.each([
    ['a shown-once result', EPHEMERAL],
    ['a device-only result', DEVICE],
    ['any storage level', { id: 'x', sources: [], storage: 'shared' }],
    ['an empty storage level', { id: 'x', sources: [], storage: undefined }],
    ['no id or sources', { title: 'x' }],
    ['not an object', 'x'],
  ])('keeps %s out of the library', (_label, value) => {
    expect(isLibraryCandidate(value)).toBe(false);
  });

  it('lets an ordinary candidate into the library', () => {
    expect(isLibraryCandidate(makeCandidate({ id: 'enwiki:3', title: 'Ok' }))).toBe(true);
  });
});

describe('pruneOnline (D69)', () => {
  const stamp = (i: number) => `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
  const onlineId = (i: number) => `on-${i}`;

  /** `count` cached online results, `on-0` the least recently updated. */
  async function setupOnline(count: number) {
    const { db, repo } = await setup();
    await db.references.bulkPut(
      Array.from({ length: count }, (_, i) =>
        makeReference(onlineId(i), `Online ${i}`, {
          editorialState: i % 2 ? 'source_curated' : 'retrieved',
          updatedAt: stamp(i),
        }),
      ),
    );
    const onlineLeft = async () =>
      (await db.references.where('id').startsWith('on-').primaryKeys()).sort();
    return { db, repo, onlineLeft };
  }

  it('keeps the `max` most recently updated and removes the rest', async () => {
    const { repo, onlineLeft } = await setupOnline(10);
    expect(await repo.pruneOnline(6)).toBe(4);
    expect(await onlineLeft()).toEqual([4, 5, 6, 7, 8, 9].map(onlineId));
  });

  it('removes nothing when there are no more than `max`', async () => {
    const { repo, onlineLeft } = await setupOnline(5);
    expect(await repo.pruneOnline(5)).toBe(0);
    expect(await repo.pruneOnline(50)).toBe(0);
    expect(await onlineLeft()).toHaveLength(5);
  });

  it('never removes a favourited or pack-filed result: the next oldest goes instead', async () => {
    const { db, repo, onlineLeft } = await setupOnline(10);
    await db.favourites.put({ referenceId: onlineId(0), savedAt: stamp(0) });
    await db.packMembers.put({
      id: 'pm:1',
      packId: 'pack:1',
      referenceId: onlineId(1),
      position: 0,
      addedAt: stamp(1),
    });
    expect(await repo.pruneOnline(6)).toBe(4);
    // 0 and 1 are kept by the reader, so 2..5 are the four oldest that may go.
    expect(await onlineLeft()).toEqual([0, 1, 6, 7, 8, 9].map(onlineId));
  });

  it('never touches curated references, however old', async () => {
    const { db, repo } = await setupOnline(6);
    await db.references.bulkPut([
      makeReference('cur-demo', 'Curated demo', {
        editorialState: 'demo',
        updatedAt: '2000-01-01',
      }),
      makeReference('cur-pub', 'Curated published', {
        editorialState: 'published',
        updatedAt: '2000-01-01',
      }),
    ]);
    expect(await repo.pruneOnline(2)).toBe(4);
    expect(await db.references.get('cur-demo')).toBeDefined();
    expect(await db.references.get('cur-pub')).toBeDefined();
  });

  it('deletes the interpretations of removed results only', async () => {
    const { db, repo } = await setupOnline(4);
    await db.interpretations.bulkPut([
      makeInterpretation('i-old', onlineId(0)),
      makeInterpretation('i-new', onlineId(3)),
    ]);
    await repo.pruneOnline(2);
    expect(await db.interpretations.get('i-old')).toBeUndefined();
    expect(await db.interpretations.get('i-new')).toBeDefined();
  });

  it("deletes a removed result's source only when no remaining result cites it", async () => {
    const { db, repo } = await setupOnline(4);
    await db.sources.bulkPut([
      makeSource('src:only-old', 'Wiki'),
      makeSource('src:shared', 'Wiki'),
      makeSource('src:only-new', 'Wiki'),
    ]);
    await db.references.bulkPut([
      makeReference(onlineId(0), 'Online 0', {
        editorialState: 'retrieved',
        updatedAt: stamp(0),
        sourceIds: ['src:only-old', 'src:shared'],
      }),
      makeReference(onlineId(3), 'Online 3', {
        editorialState: 'source_curated',
        updatedAt: stamp(3),
        sourceIds: ['src:shared', 'src:only-new'],
      }),
    ]);
    await repo.pruneOnline(2);
    expect(await db.sources.get('src:only-old')).toBeUndefined();
    expect(await db.sources.get('src:shared')).toBeDefined();
    expect(await db.sources.get('src:only-new')).toBeDefined();
  });
});
