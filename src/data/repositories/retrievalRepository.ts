import { groupBy } from '../../domain/collections';
import { isFromOnline, type Source } from '../../domain/types';
import { candidateToReference } from '../../services/retrieval/toReference';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import { storeCuration } from '../curationStore';
import type { PopCultureDb } from '../db';

export interface RetrievalRepository {
  /**
   * Caches candidates and their citations for offline reuse, then (re)curates each one from the
   * sources it now has (spec §5 Phase 3). A reference becomes `source_curated` only when the curator
   * produced a source-supported interpretation; otherwise it stays `retrieved`, unexplained and
   * never cache-eligible (spec §4). The query is not stored.
   */
  saveCandidates(candidates: readonly LibraryCandidate<RetrievedCandidate>[]): Promise<void>;
  getSources(ids: readonly string[]): Promise<Source[]>;
  /**
   * Deletes every online result (explained or not), any pack member rows that filed one, and every
   * source curated content doesn't cite.
   */
  clear(): Promise<void>;
}

/**
 * Compile-time lock (D45): anything carrying a `storage` level, i.e. any wider-web result, can't be
 * passed to the library save path. Wider-web results have their own device-only store.
 */
export type LibraryCandidate<T> = T & { storage?: never };

/**
 * Run-time lock (D45): only a well-formed candidate (`id`, `sources`) with no `storage` level is
 * saved to the library. Anything else is skipped silently, never thrown at the reader. Wikimedia
 * candidates carry no level because their licences allow caching (D31).
 */
export function isLibraryCandidate(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if ('storage' in record) return false;
  return typeof record.id === 'string' && Array.isArray(record.sources);
}

export function createRetrievalRepository(db: PopCultureDb): RetrievalRepository {
  return {
    saveCandidates: (input) =>
      db.transaction('rw', db.references, db.sources, db.interpretations, async () => {
        const candidates = input.filter(isLibraryCandidate);
        const now = new Date().toISOString();
        const existing = await db.references.bulkGet(candidates.map((c) => c.id));
        // Never overwrite editorial content with retrieved metadata.
        const writable = candidates
          .map((candidate, i) => ({ candidate, current: existing[i] }))
          .filter(({ current }) => !current || isFromOnline(current.editorialState));
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

        // Other cached references that cited a replaced source are re-curated from what they have left.
        const writtenIds = new Set(writable.map(({ candidate }) => candidate.id));
        const replacedIds = new Set(replaced);
        const affected =
          replacedIds.size === 0
            ? []
            : await db.references
                .filter(
                  (r) =>
                    isFromOnline(r.editorialState) &&
                    !writtenIds.has(r.id) &&
                    r.sourceIds.some((id) => replacedIds.has(id)),
                )
                .toArray();
        const remaining = await db.sources.bulkGet(affected.flatMap((r) => r.sourceIds));

        await storeCuration(
          db.references,
          db.interpretations,
          [
            ...writable.map(({ candidate, current }) => ({
              reference: candidateToReference(candidate, now, current?.createdAt),
              sources: candidate.sources,
            })),
            ...affected.map((reference) => {
              const sources = remaining.filter(
                (source): source is Source =>
                  source !== undefined && reference.sourceIds.includes(source.id),
              );
              // A year needs its source (spec §4); clear it on write so every reader can trust it.
              const yearLost =
                reference.year !== undefined &&
                !sources.some((s) => s.id === reference.yearSourceId);
              return {
                reference: yearLost
                  ? { ...reference, year: undefined, yearSourceId: undefined }
                  : reference,
                sources,
              };
            }),
          ],
          now,
        );
      }),
    async getSources(ids) {
      const rows = await db.sources.bulkGet([...ids]);
      return rows.filter((row): row is Source => row !== undefined);
    },
    clear: () =>
      db.transaction(
        'rw',
        [db.references, db.interpretations, db.sources, db.packMembers],
        async () => {
          const references = await db.references.toArray();
          const online = references.filter((r) => isFromOnline(r.editorialState));
          const onlineIds = new Set(online.map((r) => r.id));
          const kept = references.filter((r) => !onlineIds.has(r.id));
          const interpretations = await db.interpretations.toArray();
          const [dropped, keptInterpretations] = [
            interpretations.filter((i) => onlineIds.has(i.referenceId)),
            interpretations.filter((i) => !onlineIds.has(i.referenceId)),
          ];
          const stillCited = new Set([
            ...kept.flatMap((r) => r.sourceIds),
            ...keptInterpretations.flatMap((i) => i.sourceIds),
          ]);
          // Every uncited source goes, including ones orphaned when a later save cited fewer.
          const sourceIds = await db.sources.toCollection().primaryKeys();
          await db.sources.bulkDelete(sourceIds.filter((id) => !stillCited.has(id)));
          await db.interpretations.bulkDelete(dropped.map((i) => i.id));
          // A deleted reference leaves no pack member behind, and no gap in its packs' order.
          const unfiled = await db.packMembers
            .where('referenceId')
            .anyOf([...onlineIds])
            .toArray();
          await db.packMembers.bulkDelete(unfiled.map((m) => m.id));
          const left = await db.packMembers
            .where('packId')
            .anyOf([...new Set(unfiled.map((m) => m.packId))])
            .toArray();
          await db.packMembers.bulkPut(
            [...groupBy(left, (m) => m.packId).values()].flatMap((rows) =>
              [...rows]
                .sort((a, b) => a.position - b.position)
                .map((row, position) => ({ ...row, position })),
            ),
          );
          await db.references.bulkDelete([...onlineIds]);
        },
      ),
  };
}
