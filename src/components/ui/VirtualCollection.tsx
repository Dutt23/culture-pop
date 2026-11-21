import {
  defaultRangeExtractor,
  measureElement,
  useWindowVirtualizer,
  type Range,
} from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { classNames } from './classNames';
import { Collection } from './Collection';
import styles from './VirtualCollection.module.css';

/** Rows kept in the page beyond each edge of the screen, so a fast scroll never shows a gap. */
const OVERSCAN = 4;
/** Ask for the next page this many items before the end of what's been read. */
const LOAD_AHEAD = 10;
/**
 * Lists this short are drawn whole, exactly as before D69 (every reader today): only longer ones
 * draw just the rows near the screen.
 */
export const DRAW_ALL_UP_TO = 200;

export interface VirtualCollectionProps<T> {
  /** The items read so far (a paged list's `rows`). */
  items: readonly T[];
  /** How many items the whole list has; screen readers hear each row's true place. */
  total: number;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
  /** A first guess at one row's height in px; each row is measured once it's in the page. */
  estimateSize: number;
  /**
   * Lay items side by side once the list is wide enough for two of this width (in rem): a row
   * then holds as many as fit. Without it, one item per row.
   */
  minItemRem?: number;
  /** Called when the reader nears the end of `items` and `total` says there are more. */
  onNeedMore?: () => void;
  empty?: ReactNode;
  className?: string;
}

interface ListPlace {
  /** The list's distance from the top of the page. */
  top: number;
  width: number;
  rowGap: number;
  columnGap: number;
  rem: number;
}

const START: ListPlace = { top: 0, width: 0, rowGap: 0, columnGap: 0, rem: 16 };

/** The list's place, width and gaps, kept current as the page above it or the window changes. */
function useListPlace(list: RefObject<HTMLUListElement | null>, enabled: boolean): ListPlace {
  const [place, setPlace] = useState(START);
  const measure = useCallback(() => {
    const element = list.current;
    if (!enabled || !element) return;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const next: ListPlace = {
      top: rect.top + window.scrollY,
      width: rect.width,
      rowGap: parseFloat(style.rowGap) || 0,
      columnGap: parseFloat(style.columnGap) || parseFloat(style.rowGap) || 0,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    };
    setPlace((prev) =>
      (Object.keys(next) as (keyof ListPlace)[]).every((key) => prev[key] === next[key])
        ? prev
        : next,
    );
  }, [list, enabled]);
  // After each render: what sits above the list may have changed height.
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => observer?.disconnect();
  }, [measure]);
  return place;
}

/** Items per row: as many of `minPx` as fit with their gaps, at least one. */
export function columnsFor(width: number, minPx: number, gap: number): number {
  if (minPx <= 0 || width <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (minPx + gap)));
}

/**
 * A `Collection` that draws only the rows near the screen (D69): the page holds a few dozen rows
 * however long the list, and the padding above and below keeps the scrollbar the whole list's
 * size. Used with `usePagedList`, the next page is read as the reader nears the end. The row
 * holding keyboard focus stays in the page when scrolled away, so focus is never lost.
 */
export function VirtualCollection<T>({
  items,
  total,
  getKey,
  renderItem,
  label,
  estimateSize,
  minItemRem,
  onNeedMore,
  empty,
  className,
}: VirtualCollectionProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  // A short list is drawn whole with the caller's own layout (its CSS grid, if any), as before,
  // and pays nothing for measuring or the virtualiser.
  const drawAll = total <= DRAW_ALL_UP_TO;
  const place = useListPlace(listRef, !drawAll);
  const columns =
    minItemRem && !drawAll ? columnsFor(place.width, minItemRem * place.rem, place.columnGap) : 1;
  const rows = useMemo(
    () =>
      Array.from({ length: Math.ceil(items.length / columns) }, (_, row) =>
        items.slice(row * columns, row * columns + columns),
      ),
    [items, columns],
  );

  const [focused, setFocused] = useState<number | null>(null);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const shown = defaultRangeExtractor(range);
      if (focused === null || focused >= rows.length || shown.includes(focused)) return shown;
      // Keep the slice contiguous: stretch it to reach the focused row.
      const from = Math.min(focused, shown[0] ?? focused);
      const to = Math.max(focused, shown.at(-1) ?? focused);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    },
    [focused, rows.length],
  );
  const virtualizer = useWindowVirtualizer({
    enabled: !drawAll,
    count: rows.length,
    estimateSize: () => estimateSize,
    // Without layout (tests) a row measures 0: keep the estimate so rows don't pile up.
    measureElement: (element, entry, instance) =>
      measureElement(element, entry, instance) || estimateSize,
    getItemKey: (index) => getKey(rows[index]?.[0] as T),
    overscan: OVERSCAN,
    gap: place.rowGap,
    scrollMargin: place.top,
    rangeExtractor,
  });

  const shown = virtualizer.getVirtualItems();
  const first = shown[0];
  const last = shown.at(-1);
  const lastItem = last ? Math.min(items.length, (last.index + 1) * columns) - 1 : -1;
  useEffect(() => {
    // A short list is drawn whole, so it reads its last rows straight away.
    const nearEnd = drawAll || lastItem >= items.length - LOAD_AHEAD;
    if (onNeedMore && items.length < total && nearEnd) onNeedMore();
  }, [drawAll, lastItem, items.length, total, onNeedMore]);

  const slice = drawAll ? rows : first && last ? rows.slice(first.index, last.index + 1) : [];
  const sliceStart = drawAll ? 0 : (first?.index ?? 0);
  const padStart = !drawAll && first ? first.start - place.top : 0;
  const padEnd =
    !drawAll && last ? Math.max(0, virtualizer.getTotalSize() - (last.end - place.top)) : 0;
  const rowKey = (row: readonly T[]) => getKey(row[0] as T);

  return (
    <div
      onFocus={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
        setFocused(row ? Number(row.dataset.index) : null);
      }}
      onBlur={(event) => {
        // Switching apps blurs too, and focus comes back to the same row: keep it.
        if (!document.hasFocus()) return;
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
      }}
    >
      <Collection
        label={label}
        items={slice}
        getKey={rowKey}
        empty={empty}
        // Virtual rows stack in one column; each row lays out its own items side by side.
        className={classNames(className, !drawAll && styles.virtual)}
        listRef={listRef}
        // Each row is one list item; with one column that is one item, at its true place.
        window={{ start: sliceStart, total: Math.ceil(total / columns) }}
        padStart={padStart}
        padEnd={padEnd}
        renderItem={(row, rowIndex) => (
          <div
            data-index={rowIndex}
            ref={drawAll ? undefined : virtualizer.measureElement}
            className={columns > 1 ? styles.row : undefined}
            style={columns > 1 ? ({ '--columns': columns } as CSSProperties) : undefined}
          >
            {row.map((item, column) => (
              <div key={getKey(item)} className={styles.cell}>
                {renderItem(item, rowIndex * columns + column)}
              </div>
            ))}
          </div>
        )}
      />
    </div>
  );
}
