import Dexie, { type EntityTable, type InsertType } from 'dexie';
import type { HistoryEntry } from '../domain/history';
import type { Alias, Favourite, Interpretation, Reference, Setting, Source } from '../domain/types';
import { storeCuration } from './curationStore';
import { buildSeed } from './seed';

const DATABASE_NAME = 'pop-culture-decoder';

export type PopCultureDb = Dexie & {
  references: EntityTable<Reference, 'id'>;
  interpretations: EntityTable<Interpretation, 'id'>;
  aliases: EntityTable<Alias, 'id'>;
  sources: EntityTable<Source, 'id'>;
  favourites: EntityTable<Favourite, 'referenceId'>;
  settings: EntityTable<Setting, 'key'>;
  searchHistory: EntityTable<HistoryEntry, 'id'>;
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
 * Versioned schema. Add a new `db.version(n)` block (with `.upgrade()` when data must move)
 * for every change; never edit a shipped version in place.
 */
export function createDatabase(name: string = DATABASE_NAME): PopCultureDb {
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

  db.on('populate', (tx) => {
    const seed = buildSeed();
    void tx.table('references').bulkAdd(seed.references);
    void tx.table('interpretations').bulkAdd(seed.interpretations);
    void tx.table('aliases').bulkAdd(seed.aliases);
  });

  return db;
}
