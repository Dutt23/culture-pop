import { useEffect, useState } from 'react';
import { SkeletonCards } from '../ui/SkeletonCards';
import { Antennae, Body } from './Mascot';
import styles from './PageLoader.module.css';

/** Nothing shows before this, so a page that opens quickly never flashes a loader. */
export const LOADER_DELAY_MS = 300;

/**
 * Shown while a page's code downloads the first time it is opened (owner pick, 2026-11-18): the
 * mascot juggles popcorn over the grey cards the page will fill. Holds still with reduced motion.
 */
export function PageLoader() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), LOADER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;

  return (
    <div className={styles.loader}>
      <svg className={styles.mascot} viewBox="-10 -40 140 160" aria-hidden="true">
        <circle className={`${styles.kernel} ${styles.across}`} cx="40" cy="-4" r="6" />
        <circle
          className={`${styles.kernel} ${styles.back} ${styles.toasted}`}
          cx="40"
          cy="-4"
          r="6"
        />
        <circle className={`${styles.kernel} ${styles.hop}`} cx="60" cy="-30" r="6" />
        <Antennae />
        <Body />
        {/* Eyes up on the popcorn, mouth open. */}
        <circle cx="46" cy="58" r="11" fill="#f3efff" />
        <circle cx="74" cy="58" r="11" fill="#f3efff" />
        <circle cx="47" cy="53" r="5" fill="#0d0b1f" />
        <circle cx="73" cy="53" r="5" fill="#0d0b1f" />
        <ellipse cx="60" cy="80" rx="7" ry="5" fill="#0d0b1f" />
      </svg>
      <p className={styles.text}>Juggling popcorn…</p>
      <SkeletonCards count={3} />
    </div>
  );
}
