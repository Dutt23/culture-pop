import { useState } from 'react';

export interface HeldResults<T> {
  /** On screen, in the order they first appeared; each item is its latest version. */
  shown: T[];
  /** Arrived after the first results were on screen; waiting behind "N new results". */
  held: T[];
  showHeld: () => void;
}

/**
 * Keeps a streamed list still once something is on screen (D37): the first non-empty batch shows,
 * later arrivals wait until `showHeld`, so cards never move under the reader's finger. Shown items
 * still update in place. On the reader's tap, held items that `isLead` marks (the page named by the
 * search) go to the top, above quote pages that happened to arrive first; the rest go below the
 * cards already shown, in arrival order. Starts over when `key` (the query) changes.
 */
export function useHeldResults<T extends { id: string }>(
  items: readonly T[],
  key: string,
  isLead: (item: T) => boolean = () => false,
  /** Lookup finished: show every card. Holding them past the end is how a result stays missing. */
  releaseHeld = false,
): HeldResults<T> {
  const [state, setState] = useState<{ key: string; ids: string[] }>({ key, ids: [] });
  const byId = new Map(items.map((item) => [item.id, item]));
  // Only IDs still present count as on screen (a retry can start the list over).
  const current = (state.key === key ? state.ids : []).filter((id) => byId.has(id));
  // Nothing on screen yet: adopt whatever has arrived (state adjusted during render, React's pattern).
  const ids = current.length === 0 ? items.map((item) => item.id) : current;
  if (state.key !== key || (current.length === 0 && ids.length > 0)) setState({ key, ids });

  const shownIds = new Set(ids);
  const held = items.filter((item) => !shownIds.has(item.id));
  const idsOf = (list: readonly T[]) => list.map((item) => item.id);
  const released = releaseHeld && held.length > 0;
  const visibleIds = released
    ? [...idsOf(held.filter(isLead)), ...ids, ...idsOf(held.filter((item) => !isLead(item)))]
    : ids;
  if (released) setState({ key, ids: visibleIds });
  return {
    shown: visibleIds.flatMap((id) => byId.get(id) ?? []),
    held: released ? [] : held,
    showHeld: () =>
      setState({
        key,
        ids: [
          ...idsOf(held.filter(isLead)),
          ...ids,
          ...idsOf(held.filter((item) => !isLead(item))),
        ],
      }),
  };
}
