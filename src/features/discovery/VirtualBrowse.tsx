import {
  defaultRangeExtractor,
  measureElement,
  useWindowVirtualizer,
  type Range,
} from '@tanstack/react-virtual';
import { m } from 'motion/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ReferenceCard,
  type ReferenceCardFavourite,
} from '../../components/reference-card/ReferenceCard';
import type { CardSummary } from '../../domain/summaries';
import type { Reference } from '../../domain/types';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { browseRows, columnsFor, type BrowseGroup } from './browseRows';
import styles from './VirtualBrowse.module.css';

/** Match `--size-card-row` and `--space-3` in tokens.css, in rem. */
const CARD_MIN_REM = 15;
const GAP_REM = 0.75;
/** Rows kept in the page beyond each edge of the screen, so scrolling never shows a gap. */
const OVERSCAN_ROWS = 2;
/** First guesses only; every row is measured once it's in the page. */
const HEADING_ESTIMATE_PX = 56;
const CARDS_ESTIMATE_PX = 210;

interface ListBox {
  width: number;
  /** The list's distance from the top of the page. */
  top: number;
  rem: number;
}

/** The list's width and place on the page, kept current as the window or the content above it changes. */
function useListBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<ListBox>({ width: 0, top: 0, rem: 16 });

  const measure = useCallback(() => {
    const list = ref.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const next = {
      width: rect.width,
      top: rect.top + window.scrollY,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    };
    setBox((prev) =>
      prev.width === next.width && prev.top === next.top && prev.rem === next.rem ? prev : next,
    );
  }, []);

  // After every render: the page above the list (regulars, chips, the surprise) may have changed.
  useLayoutEffect(measure);

  useLayoutEffect(() => {
    // Content above the list changing height between renders resizes the body.
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return { ref, box };
}

interface VirtualBrowseProps {
  groups: readonly BrowseGroup[];
  summaries?: Map<string, CardSummary>;
  favouriteOf: (referenceId: string) => ReferenceCardFavourite;
  noteOf: (reference: Reference) => string | undefined;
}

/**
 * Browse's headings and cards as one virtual list: only the rows near the screen are in the page.
 * A card deals in the first time it reaches the screen; scrolled back to later, it's simply there.
 */
export function VirtualBrowse({ groups, summaries, favouriteOf, noteOf }: VirtualBrowseProps) {
  const { deal } = useMotionPresets();
  const { ref, box } = useListBox();
  const columns = columnsFor(box.width, CARD_MIN_REM * box.rem, GAP_REM * box.rem);
  const rows = useMemo(() => browseRows(groups, columns), [groups, columns]);
  const seen = useRef(new Set<string>());
  // The row holding keyboard focus stays in the page even when scrolled away, so focus isn't lost.
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      if (focusedRow === null || focusedRow >= rows.length || indexes.includes(focusedRow)) {
        return indexes;
      }
      return [...indexes, focusedRow].sort((a, b) => a - b);
    },
    [focusedRow, rows.length],
  );

  const estimateSize = (index: number) =>
    rows[index].kind === 'heading' ? HEADING_ESTIMATE_PX : CARDS_ESTIMATE_PX;
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize,
    // A row with no height (only without layout, as in tests) keeps its estimate: rows all at the
    // same spot would leave the list unable to tell which ones are on screen.
    measureElement: (element, entry, instance) =>
      measureElement(element, entry, instance) ||
      estimateSize(Number(element.getAttribute('data-index'))),
    getItemKey: (index) => rows[index].key,
    overscan: OVERSCAN_ROWS,
    scrollMargin: box.top,
    rangeExtractor,
  });

  return (
    <div
      ref={ref}
      className={styles.list}
      style={{ blockSize: virtualizer.getTotalSize() }}
      onFocus={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
        setFocusedRow(row ? Number(row.dataset.index) : null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusedRow(null);
      }}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index];
        return (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className={styles.row}
            style={{ transform: `translateY(${item.start - box.top}px)` }}
          >
            {row.kind === 'heading' ? (
              <h3 className={styles.heading}>{row.title}</h3>
            ) : (
              <ul className={styles.cards} style={{ '--columns': columns } as CSSProperties}>
                {row.references.map((reference, column) => (
                  <m.li
                    key={reference.id}
                    className={styles.cell}
                    variants={deal}
                    custom={column}
                    initial={seen.current.has(reference.id) ? false : 'hidden'}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    onViewportEnter={() => seen.current.add(reference.id)}
                  >
                    <ReferenceCard
                      reference={reference}
                      teaser={summaries?.get(reference.id)?.teaser}
                      matchNote={noteOf(reference)}
                      favourite={favouriteOf(reference.id)}
                    />
                  </m.li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
