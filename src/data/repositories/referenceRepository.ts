import type { Alias, Interpretation, Reference } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface SearchIndex {
  references: Reference[];
  aliases: Alias[];
  interpretations: Interpretation[];
  validSourceIds: Set<string>;
}

export interface ReferenceRepository {
  getAll(): Promise<Reference[]>;
  getById(id: string): Promise<Reference | undefined>;
  getByIds(ids: readonly string[]): Promise<Reference[]>;
  getInterpretations(referenceId: string): Promise<Interpretation[]>;
  getAllInterpretations(): Promise<Interpretation[]>;
  getAllAliases(): Promise<Alias[]>;
  getSearchIndex(): Promise<SearchIndex>;
}

export function createReferenceRepository(db: PopCultureDb): ReferenceRepository {
  return {
    getAll: () => db.references.orderBy('normalizedTitle').toArray(),
    getById: (id) => db.references.get(id),
    async getByIds(ids) {
      const rows = await db.references.bulkGet([...ids]);
      return rows.filter((row): row is Reference => row !== undefined);
    },
    getInterpretations: (referenceId) =>
      db.interpretations.where('referenceId').equals(referenceId).sortBy('id'),
    getAllInterpretations: () => db.interpretations.toArray(),
    getAllAliases: () => db.aliases.toArray(),
    // shortcut: loads the whole library into memory, fine for hundreds of records; query indexes once it grows past a few thousand.
    async getSearchIndex() {
      const [references, aliases, interpretations, sourceIds] = await Promise.all([
        db.references.toArray(),
        db.aliases.toArray(),
        db.interpretations.toArray(),
        db.sources.toCollection().primaryKeys(),
      ]);
      return { references, aliases, interpretations, validSourceIds: new Set(sourceIds) };
    },
  };
}
