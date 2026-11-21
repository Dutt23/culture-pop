import type { Alias, EditorialState, Interpretation, Reference, Source } from '../../domain/types';
import type { PopCultureDb } from '../db';

export interface SearchIndex {
  references: Reference[];
  aliases: Alias[];
  interpretations: Interpretation[];
  /** Full rows so cached online results can show their excerpt as a teaser. */
  sources: Source[];
  validSourceIds: Set<string>;
}

export interface ReferenceRepository {
  getAll(): Promise<Reference[]>;
  /** How many references the library holds (built-in plus cached online results). */
  count(): Promise<number>;
  getById(id: string): Promise<Reference | undefined>;
  getByIds(ids: readonly string[]): Promise<Reference[]>;
  getInterpretations(referenceId: string): Promise<Interpretation[]>;
  /** The interpretations of these references only, by index (D69). */
  getInterpretationsFor(referenceIds: readonly string[]): Promise<Interpretation[]>;
  /** The app's own library (demo and published), by index: no cached online results (D69). */
  getCurated(): Promise<Reference[]>;
  getAllInterpretations(): Promise<Interpretation[]>;
  getAllAliases(): Promise<Alias[]>;
  /** The aliases of these references only, by index (D69). */
  getAliasesFor(referenceIds: readonly string[]): Promise<Alias[]>;
  /** References whose title or an alias is exactly one of these normalised phrases (D69). */
  getByPhrases(phrases: readonly string[]): Promise<{ references: Reference[]; aliases: Alias[] }>;
  getSearchIndex(): Promise<SearchIndex>;
}

/** Every editorial state that isn't from an online search (`isFromOnline` is false). */
const CURATED_STATES: EditorialState[] = ['demo', 'published'];

export function createReferenceRepository(db: PopCultureDb): ReferenceRepository {
  return {
    getAll: () => db.references.orderBy('normalizedTitle').toArray(),
    count: () => db.references.count(),
    getById: (id) => db.references.get(id),
    async getByIds(ids) {
      const rows = await db.references.bulkGet([...ids]);
      return rows.filter((row): row is Reference => row !== undefined);
    },
    getInterpretations: (referenceId) =>
      db.interpretations.where('referenceId').equals(referenceId).sortBy('id'),
    getAllInterpretations: () => db.interpretations.toArray(),
    getInterpretationsFor: (referenceIds) =>
      db.interpretations
        .where('referenceId')
        .anyOf([...referenceIds])
        .toArray(),
    getCurated: () =>
      db.references.where('editorialState').anyOf(CURATED_STATES).sortBy('normalizedTitle'),
    getAllAliases: () => db.aliases.toArray(),
    getAliasesFor: (referenceIds) =>
      db.aliases
        .where('referenceId')
        .anyOf([...referenceIds])
        .toArray(),
    async getByPhrases(phrases) {
      const list = [...new Set(phrases)].filter(Boolean);
      if (list.length === 0) return { references: [], aliases: [] };
      const [byTitle, aliases] = await Promise.all([
        db.references.where('normalizedTitle').anyOf(list).toArray(),
        db.aliases.where('normalizedPhrase').anyOf(list).toArray(),
      ]);
      const titled = new Set(byTitle.map((r) => r.id));
      const missing = new Set(aliases.map((a) => a.referenceId).filter((id) => !titled.has(id)));
      const byAlias = await db.references.bulkGet([...missing]);
      const references = [...byTitle, ...byAlias.filter((r): r is Reference => r !== undefined)];
      return { references, aliases };
    },
    // The whole library, for search. Bounded by the cap on cached online results (D69); above
    // 1,000 cards it is read and held by the search worker, never the main thread.
    async getSearchIndex() {
      const [references, aliases, interpretations, sources] = await Promise.all([
        db.references.toArray(),
        db.aliases.toArray(),
        db.interpretations.toArray(),
        db.sources.toArray(),
      ]);
      return {
        references,
        aliases,
        interpretations,
        sources,
        validSourceIds: new Set(sources.map((s) => s.id)),
      };
    },
  };
}
