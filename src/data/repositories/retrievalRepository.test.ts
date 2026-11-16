import { describe, expect, it } from 'vitest';
import type { DeviceResult, EphemeralResult } from '../../services/retrieval/webSearch';
import { makeCandidate } from '../../test/factories';
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
