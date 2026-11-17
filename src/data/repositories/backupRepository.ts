import { groupBy } from '../../domain/collections';
import { normalizePhrase } from '../../domain/normalize';
import { isFromOnline, type Reference, type Source } from '../../domain/types';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  isPortableSetting,
  keepSources,
  type Backup,
  type BackupReference,
} from '../backup';
import type { PopCultureDb } from '../db';
import type { RetrievalRepository } from './retrievalRepository';
import type { SavedLinkRepository } from './savedLinkRepository';

export interface RestoreSummary {
  /** Favourites and pack cards left out because their card isn't in this library. */
  missingCards: number;
}

export interface BackupRepository {
  /** Favourites, packs, saved web links, portable settings and the online-found cards they use. */
  create(now: Date): Promise<Backup>;
  /**
   * Adds a parsed backup to this device in one transaction. Only adds: nothing already here is
   * changed or removed. A pack already here (the same pack, backed up earlier) gains the cards it
   * doesn't have; a setting already chosen here stays.
   */
  restore(backup: Backup): Promise<RestoreSummary>;
}

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

function toBackupReference(reference: Reference, sources: ReadonlyMap<string, Source>) {
  const backup: BackupReference = {
    id: reference.id,
    title: reference.title,
    kind: reference.kind,
    category: reference.category,
    year: reference.year,
    yearSourceId: reference.yearSourceId,
    creators: reference.creators,
    firstAppearance: reference.firstAppearance,
    presentIn: reference.presentIn,
    inspiredBy: reference.inspiredBy,
    sources: reference.sourceIds.map((id) => sources.get(id)).filter(isDefined),
    externalLinks: reference.externalLinks ?? [],
  };
  return backup;
}

export function createBackupRepository(
  db: PopCultureDb,
  retrieval: RetrievalRepository,
  savedLinks: SavedLinkRepository,
): BackupRepository {
  return {
    create: (now) =>
      db.transaction(
        'r',
        [
          db.favourites,
          db.savedLinks,
          db.settings,
          db.packs,
          db.packMembers,
          db.references,
          db.sources,
        ],
        async (): Promise<Backup> => {
          const [favourites, links, settings, packs, members] = await Promise.all([
            db.favourites.toArray(),
            savedLinks.list(),
            db.settings.toArray(),
            db.packs.toArray(),
            db.packMembers.toArray(),
          ]);
          // Library cards travel with the app; only cards found online need carrying.
          const usedIds = [...new Set([...favourites, ...members].map((row) => row.referenceId))];
          const online = (await db.references.bulkGet(usedIds)).filter(
            (r): r is Reference => r !== undefined && isFromOnline(r.editorialState),
          );
          // A card with no source left has nothing to show; restore would refuse it anyway.
          const sources = (await db.sources.bulkGet(online.flatMap((r) => r.sourceIds))).filter(
            isDefined,
          );
          const sourceById = new Map(sources.map((source) => [source.id, source]));
          const membersByPack = groupBy(members, (member) => member.packId);
          return {
            app: BACKUP_APP,
            version: BACKUP_VERSION,
            exportedAt: now.toISOString(),
            favourites: favourites.map(({ referenceId, savedAt }) => ({ referenceId, savedAt })),
            savedLinks: links.map(({ url, title, savedAt }) => ({ url, title, savedAt })),
            settings: settings.filter(isPortableSetting).map(({ key, value }) => ({ key, value })),
            packs: packs.map(({ id, name, ceiling, now: isNow, createdAt, updatedAt }) => ({
              id,
              name,
              ceiling,
              now: isNow,
              createdAt,
              updatedAt,
              members: [...(membersByPack.get(id) ?? [])]
                .sort((a, b) => a.position - b.position)
                .map(({ referenceId, addedAt, doneAt }) => ({ referenceId, addedAt, doneAt })),
            })),
            references: online
              .map((reference) => toBackupReference(reference, sourceById))
              .filter((reference) => reference.sources.length > 0),
          };
        },
      ),
    restore: (backup) =>
      db.transaction(
        'rw',
        [
          db.favourites,
          db.savedLinks,
          db.settings,
          db.packs,
          db.packMembers,
          db.references,
          db.sources,
          db.interpretations,
        ],
        async () => {
          // Only what isn't here yet: a card already on this device (library or online) stays.
          const known = await db.references.bulkGet(backup.references.map((r) => r.id));
          const fresh = backup.references.filter((_, i) => known[i] === undefined);
          const cited = fresh.flatMap((reference) => reference.sources);
          const stored = (await db.sources.bulkGet(cited.map((s) => s.id))).filter(isDefined);
          const storedById = new Map(stored.map((s) => [s.id, s]));
          const storedByUrl = new Map(
            (await db.sources.where('url').anyOf(cited.map((s) => s.url)).toArray()).map((s) => [
              s.url,
              s,
            ]),
          );
          // A source already stored is used as stored; one that clashes with a stored source (same
          // ID elsewhere, or same address under another ID) is left out, so no citation changes.
          const restorable = fresh.flatMap((reference) => {
            const kept = keepSources(
              reference,
              ({ id, url }) =>
                (storedById.get(id)?.url ?? url) === url && (storedByUrl.get(url)?.id ?? id) === id,
            );
            return kept
              ? [{ ...kept, sources: kept.sources.map((s) => storedById.get(s.id) ?? s) }]
              : [];
          });
          // The same save path as a search: re-explained from their sources. `role` and
          // `classifying` only matter while a search is running.
          await retrieval.saveCandidates(
            restorable.map((reference) => ({
              ...reference,
              classifying: false,
              role: 'topic' as const,
            })),
          );
          const usedIds = [
            ...new Set([
              ...backup.favourites.map((f) => f.referenceId),
              ...backup.packs.flatMap((pack) => pack.members.map((m) => m.referenceId)),
            ]),
          ];
          const present = new Set(
            (await db.references.bulkGet(usedIds)).filter(isDefined).map((r) => r.id),
          );
          const missing = new Set(usedIds.filter((id) => !present.has(id)));
          const inLibrary = ({ referenceId }: { referenceId: string }) => present.has(referenceId);
          const absent = (rows: readonly unknown[]) => rows.map((row) => row === undefined);

          const favourites = backup.favourites.filter(inLibrary);
          const favouriteIds = favourites.map((f) => f.referenceId);
          const newFavourite = absent(await db.favourites.bulkGet(favouriteIds));
          await db.favourites.bulkAdd(favourites.filter((_, i) => newFavourite[i]));
          const newLink = absent(await db.savedLinks.bulkGet(backup.savedLinks.map((l) => l.url)));
          await db.savedLinks.bulkAdd(backup.savedLinks.filter((_, i) => newLink[i]));
          // The reader's own choices on this device stay; the backup fills in the rest.
          const newSetting = absent(await db.settings.bulkGet(backup.settings.map((r) => r.key)));
          await db.settings.bulkAdd(backup.settings.filter((_, i) => newSetting[i]));

          // The backup's Now pack becomes Now only when this device has none.
          const hasNow = (await db.packs.toArray()).some((pack) => pack.now);
          const nowId = hasNow ? undefined : backup.packs.find((pack) => pack.now)?.id;
          for (const { members, ...pack } of backup.packs) {
            const existing = await db.packs.get(pack.id);
            if (!existing) {
              await db.packs.add({
                ...pack,
                normalizedName: normalizePhrase(pack.name),
                now: pack.id === nowId,
              });
            } else if (pack.id === nowId) {
              await db.packs.update(pack.id, { now: true });
            }
            // A pack already here keeps its name, cards and marks; the backup only adds cards.
            const current = await db.packMembers.where('packId').equals(pack.id).sortBy('position');
            const filed = new Set(current.map((m) => m.referenceId));
            const added = members
              .filter((m) => inLibrary(m) && !filed.has(m.referenceId))
              .map((member) => ({ ...member, id: `pm:${crypto.randomUUID()}`, packId: pack.id }));
            const all = [...current, ...added];
            // Cards still to learn first, then the done ones, as the pack page expects.
            const ordered = [...all.filter((m) => !m.doneAt), ...all.filter((m) => m.doneAt)];
            await db.packMembers.bulkPut(
              ordered.map((member, position) => ({ ...member, position })),
            );
          }
          return { missingCards: missing.size };
        },
      ),
  };
}
