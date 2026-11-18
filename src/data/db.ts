import Dexie, { type EntityTable, type InsertType, type Transaction } from 'dexie';
import type { HistoryEntry } from '../domain/history';
import type { SavedWebResults } from './repositories/webResultRepository';
import type {
  Alias,
  Favourite,
  Interpretation,
  Pack,
  PackMember,
  Reference,
  SavedLink,
  Setting,
  Source,
} from '../domain/types';
import { normalizePhrase } from '../domain/normalize';
import { storeCuration } from './curationStore';
import { buildSeed } from './seed';
import { CHAINSMOKERS_PACK } from './seedPackChainsmokers';
import { DOOMSDAY_PACK } from './seedPackDoomsday';

const DATABASE_NAME = 'pop-culture-decoder';

export type PopCultureDb = Dexie & {
  references: EntityTable<Reference, 'id'>;
  interpretations: EntityTable<Interpretation, 'id'>;
  aliases: EntityTable<Alias, 'id'>;
  sources: EntityTable<Source, 'id'>;
  favourites: EntityTable<Favourite, 'referenceId'>;
  settings: EntityTable<Setting, 'key'>;
  searchHistory: EntityTable<HistoryEntry, 'id'>;
  webResults: EntityTable<SavedWebResults, 'key'>;
  savedLinks: EntityTable<SavedLink, 'url'>;
  packs: EntityTable<Pack, 'id'>;
  packMembers: EntityTable<PackMember, 'id'>;
};

/** Shipped schema v1. Exported so upgrade tests can create a genuine v1 database. */
export const SCHEMA_V1 = {
  references: 'id, normalizedTitle, category, decade',
  interpretations: 'id, referenceId',
  // The same phrase may point at many references; uniqueness is per (phrase, reference).
  aliases: 'id, normalizedPhrase, referenceId, &[normalizedPhrase+referenceId]',
  sources: 'id, &url',
  favourites: 'referenceId, savedAt',
  settings: 'key',
} as const;

/** v2 changes on top of v1. Exported so upgrade tests can create a genuine v2 database. */
export const SCHEMA_V2_CHANGES = {
  references: 'id, normalizedTitle, category, decade, kind',
} as const;

/**
 * v4 changes: search history (D37). `lastSearchedAt` serves "recent searches" and expiry;
 * `[tier+score]` serves Frequent's top-k and its next eviction from the stored, time-invariant score.
 */
export const SCHEMA_V4_CHANGES = {
  searchHistory: 'id, lastSearchedAt, [tier+score]',
} as const;

/**
 * v5 changes: wider-web results kept on this device only (D45), keyed by the normalized query, apart
 * from the library. `savedAt` serves the 30-day expiry. Never synced or sent anywhere: a future
 * cross-device sync must skip this table.
 */
export const SCHEMA_V5_CHANGES = {
  webResults: 'key, savedAt',
} as const;

/**
 * v6 changes: wider-web links the reader saves (D46, owner choice "A"). Title and link only, never
 * the snippet: the snippet is the search provider's output, while a bare link is a bookmark to a
 * public page. Kept until the reader removes it, on this device only: never synced or sent anywhere,
 * so a future cross-device sync must skip this table. `savedAt` serves newest-first listing.
 */
export const SCHEMA_V6_CHANGES = {
  savedLinks: 'url, savedAt',
} as const;

/**
 * v8 changes: packs, the reader's named folders of existing references, and their member rows.
 * `&[packId+referenceId]` files a reference at most once per pack; `[packId+position]` serves the
 * manual order. Booleans aren't valid IndexedDB keys, so `now` is never queried through its index.
 */
export const SCHEMA_V8_CHANGES = {
  packs: 'id, normalizedName, now, updatedAt',
  packMembers: 'id, packId, referenceId, [packId+position], &[packId+referenceId]',
} as const;

/** Replaces the app's own built-in rows from the current seed; nothing the reader made is touched. */
async function refreshBuiltIns(tx: Transaction) {
  const seed = buildSeed();
  await tx.table('references').bulkPut(seed.references);
  await tx.table('interpretations').bulkPut(seed.interpretations);
  await tx.table('aliases').bulkPut(seed.aliases);
}

/** The app's ready-made packs: a film to get ready for, and a concert. */
export const READY_PACKS = [DOOMSDAY_PACK, CHAINSMOKERS_PACK] as const;

/**
 * Adds each ready-made pack once, unless the reader already has it (or a pack with its id). A
 * reader who deletes one keeps it deleted: no later version adds it again.
 */
async function addReadyPacks(tx: Transaction) {
  const now = new Date().toISOString();
  for (const { id, name, referenceIds } of READY_PACKS) {
    if (await tx.table('packs').get(id)) continue;
    await tx.table('packs').add({
      id,
      name,
      normalizedName: normalizePhrase(name),
      ceiling: 'before_watching',
      now: false,
      createdAt: now,
      updatedAt: now,
    } satisfies Pack);
    await tx.table('packMembers').bulkAdd(
      referenceIds.map((referenceId, position): PackMember => ({
        id: `pm:${id}:${referenceId}`,
        packId: id,
        referenceId,
        position,
        addedAt: now,
      })),
    );
  }
}

export interface DatabaseOptions {
  /** Start with the ready-made packs. Tests turn them off so every pack test starts with none. */
  readyPack?: boolean;
}

/**
 * Versioned schema. Add a new `db.version(n)` block (with `.upgrade()` when data must move)
 * for every change; never edit a shipped version in place.
 */
export function createDatabase(
  name: string = DATABASE_NAME,
  { readyPack = true }: DatabaseOptions = {},
): PopCultureDb {
  const db = new Dexie(name) as PopCultureDb;

  db.version(1).stores(SCHEMA_V1);

  // v2 (Phase 2): references gain `kind`, `sourceIds` and an optional sourced `year`.
  db.version(2)
    .stores(SCHEMA_V2_CHANGES)
    .upgrade(async (tx) => {
      const seedKinds = new Map(buildSeed().references.map((r) => [r.id, r.kind]));
      // Dexie's modify() edits rows in place by design.
      await tx
        .table<Reference>('references')
        .toCollection()
        .modify((reference) => {
          reference.kind ??= seedKinds.get(reference.id) ?? 'other';
          reference.sourceIds ??= [];
        });
    });

  // v3 (Phase 3): interpretations gain `relation` (and an optional sourced `relatedReferenceId`);
  // references gain the `source_curated` state. No index changes. Cached online results are
  // curated from the sources already on the device, so an upgrade explains what it can.
  db.version(3)
    .stores({})
    .upgrade(async (tx) => {
      const interpretations = tx.table<Interpretation, string, InsertType<Interpretation, 'id'>>(
        'interpretations',
      );
      const references = tx.table<Reference, string, InsertType<Reference, 'id'>>('references');
      // Every v2 interpretation is a demo meaning about its own reference.
      await interpretations.toCollection().modify((interpretation) => {
        interpretation.relation ??= 'original';
      });
      const cached = await references.filter((r) => r.editorialState === 'retrieved').toArray();
      const sources = await tx
        .table<Source, string>('sources')
        .bulkGet([...new Set(cached.flatMap((r) => r.sourceIds))]);
      const byId = new Map(sources.flatMap((s) => (s ? [[s.id, s] as const] : [])));
      await storeCuration(
        references,
        interpretations,
        cached.map((reference) => ({
          reference,
          sources: reference.sourceIds.flatMap((id) => byId.get(id) ?? []),
        })),
        new Date().toISOString(),
      );
    });

  // v4 (Phase 3): a new, empty search history table. Nothing to move.
  db.version(4).stores(SCHEMA_V4_CHANGES);

  // v5 (backend phase): a new, empty store for wider-web results kept on this device. Nothing to move.
  db.version(5).stores(SCHEMA_V5_CHANGES);

  // v6: a new, empty store for saved wider-web links. Nothing to move.
  db.version(6).stores(SCHEMA_V6_CHANGES);

  // v7 (Phase 5): built-in entries gain the glance-card lines (`gist`, `socialMove`). A later batch
  // of built-in cards ships the same way, with its own version.
  db.version(7).stores({}).upgrade(refreshBuiltIns);

  // v8: new, empty stores for packs and their member rows. Nothing to move.
  db.version(8).stores(SCHEMA_V8_CHANGES);

  // v9: the "you'll hear this" pack, batch 1 (30 built-in cards). No index changes.
  db.version(9).stores({}).upgrade(refreshBuiltIns);

  // v10: the "you'll hear this" pack, batch 2 (30 more built-in cards). No index changes.
  db.version(10).stores({}).upgrade(refreshBuiltIns);

  // v11: anime is its own category (search tags). Built-in entries the seed now files as anime are
  // refreshed like any built-in batch; saved online results keep their category until a new lookup
  // of that search refreshes them.
  db.version(11).stores({}).upgrade(refreshBuiltIns);

  // v12: the "you'll hear this" pack, batch 3 (30 cards), and two ready-made packs with their cards:
  // "Before Avengers: Doomsday" and "Before The Chainsmokers live". No index changes.
  db.version(12)
    .stores({})
    .upgrade(async (tx) => {
      await refreshBuiltIns(tx);
      if (readyPack) await addReadyPacks(tx);
    });

  db.on('populate', (tx) => {
    const seed = buildSeed();
    void tx.table('references').bulkAdd(seed.references);
    void tx.table('interpretations').bulkAdd(seed.interpretations);
    void tx.table('aliases').bulkAdd(seed.aliases);
    if (readyPack) void addReadyPacks(tx);
  });

  return db;
}
