import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useRef, useState } from 'react';

/**
 * Rows read per page (D69, D70): a list up to 1,000 is read in one go, as before; a read of 1,000
 * rows by an index takes a few ms. Drawing is a separate limit (`DRAW_ALL_UP_TO`).
 */
export const PAGE_SIZE = 1000;

export interface PagedList<T> {
  /** The rows read so far, in list order; `undefined` until the first page arrives. */
  rows: readonly T[] | undefined;
  /** How many rows the whole list has (for screen readers and "more to load"). */
  total: number;
  /** Asks for the next page; does nothing once every row is read. */
  more: () => void;
}

/**
 * A live list read page by page (D69): `load(limit)` returns the first `limit` rows by an index,
 * and `count()` the whole list's size. Only what has been read is re-read when the table changes,
 * never the whole table. `deps` are the inputs `load` and `count` depend on, as with useLiveQuery.
 */
export function usePagedList<T>(
  load: (limit: number) => Promise<T[]>,
  count: () => Promise<number>,
  deps: readonly unknown[],
): PagedList<T> {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const loaded = useLiveQuery(() => load(limit), [...deps, limit]);
  const total = useLiveQuery(count, [...deps]) ?? 0;
  // While the next page loads, keep showing what's already there instead of flashing empty.
  const last = useRef<readonly T[] | undefined>(undefined);
  if (loaded !== undefined) last.current = loaded;
  const rows = last.current;
  // Grows by the stored count, not the rows shown: a caller may drop rows (a favourite whose card
  // is gone), and the list must still load past them.
  const more = useCallback(() => {
    setLimit((current) => (current < total ? current + PAGE_SIZE : current));
  }, [total]);
  return { rows, total: Math.max(total, rows?.length ?? 0), more };
}
