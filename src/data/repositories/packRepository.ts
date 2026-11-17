import { normalizePhrase } from '../../domain/normalize';
import { sortPacks } from '../../domain/packs';
import type { Pack, PackCeiling, PackMember } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface PackMembership {
  pack: Pack;
  /** `member.referenceId` names the filed reference. */
  member: PackMember;
}

export interface PackRepository {
  /** The Now pack first, then the most recently changed. */
  list(): Promise<Pack[]>;
  get(packId: string): Promise<Pack | undefined>;
  create(fields: { name: string; ceiling: PackCeiling }): Promise<Pack>;
  rename(packId: string, name: string): Promise<void>;
  setCeiling(packId: string, ceiling: PackCeiling): Promise<void>;
  /** Makes this the only Now pack. */
  setNow(packId: string): Promise<void>;
  clearNow(): Promise<void>;
  /** Deletes the pack and its member rows; the references stay. */
  deletePack(packId: string): Promise<void>;
  /** In position order. */
  members(packId: string): Promise<PackMember[]>;
  /**
   * Files a reference at `index` (past the end files it last), or moves it there when it is already
   * a member. The pack's positions are rewritten so they stay dense. With `fromPackId` (another pack)
   * this is a move: the card leaves that pack in the same transaction.
   */
  fileCard(referenceId: string, packId: string, index: number, fromPackId?: string): Promise<void>;
  /**
   * "Got it": the card stays filed but moves after the cards still to learn. Filing it into
   * this pack again (`fileCard`) puts it back among them.
   */
  markDone(packId: string, referenceId: string): Promise<void>;
  /** Unfiles the reference from this pack only; the reference itself stays. */
  removeMember(packId: string, referenceId: string): Promise<void>;
  /** Every member row with its pack, for the all-packs search and the "in your packs" chips. */
  memberships(): Promise<PackMembership[]>;
  /** The packs a reference is filed in, listed like `list()`. */
  packsOf(referenceId: string): Promise<Pack[]>;
}

/** A pack name is the reader's own text: trimmed, and never empty. */
function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A pack needs a name.');
  return trimmed;
}

/** Cards still to learn first, then the done ones, each keeping its order; positions made dense. */
function settle(rows: readonly PackMember[]): PackMember[] {
  const ordered = [...rows.filter((row) => !row.doneAt), ...rows.filter((row) => row.doneAt)];
  return ordered.map((row, position) => ({ ...row, position }));
}

export function createPackRepository(db: PopCultureDb): PackRepository {
  const sortedMembers = (packId: string) =>
    db.packMembers.where('packId').equals(packId).sortBy('position');

  async function touch(packId: string, now: string) {
    if ((await db.packs.update(packId, { updatedAt: now })) === 0) {
      throw new Error(`No pack ${packId}.`);
    }
  }

  /** Call inside a transaction over packs and packMembers. */
  async function unfile(packId: string, referenceId: string) {
    const rows = await sortedMembers(packId);
    const kept = rows.filter((row) => row.referenceId !== referenceId);
    if (kept.length === rows.length) return;
    await db.packMembers.bulkDelete(
      rows.filter((row) => row.referenceId === referenceId).map((row) => row.id),
    );
    await db.packMembers.bulkPut(kept.map((row, position) => ({ ...row, position })));
    await touch(packId, new Date().toISOString());
  }

  return {
    list: async () => sortPacks(await db.packs.toArray()),
    get: (packId) => db.packs.get(packId),
    async create({ name, ceiling }) {
      const clean = cleanName(name);
      const now = new Date().toISOString();
      const pack: Pack = {
        id: `pack:${crypto.randomUUID()}`,
        name: clean,
        normalizedName: normalizePhrase(clean),
        ceiling,
        now: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.packs.add(pack);
      return pack;
    },
    async rename(packId, name) {
      const clean = cleanName(name);
      await db.packs.update(packId, {
        name: clean,
        normalizedName: normalizePhrase(clean),
        updatedAt: new Date().toISOString(),
      });
    },
    setCeiling: async (packId, ceiling) => {
      await db.packs.update(packId, { ceiling, updatedAt: new Date().toISOString() });
    },
    setNow: (packId) =>
      db.transaction('rw', db.packs, async () => {
        if (!(await db.packs.get(packId))) throw new Error(`No pack ${packId}.`);
        await db.packs.toCollection().modify({ now: false });
        await db.packs.update(packId, { now: true });
      }),
    clearNow: async () => {
      await db.packs.toCollection().modify({ now: false });
    },
    deletePack: (packId) =>
      db.transaction('rw', db.packs, db.packMembers, async () => {
        await db.packMembers.where('packId').equals(packId).delete();
        await db.packs.delete(packId);
      }),
    members: sortedMembers,
    fileCard: (referenceId, packId, index, fromPackId) =>
      db.transaction('rw', db.packs, db.packMembers, db.references, async () => {
        if (!(await db.references.get(referenceId))) {
          throw new Error(`No reference ${referenceId}.`);
        }
        const now = new Date().toISOString();
        await touch(packId, now);
        const rows = await sortedMembers(packId);
        const existing = rows.find((row) => row.referenceId === referenceId);
        const others = rows.filter((row) => row.referenceId !== referenceId);
        const at = Math.max(0, Math.min(Math.trunc(index), others.length));
        // Filing a done card again puts it back among the cards still to learn.
        const member: PackMember = existing
          ? { ...existing, doneAt: undefined }
          : {
              id: `pm:${crypto.randomUUID()}`,
              packId,
              referenceId,
              position: at,
              addedAt: now,
            };
        await db.packMembers.bulkPut(settle([...others.slice(0, at), member, ...others.slice(at)]));
        if (fromPackId && fromPackId !== packId) await unfile(fromPackId, referenceId);
      }),
    markDone: (packId, referenceId) =>
      db.transaction('rw', db.packs, db.packMembers, async () => {
        const rows = await sortedMembers(packId);
        const target = rows.find((row) => row.referenceId === referenceId);
        if (!target) throw new Error(`${referenceId} is not in pack ${packId}.`);
        const doneAt = new Date().toISOString();
        const others = rows.filter((row) => row !== target);
        // Last of all: after the cards still to learn and the ones already done.
        await db.packMembers.bulkPut(settle([...others, { ...target, doneAt }]));
        await touch(packId, doneAt);
      }),
    removeMember: (packId, referenceId) =>
      db.transaction('rw', db.packs, db.packMembers, () => unfile(packId, referenceId)),
    async memberships() {
      const [packs, members] = await Promise.all([db.packs.toArray(), db.packMembers.toArray()]);
      const byId = new Map(packs.map((pack) => [pack.id, pack]));
      return members.flatMap((member) => {
        const pack = byId.get(member.packId);
        return pack ? [{ pack, member }] : [];
      });
    },
    async packsOf(referenceId) {
      const rows = await db.packMembers.where('referenceId').equals(referenceId).toArray();
      const packs = await db.packs.bulkGet(rows.map((row) => row.packId));
      return sortPacks(packs.filter((pack): pack is Pack => pack !== undefined));
    },
  };
}
