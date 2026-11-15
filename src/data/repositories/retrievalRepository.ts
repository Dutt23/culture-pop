import type { Source } from '../../domain/types';
import { candidateToReference } from '../../services/retrieval/toReference';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import type { PopCultureDb } from '../db';

export interface RetrievalRepository {
  /**
   * Caches candidates and their citations for offline reuse. Stored as `retrieved` references with
   * no interpretations, so they never satisfy cache-only resolution (spec §4). The query is not stored.
   */
  saveCandidates(candidates: readonly RetrievedCandidate[]): Promise<void>;
  getSources(ids: readonly string[]): Promise<Source[]>;
  /** Deletes every cached online result and every source curated content doesn't cite. */
  clear(): Promise<void>;
}

export function createRetrievalRepository(db: PopCultureDb): RetrievalRepository {
  return {
    saveCandidates: (candidates) =>
      db.transaction('rw', db.references, db.sources, async () => {
        const now = new Date().toISOString();
        const existing = await db.references.bulkGet(candidates.map((c) => c.id));
        // Never overwrite curated content with retrieved metadata.
        const writable = candidates
          .map((candidate, i) => ({ candidate, current: existing[i] }))
          .filter(({ current }) => !current || current.editorialState === 'retrieved');
        const sources = writable.flatMap(({ candidate }) => candidate.sources);
        // `url` is unique: a page re-created under a new ID would otherwise fail the whole save.
        const idByUrl = new Map(sources.map((s) => [s.url, s.id]));
        const replaced = await db.sources
          .where('url')
          .anyOf([...idByUrl.keys()])
          .filter((stored) => idByUrl.get(stored.url) !== stored.id)
          .primaryKeys();
        await db.sources.bulkDelete(replaced);
        await db.sources.bulkPut(sources);
        await db.references.bulkPut(
          writable.map(({ candidate, current }) =>
            candidateToReference(candidate, now, current?.createdAt),
          ),
        );
      }),
    async getSources(ids) {
      const rows = await db.sources.bulkGet([...ids]);
      return rows.filter((row): row is Source => row !== undefined);
    },
    clear: () =>
      db.transaction('rw', db.references, db.interpretations, db.sources, async () => {
        const references = await db.references.toArray();
        const retrieved = references.filter((r) => r.editorialState === 'retrieved');
        const kept = references.filter((r) => r.editorialState !== 'retrieved');
        const interpretations = await db.interpretations.toArray();
        const stillCited = new Set([
          ...kept.flatMap((r) => r.sourceIds),
          ...interpretations.flatMap((i) => i.sourceIds),
        ]);
        // Every uncited source goes, including ones orphaned when a later save cited fewer.
        const sourceIds = await db.sources.toCollection().primaryKeys();
        await db.sources.bulkDelete(sourceIds.filter((id) => !stillCited.has(id)));
        await db.references.bulkDelete(retrieved.map((r) => r.id));
      }),
  };
}
