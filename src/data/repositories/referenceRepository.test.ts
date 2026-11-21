import { describe, expect, it } from 'vitest';
import { makeAlias, makeInterpretation, makeReference } from '../../test/factories';
import { createTestDatabase } from '../../test/renderApp';
import { createReferenceRepository } from './referenceRepository';

async function setup() {
  const db = createTestDatabase();
  await db.open();
  // The seed fills the library on open: start from an empty one so every test sets up its own.
  await Promise.all([
    db.references.clear(),
    db.aliases.clear(),
    db.interpretations.clear(),
    db.sources.clear(),
  ]);
  return { db, repo: createReferenceRepository(db) };
}

describe('reference repository, indexed reads (D69)', () => {
  it('counts every reference, curated or cached online', async () => {
    const { db, repo } = await setup();
    expect(await repo.count()).toBe(0);
    await db.references.bulkPut([
      makeReference('a', 'Alpha'),
      makeReference('b', 'Bravo', { editorialState: 'retrieved' }),
    ]);
    expect(await repo.count()).toBe(2);
    db.close();
  });

  it('getCurated returns demo and published only, in title order', async () => {
    const { db, repo } = await setup();
    await db.references.bulkPut([
      makeReference('c', 'Charlie', { editorialState: 'published' }),
      makeReference('a', 'Alpha', { editorialState: 'demo' }),
      makeReference('x', 'Aardvark online', { editorialState: 'retrieved' }),
      makeReference('y', 'Bee online', { editorialState: 'source_curated' }),
      makeReference('b', 'Bravo', { editorialState: 'demo' }),
    ]);
    expect((await repo.getCurated()).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    db.close();
  });

  it('getInterpretationsFor reads only the given references', async () => {
    const { db, repo } = await setup();
    await db.interpretations.bulkPut([
      makeInterpretation('i1', 'a'),
      makeInterpretation('i2', 'b'),
      makeInterpretation('i3', 'c'),
    ]);
    expect((await repo.getInterpretationsFor(['a', 'c'])).map((i) => i.id).sort()).toEqual([
      'i1',
      'i3',
    ]);
    expect(await repo.getInterpretationsFor([])).toEqual([]);
    db.close();
  });

  it('getAliasesFor reads only the given references', async () => {
    const { db, repo } = await setup();
    await db.aliases.bulkPut([makeAlias('a', 'Al'), makeAlias('b', 'Bee'), makeAlias('c', 'Cee')]);
    expect((await repo.getAliasesFor(['b'])).map((alias) => alias.referenceId)).toEqual(['b']);
    expect(await repo.getAliasesFor([])).toEqual([]);
    db.close();
  });

  it('getByPhrases finds references by exact title or by alias, once each', async () => {
    const { db, repo } = await setup();
    await db.references.bulkPut([
      makeReference('a', 'Alpha'),
      makeReference('b', 'Bravo'),
      makeReference('c', 'Charlie'),
    ]);
    await db.aliases.bulkPut([makeAlias('b', 'The B Word'), makeAlias('a', 'First Letter')]);
    const found = await repo.getByPhrases(['alpha', 'the b word', 'alpha', 'no such thing']);
    expect(found.references.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(found.aliases.map((alias) => alias.referenceId)).toEqual(['b']);
    db.close();
  });

  it('getByPhrases returns nothing for no usable phrase', async () => {
    const { db, repo } = await setup();
    await db.references.put(makeReference('a', 'Alpha'));
    expect(await repo.getByPhrases([])).toEqual({ references: [], aliases: [] });
    expect(await repo.getByPhrases([''])).toEqual({ references: [], aliases: [] });
    db.close();
  });
});
