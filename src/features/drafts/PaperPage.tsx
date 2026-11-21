import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './PaperPage.module.css';
import type { PaperPageState } from './usePaperPage';

/**
 * One paper page that unfolds from behind the card maker's lanyard pass (owner, 2026-11-22). On
 * wide screens it opens out beside the pass, hinged at its edge; on narrower ones it flips down
 * from under the pass's title like a flap. Switching between its sections turns the sheet over
 * (the owner's option A). Folding it back (its button, or Escape) puts focus back on the button
 * that opened it. It is part of the same dialog: no second modal. Its state and moves live in
 * usePaperPage.ts.
 */

/** The pass and its page side by side: the pass slides over to make room as the page opens. */
export function PaperRig({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={styles.rig} data-page={open ? '' : undefined}>
      {children}
    </div>
  );
}

interface PaperPageProps<S extends string> {
  page: PaperPageState<S>;
  title: string;
  /** Buttons that turn the page to its other sections. */
  tabs?: ReactNode;
  children: ReactNode;
}

export function PaperPage<S extends string>({ page, title, tabs, children }: PaperPageProps<S>) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A flap starts just under the pass's title, wherever that title's wrapping leaves it, and
  // stops above the reel (CurationTray's dock) and its Review button, which must stay in reach.
  useLayoutEffect(() => {
    const el = page.pageRef.current;
    const rig = el?.parentElement;
    const passTitle = rig?.querySelector('h2');
    if (!el || !rig || !passTitle) return;
    const box = rig.getBoundingClientRect();
    const top = passTitle.getBoundingClientRect().bottom - box.top;
    rig.style.setProperty('--flap-top', `${Math.max(0, top) + 12}px`);
    const stop = rig.querySelector('[data-tray-dock]');
    if (stop) {
      const bottom = box.bottom - stop.getBoundingClientRect().top;
      rig.style.setProperty('--flap-bottom', `${Math.max(0, bottom) + 8}px`);
    } else rig.style.removeProperty('--flap-bottom');
  }, [page.side, page.pageRef]);

  // Focus goes into the page when it opens or turns over.
  useEffect(() => {
    if (page.side) headingRef.current?.focus();
  }, [page.side]);

  if (!page.side) return null;
  return (
    <section
      ref={page.pageRef}
      className={styles.page}
      aria-labelledby={titleId}
      data-side={page.side}
    >
      <span className={styles.crease} aria-hidden="true" />
      <div className={styles.head}>
        <h3 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h3>
        <button type="button" className={styles.fold} onClick={page.fold}>
          Fold back
        </button>
      </div>
      {tabs && (
        <div className={styles.tabs} role="group" aria-label="Sections">
          {tabs}
        </div>
      )}
      {children}
    </section>
  );
}
