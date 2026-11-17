import { describe, expect, it } from 'vitest';
import { makeReference } from '../../test/factories';
import { createTestDatabase } from '../../test/renderApp';
import { createDatabase } from '../db';
import { buildSeed } from '../seed';
import { createRepositories } from './index';

async function setup() {
  const db = createTestDatabase();
  await db.open();
  return { db, repos: createRepositories(db) };
}

describe('packs', () => {
  it('lists filed cards in the order they were filed', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'Before X-Men', ceiling: 'before_watching' });
    await repos.packs.fileCard('ok-boomer', pack.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', pack.id, Infinity);
    expect((await repos.packs.members(pack.id)).map((m) => [m.referenceId, m.position])).toEqual([
      ['ok-boomer', 0],
      ['doh-simpsons', 1],
    ]);
    db.close();
  });

  it('keeps one member row when the same card is filed into the same pack twice', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', pack.id, 0);
    await repos.packs.fileCard('ok-boomer', pack.id, 0);
    expect(await db.packMembers.where('packId').equals(pack.id).count()).toBe(1);
    // The unique index refuses a second row written past the repository too.
    await expect(
      db.packMembers.add({
        id: 'pm:duplicate',
        packId: pack.id,
        referenceId: 'ok-boomer',
        position: 1,
        addedAt: 't',
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    db.close();
  });

  it('files the same card in two packs', async () => {
    const { db, repos } = await setup();
    const a = await repos.packs.create({ name: 'A', ceiling: 'open' });
    const b = await repos.packs.create({ name: 'B', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', a.id, 0);
    await repos.packs.fileCard('ok-boomer', b.id, 0);
    expect((await repos.packs.packsOf('ok-boomer')).map((p) => p.name).sort()).toEqual(['A', 'B']);
    db.close();
  });

  it('keeps positions dense and unique as cards move up, down and to either end', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    const ids = ['ok-boomer', 'doh-simpsons', 'the-snap-avengers', 'bazinga-big-bang-theory'];
    for (const id of ids) await repos.packs.fileCard(id, pack.id, Infinity);
    await repos.packs.fileCard('the-snap-avengers', pack.id, 1); // up
    await repos.packs.fileCard('ok-boomer', pack.id, 1); // down
    await repos.packs.fileCard('bazinga-big-bang-theory', pack.id, -5); // past the start
    await repos.packs.fileCard('doh-simpsons', pack.id, 99); // past the end

    const members = await repos.packs.members(pack.id);
    expect(members.map((m) => m.referenceId)).toEqual([
      'bazinga-big-bang-theory',
      'the-snap-avengers',
      'ok-boomer',
      'doh-simpsons',
    ]);
    expect(members.map((m) => m.position)).toEqual([0, 1, 2, 3]);
    db.close();
  });

  it('moves a card out of one pack into another, closing the gap it leaves', async () => {
    const { db, repos } = await setup();
    const a = await repos.packs.create({ name: 'A', ceiling: 'open' });
    const b = await repos.packs.create({ name: 'B', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', a.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', a.id, Infinity);
    await repos.packs.fileCard('ok-boomer', b.id, Infinity, a.id);
    expect(await repos.packs.members(a.id)).toEqual([
      expect.objectContaining({ referenceId: 'doh-simpsons', position: 0 }),
    ]);
    expect((await repos.packs.members(b.id)).map((m) => m.referenceId)).toEqual(['ok-boomer']);
    db.close();
  });

  it('leaves the card where it was when a move fails', async () => {
    const { db, repos } = await setup();
    const a = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', a.id, 0);
    await expect(repos.packs.fileCard('ok-boomer', 'pack:gone', 0, a.id)).rejects.toThrow();
    expect((await repos.packs.members(a.id)).map((m) => m.referenceId)).toEqual(['ok-boomer']);
    db.close();
  });

  it('removes a member without deleting the reference, and closes the gap', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', pack.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', pack.id, Infinity);
    await repos.packs.removeMember(pack.id, 'ok-boomer');
    expect(await repos.packs.members(pack.id)).toEqual([
      expect.objectContaining({ referenceId: 'doh-simpsons', position: 0 }),
    ]);
    expect(await db.references.get('ok-boomer')).toBeDefined();
    db.close();
  });

  it('deletes a pack and its members only: references and other packs remain', async () => {
    const { db, repos } = await setup();
    const a = await repos.packs.create({ name: 'A', ceiling: 'open' });
    const b = await repos.packs.create({ name: 'B', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', a.id, 0);
    await repos.packs.fileCard('ok-boomer', b.id, 0);
    await repos.packs.deletePack(a.id);
    expect(await repos.packs.get(a.id)).toBeUndefined();
    expect(await db.packMembers.where('packId').equals(a.id).count()).toBe(0);
    expect((await repos.packs.members(b.id)).map((m) => m.referenceId)).toEqual(['ok-boomer']);
    expect(await db.references.count()).toBe(buildSeed().references.length);
    db.close();
  });

  it('keeps exactly one Now pack', async () => {
    const { db, repos } = await setup();
    const a = await repos.packs.create({ name: 'A', ceiling: 'open' });
    const b = await repos.packs.create({ name: 'B', ceiling: 'open' });
    await repos.packs.setNow(a.id);
    await repos.packs.setNow(b.id);
    const now = (await db.packs.toArray()).filter((p) => p.now);
    expect(now.map((p) => p.id)).toEqual([b.id]);
    // The Now pack lists first.
    expect((await repos.packs.list())[0].id).toBe(b.id);
    await repos.packs.clearNow();
    expect((await db.packs.toArray()).some((p) => p.now)).toBe(false);
    db.close();
  });

  it('keeps order and Now across a close and reopen (reload)', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'Before X-Men', ceiling: 'before_watching' });
    await repos.packs.fileCard('ok-boomer', pack.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', pack.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', pack.id, 0);
    await repos.packs.setNow(pack.id);
    db.close();

    const reopened = createDatabase(db.name);
    await reopened.open();
    const again = createRepositories(reopened);
    expect((await again.packs.members(pack.id)).map((m) => m.referenceId)).toEqual([
      'doh-simpsons',
      'ok-boomer',
    ]);
    expect(await again.packs.get(pack.id)).toMatchObject({ now: true });
    reopened.close();
  });

  it('names packs from trimmed text and refuses an empty name', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: '  Before X-Men ', ceiling: 'before_watching' });
    expect(pack).toMatchObject({ name: 'Before X-Men', normalizedName: 'before x men' });
    await expect(repos.packs.create({ name: '   ', ceiling: 'open' })).rejects.toThrow();
    await expect(repos.packs.rename(pack.id, '')).rejects.toThrow();
    db.close();
  });

  it('refuses to file a reference that does not exist', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await expect(repos.packs.fileCard('no-such-card', pack.id, 0)).rejects.toThrow();
    expect(await db.packMembers.count()).toBe(0);
    db.close();
  });

  it('drops the member rows of an online result when saved online results are deleted', async () => {
    const { db, repos } = await setup();
    await db.references.add(makeReference('wd:Q1', 'Zzqx', { editorialState: 'retrieved' }));
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await repos.packs.fileCard('wd:Q1', pack.id, 0);
    await repos.packs.fileCard('ok-boomer', pack.id, 1);
    await repos.packs.fileCard('doh-simpsons', pack.id, 2);
    await repos.retrieval.clear();
    expect(await db.references.get('wd:Q1')).toBeUndefined();
    // The gap the deleted card left is closed: positions stay dense.
    expect((await repos.packs.members(pack.id)).map((m) => [m.referenceId, m.position])).toEqual([
      ['ok-boomer', 0],
      ['doh-simpsons', 1],
    ]);
    db.close();
  });

  it('moves a card marked done after the cards still to learn, and keeps it filed', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    for (const id of ['ok-boomer', 'doh-simpsons', 'the-snap-avengers']) {
      await repos.packs.fileCard(id, pack.id, Infinity);
    }
    await repos.packs.markDone(pack.id, 'ok-boomer');

    const members = await repos.packs.members(pack.id);
    expect(members.map((m) => [m.referenceId, m.position, Boolean(m.doneAt)])).toEqual([
      ['doh-simpsons', 0, false],
      ['the-snap-avengers', 1, false],
      ['ok-boomer', 2, true],
    ]);
    // Still in the pack: its chips and pack search still find it.
    expect((await repos.packs.packsOf('ok-boomer')).map((p) => p.id)).toEqual([pack.id]);
    db.close();
  });

  it('keeps done cards after the rest when cards are reordered or added', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', pack.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', pack.id, Infinity);
    await repos.packs.markDone(pack.id, 'ok-boomer');
    // Added at the end, and moved down past the end of the cards still to learn.
    await repos.packs.fileCard('the-snap-avengers', pack.id, Infinity);
    await repos.packs.fileCard('doh-simpsons', pack.id, 2);

    expect((await repos.packs.members(pack.id)).map((m) => [m.referenceId, m.position])).toEqual([
      ['the-snap-avengers', 0],
      ['doh-simpsons', 1],
      ['ok-boomer', 2],
    ]);
    db.close();
  });

  it('puts a done card back at the end of the cards still to learn when filed again', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    for (const id of ['ok-boomer', 'doh-simpsons', 'the-snap-avengers']) {
      await repos.packs.fileCard(id, pack.id, Infinity);
    }
    await repos.packs.markDone(pack.id, 'ok-boomer');
    await repos.packs.markDone(pack.id, 'doh-simpsons');
    await repos.packs.fileCard('doh-simpsons', pack.id, Infinity);

    expect(
      (await repos.packs.members(pack.id)).map((m) => [m.referenceId, Boolean(m.doneAt)]),
    ).toEqual([
      ['the-snap-avengers', false],
      ['doh-simpsons', false],
      ['ok-boomer', true],
    ]);
    db.close();
  });

  it('marks a card done in one pack only', async () => {
    const { db, repos } = await setup();
    const a = await repos.packs.create({ name: 'A', ceiling: 'open' });
    const b = await repos.packs.create({ name: 'B', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', a.id, 0);
    await repos.packs.fileCard('ok-boomer', b.id, 0);
    await repos.packs.markDone(a.id, 'ok-boomer');
    expect((await repos.packs.members(b.id))[0].doneAt).toBeUndefined();
    await expect(repos.packs.markDone(a.id, 'doh-simpsons')).rejects.toThrow();
    db.close();
  });

  it('is cleared by Reset, which leaves the built-in references', async () => {
    const { db, repos } = await setup();
    const pack = await repos.packs.create({ name: 'A', ceiling: 'open' });
    await repos.packs.fileCard('ok-boomer', pack.id, 0);
    await repos.resetUserData();
    expect(await db.packs.count()).toBe(0);
    expect(await db.packMembers.count()).toBe(0);
    expect(await db.references.count()).toBe(buildSeed().references.length);
    db.close();
  });
});
