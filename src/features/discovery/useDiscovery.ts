import { useLiveQuery } from 'dexie-react-hooks';
import { useRepositories } from '../../app/useRepositories';
import { isLarge, rememberSize, wasLarge, WORKER_FROM_CARDS } from '../../data/scale';
import { discoverable } from '../../domain/discovery';
import { summarizeByReference, type CardSummary } from '../../domain/summaries';
import type { Reference } from '../../domain/types';

export interface DiscoveryData {
  references: Reference[];
  summaries: Map<string, CardSummary>;
}

// Search history holds at most a couple of hundred searches; this asks for all of them.
const ALL_SEARCHES = Number.MAX_SAFE_INTEGER;
/**
 * EXPERIMENTAL large-library mode (D69): found-online cards join Discover when favourited; the
 * newest this many favourites are looked at, so a huge favourites list isn't loaded here.
 */
const RECENT_FAVOURITES = 500;

/**
 * Discovery reads the local library plus the found-online references the reader opened from a
 * search or favourited (see `discoverable`). Clearing saved online results, history or favourites
 * changes the list, so this follows live. No browsing activity is recorded.
 */
export function useDiscovery(): DiscoveryData | undefined {
  const { references, history, favourites } = useRepositories();
  return useLiveQuery(async () => {
    // A small library (every reader today) is read in one go, exactly as before D69, with the
    // library counted alongside rather than first, so it costs no extra round trip.
    if (!wasLarge('references', WORKER_FROM_CARDS)) {
      const [size, all, interpretations, searches, saved] = await Promise.all([
        references.count(),
        references.getAll(),
        references.getAllInterpretations(),
        history.recent(ALL_SEARCHES, Date.now()),
        favourites.list(),
      ]);
      rememberSize('references', size);
      if (!isLarge(size, WORKER_FROM_CARDS)) {
        const opened = new Set(searches.flatMap((search) => search.referenceIds));
        const favouriteIds = new Set(saved.map((row) => row.referenceId));
        return {
          references: discoverable(all, opened, favouriteIds),
          summaries: summarizeByReference(interpretations),
        };
      }
    }
    // EXPERIMENTAL: a big library is read by index, the curated library plus only the
    // found-online cards that can show, never every cached online result.
    const [size, curated, searches, saved] = await Promise.all([
      references.count(),
      references.getCurated(),
      history.recent(ALL_SEARCHES, Date.now()),
      favourites.list(RECENT_FAVOURITES),
    ]);
    rememberSize('references', size);
    const opened = new Set(searches.flatMap((search) => search.referenceIds));
    const favouriteIds = new Set(saved.map((row) => row.referenceId));
    const curatedIds = new Set(curated.map((r) => r.id));
    const onlineIds = [...new Set([...opened, ...favouriteIds])].filter(
      (id) => !curatedIds.has(id),
    );
    const [online, interpretations] = await Promise.all([
      references.getByIds(onlineIds),
      references.getInterpretationsFor([...curatedIds, ...onlineIds]),
    ]);
    const shown = discoverable([...curated, ...online], opened, favouriteIds);
    const shownIds = new Set(shown.map((r) => r.id));
    return {
      references: shown,
      summaries: summarizeByReference(interpretations.filter((i) => shownIds.has(i.referenceId))),
    };
  }, [references, history, favourites]);
}
