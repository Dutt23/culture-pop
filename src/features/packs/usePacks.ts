import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { useRepositories } from '../../app/useRepositories';
import { PackNameError } from '../../data/repositories/packRepository';
import { ALL_PACK_MEMBERS_UP_TO, rememberSize, wasLarge } from '../../data/scale';
import type { SegmentedOption } from '../../components/ui/SegmentedControl';
import { groupBy } from '../../domain/collections';
import { CEILING_LABEL } from '../../domain/labels';
import { sortPacks, type PackIndex } from '../../domain/packs';
import type { Pack, PackCeiling, Reference } from '../../domain/types';

/** Drag data: the reference ID of a card being dragged onto a pack or a place in one. */
export const REFERENCE_DRAG_TYPE = 'application/x-culture-pop-ref';

/** Drag data: the pack the card was dragged out of, so dropping it on another pack moves it. */
export const FROM_PACK_DRAG_TYPE = 'application/x-culture-pop-from-pack';

/** A card that just left the open pack, kept so the reader can undo it. */
export interface LeftCard {
  referenceId: string;
  title: string;
  /** Its place in the pack, to put it back there. */
  index: number;
  /** Set when it was moved to another pack rather than removed. */
  movedTo?: { id: string; name: string };
}

/** Cards shown per pack in all-packs results before "N more". */
export const CARDS_PER_GROUP = 3;

export const CEILING_OPTIONS: readonly SegmentedOption<PackCeiling>[] = [
  { value: 'before_watching', label: CEILING_LABEL.before_watching },
  { value: 'open', label: CEILING_LABEL.open },
];

/** A pack's page, optionally opened on a search. */
export function packPath(packId: string, query = ''): string {
  const path = `/packs/${encodeURIComponent(packId)}`;
  return query ? `${path}?q=${encodeURIComponent(query)}` : path;
}

export function cardCount(count: number): string {
  return count === 1 ? '1 card' : `${count} cards`;
}

/** Accepts only a dragged card, never other drags (text, links, files). */
export function acceptsCard(event: DragEvent): boolean {
  if (!event.dataTransfer.types.includes(REFERENCE_DRAG_TYPE)) return false;
  event.preventDefault();
  return true;
}

const SAVE_ERROR = "Couldn't save that change. Please try again.";

export interface PackData {
  /** What pack search reads: packs (Now first), member rows and only the filed references. */
  index: PackIndex;
  /** The packs each filed reference is in, listed Now first. */
  packsByReference: ReadonlyMap<string, Pack[]>;
  /** Per pack ID, how many cards are still to learn; a pack with none may be missing. */
  counts: ReadonlyMap<string, number>;
}

/**
 * Every pack with its memberships. Reads only what is filed, never the whole library or online.
 * Pass `needsMembers = false` when only the pack list and its counts are shown: a big library
 * (over `ALL_PACK_MEMBERS_UP_TO` filed cards) then reads packs and counts alone, and every member
 * row, filed card and alias only once members are needed again. A small one reads as before.
 */
export function usePackData(needsMembers = true): PackData | undefined {
  const { packs, references } = useRepositories();
  const countsOnly = !needsMembers && wasLarge('packMembers', ALL_PACK_MEMBERS_UP_TO);
  const raw = useLiveQuery(async () => {
    if (countsOnly) {
      const list = await packs.list();
      const counts = await packs.memberCounts(list.map((pack) => pack.id));
      rememberSize(
        'packMembers',
        [...counts.values()].reduce((sum, c) => sum + c.total, 0),
      );
      return { countsOnly: true as const, list, counts };
    }
    const [list, memberships] = await Promise.all([packs.list(), packs.memberships()]);
    rememberSize('packMembers', memberships.length);
    const filedIds = [...new Set(memberships.map(({ member }) => member.referenceId))];
    // Only the filed cards' aliases, by index: never the whole alias table (D69).
    const [filed, aliases] = await Promise.all([
      references.getByIds(filedIds),
      references.getAliasesFor(filedIds),
    ]);
    return { countsOnly: false as const, list, memberships, filed, aliases };
  }, [packs, references, countsOnly]);

  // Built once per database change, so the ranking's index (cached on these arrays) is reused.
  return useMemo(() => {
    // A live query keeps its last result while the next loads: never hand counts-only data to a
    // search, which would read as "nothing found".
    if (!raw || raw.countsOnly !== countsOnly) return undefined;
    if (raw.countsOnly) {
      return {
        index: { packs: raw.list, members: [], references: [], aliases: [] },
        packsByReference: new Map<string, Pack[]>(),
        counts: new Map([...raw.counts].map(([id, count]) => [id, count.toLearn])),
      };
    }
    const members = raw.memberships.map(({ member }) => member);
    const stillToLearn = members.filter((member) => !member.doneAt);
    const byReference = groupBy(raw.memberships, ({ member }) => member.referenceId);
    return {
      index: { packs: raw.list, members, references: raw.filed, aliases: raw.aliases },
      packsByReference: new Map(
        [...byReference].map(([id, rows]) => [id, sortPacks(rows.map(({ pack }) => pack))]),
      ),
      counts: new Map(
        [...groupBy(stillToLearn, (m) => m.packId)].map(([id, rows]) => [id, rows.length]),
      ),
    };
  }, [raw, countsOnly]);
}

/** `undefined` while loading, `null` when the pack does not exist. */
export function usePack(packId: string): Pack | null | undefined {
  const { packs } = useRepositories();
  return useLiveQuery(async () => (await packs.get(packId)) ?? null, [packs, packId]);
}

export interface PackCards {
  /** Still to learn, in position order. */
  active: Reference[];
  /** Marked "Got it", in the order they were marked. */
  done: Reference[];
}

/** The pack's cards in position order, split by "Got it". */
export function usePackMembers(packId: string): PackCards | undefined {
  const { packs, references } = useRepositories();
  return useLiveQuery(async () => {
    const members = await packs.members(packId);
    const doneIds = new Set(members.filter((m) => m.doneAt).map((m) => m.referenceId));
    const cards = await references.getByIds(members.map((member) => member.referenceId));
    return {
      active: cards.filter((card) => !doneIds.has(card.id)),
      done: cards.filter((card) => doneIds.has(card.id)),
    };
  }, [packs, references, packId]);
}

/** The packs a reference is filed in, Now first; `undefined` until this reference's are read. */
export function usePacksOf(referenceId: string): Pack[] | undefined {
  const { packs } = useRepositories();
  const result = useLiveQuery(
    async () => ({ referenceId, packs: await packs.packsOf(referenceId) }),
    [packs, referenceId],
  );
  // A live query keeps its last result while the next one loads: never hand back another card's.
  return result?.referenceId === referenceId ? result.packs : undefined;
}

/** Runs a pack change and keeps a plain error message when it fails. */
export function useAttempt(): {
  error: string | null;
  attempt: (action: () => Promise<unknown>) => Promise<boolean>;
} {
  const [error, setError] = useState<string | null>(null);
  const attempt = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof PackNameError ? cause.message : SAVE_ERROR);
      return false;
    }
  }, []);
  return { error, attempt };
}

/** Only a mouse or trackpad drags cards; touch files them with the Move sheet. */
export function useFinePointer(): boolean {
  const [fine] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches,
  );
  return fine;
}
