import Dexie, { type EntityTable } from 'dexie';
import type {
  Alias,
  Favourite,
  Interpretation,
  Reference,
  Setting,
  Source,
} from '../domain/types';
import { buildSeed } from './seed';

const DATABASE_NAME = 'pop-culture-decoder';

export type PopCultureDb = Dexie & {
  references: EntityTable<Reference, 'id'>;
  interpretations: EntityTable<Interpretation, 'id'>;
  aliases: EntityTable<Alias, 'id'>;
  sources: EntityTable<Source, 'id'>;
  favourites: EntityTable<Favourite, 'referenceId'>;
  settings: EntityTable<Setting, 'key'>;
};

/**
 * Versioned schema. Add a new `db.version(n)` block (with `.upgrade()` when data must move)
 * for every change; never edit a shipped version in place.
 */
export function createDatabase(name: string = DATABASE_NAME): PopCultureDb {
  const db = new Dexie(name) as PopCultureDb;

  db.version(1).stores({
    references: 'id, normalizedTitle, category, decade',
    interpretations: 'id, referenceId',
    // The same phrase may point at many references; uniqueness is per (phrase, reference).
    aliases: 'id, normalizedPhrase, referenceId, &[normalizedPhrase+referenceId]',
    sources: 'id, &url',
    favourites: 'referenceId, savedAt',
    settings: 'key',
  });

  db.on('populate', (tx) => {
    const seed = buildSeed();
    void tx.table('references').bulkAdd(seed.references);
    void tx.table('interpretations').bulkAdd(seed.interpretations);
    void tx.table('aliases').bulkAdd(seed.aliases);
  });

  return db;
}
