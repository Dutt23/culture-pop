import type { CSSProperties, ReactNode, Ref } from 'react';
import { classNames } from './classNames';
import styles from './Collection.module.css';

/**
 * One list view for the whole app (owner, 2026-11-21: "reuse it anywhere by just passing
 * inputs"). Pass the items, a key and a renderer; `variant` picks the layout:
 * - `rows`: a plain column, the default;
 * - `lanyards`: a grid of hanging passes (render a `Lanyard` per item), 1 / 2 / 3 columns at the
 *   40rem / 64rem breakpoints;
 * - `frames`: a film strip that scrolls sideways with sprocket edges and snaps frame by frame.
 *
 * Virtualising (rendering only what's on screen) is left to the caller: pass just the visible
 * slice as `items` and say where it sits with `window`, and each item still tells screen readers
 * its true place ("item 5,001 of 1,000,000"). `listRef` reaches the list (for a film strip, the
 * sideways scroller itself) and `padStart` / `padEnd` stand in for the rows that aren't drawn,
 * so the scrollbar keeps the whole list's size. No per-item motion here: recycled rows animating
 * in cost too much on old phones.
 */

export type CollectionVariant = 'rows' | 'lanyards' | 'frames';

export interface CollectionWindow {
  /** Index of `items[0]` in the whole list. */
  start: number;
  /** How many items the whole list has. */
  total: number;
}

export interface CollectionProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Names the list for screen readers. */
  label: string;
  variant?: CollectionVariant;
  /** Shown instead of the list when there are no items. */
  empty?: ReactNode;
  /** For a virtualised list: where the `items` slice sits in the whole list. */
  window?: CollectionWindow;
  /** The list element: for measuring, or as a film strip's sideways scroller. */
  listRef?: Ref<HTMLUListElement>;
  /** Space in px for the items before / after the slice (sideways for a film strip). */
  padStart?: number;
  padEnd?: number;
  className?: string;
}

export function Collection<T>({
  items,
  getKey,
  renderItem,
  label,
  variant = 'rows',
  empty,
  window: slice,
  listRef,
  padStart,
  padEnd,
  className,
}: CollectionProps<T>) {
  const start = slice?.start ?? 0;
  const total = slice?.total ?? items.length;
  if (total === 0 && empty) return <>{empty}</>;
  // The CSS adds it as padding: above and below for rows and lanyards, left and right inside a
  // film strip (which scrolls itself).
  const pad = {
    ...(padStart ? { '--pad-start': `${padStart}px` } : {}),
    ...(padEnd ? { '--pad-end': `${padEnd}px` } : {}),
  } as CSSProperties;
  return (
    <ul
      ref={listRef}
      style={padStart || padEnd ? pad : undefined}
      className={classNames(styles.collection, className)}
      data-variant={variant}
      aria-label={label}
      // A film strip scrolls sideways: it takes focus so arrow keys can scroll it.
      tabIndex={variant === 'frames' ? 0 : undefined}
    >
      {items.map((item, i) => (
        <li
          key={getKey(item)}
          className={styles.item}
          aria-setsize={slice ? total : undefined}
          aria-posinset={slice ? start + i + 1 : undefined}
        >
          {renderItem(item, start + i)}
        </li>
      ))}
    </ul>
  );
}
