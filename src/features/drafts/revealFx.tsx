import { m } from 'motion/react';
import styles from './drafts.module.css';

/*
 * The reveal's button marks and the one-shot moments behind Drop, Edit and Keep. All original art.
 * Every moment is decoration: aria-hidden, pointer-events none, and never rendered under reduced
 * motion (DraftReveal decides).
 */

/** Drop: a skull over crossed bones. Eye holes are cut out (even-odd) so it works in any colour. */
export function SkullIcon() {
  return (
    <svg className={styles.btnIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M2.5 11.5 13.5 15.5M13.5 11.5 2.5 15.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 1a5 5 0 0 0-5 5c0 1.6.8 2.9 2 3.7V12h6V9.7c1.2-.8 2-2.1 2-3.7a5 5 0 0 0-5-5ZM6 5a1.3 1.3 0 1 1 0 2.6A1.3 1.3 0 0 1 6 5Zm4 0a1.3 1.3 0 1 1 0 2.6A1.3 1.3 0 0 1 10 5Z"
      />
    </svg>
  );
}

/** Edit: a quill, nib down. */
export function QuillIcon() {
  return (
    <svg className={styles.btnIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M14.5 1.5C9 2 5.5 5.5 4.5 11c3-.3 5.6-2 7-4.6L9.6 6.2l3.3-1.1c.9-1 1.4-2.2 1.6-3.6Z"
      />
      <path d="M4.5 11 2 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Keep: a five-point star. */
export function StarIcon() {
  return (
    <svg className={styles.btnIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="m8 1 2.1 4.4 4.8.6-3.5 3.3.9 4.7L8 11.7 3.7 14l.9-4.7L1.1 6l4.8-.6Z"
      />
    </svg>
  );
}

/** Drop: a plank slides out under the card and the water splashes where it falls (CSS-timed). */
export function PlankFx() {
  return (
    <div className={styles.fxLayer} aria-hidden="true" data-fx="drop">
      <span className={styles.plank} />
      <svg className={styles.splash} viewBox="0 0 64 40">
        <path d="M6 34c8-6 18-6 26 0s18 6 26 0" fill="none" strokeWidth="3" strokeLinecap="round" />
        <circle cx="20" cy="16" r="3" />
        <circle cx="32" cy="6" r="3.5" />
        <circle cx="44" cy="16" r="3" />
      </svg>
    </div>
  );
}

/**
 * Keep: a round capsule pops open and the card jumps out, spins once and leaps toward the library.
 * CSS-timed; `onEnd` clears it when the layer's own fade finishes.
 */
export function CapsuleFx({ onEnd }: { onEnd: () => void }) {
  return (
    <div
      className={`${styles.fxLayer} ${styles.capsuleFx}`}
      aria-hidden="true"
      data-fx="keep"
      // Children's animations bubble here too: only the layer's own fade ends it.
      onAnimationEnd={(event) => event.target === event.currentTarget && onEnd()}
    >
      <svg className={styles.capsule} viewBox="0 0 96 96">
        <rect className={styles.capsuleCard} x="36" y="40" width="24" height="32" rx="4" />
        <path className={styles.capsuleBase} d="M14 56a34 34 0 0 0 68 0Z" />
        <path className={styles.capsuleLid} d="M14 52a34 34 0 0 1 68 0Z" />
        <circle className={styles.capsuleBand} cx="48" cy="54" r="6" />
      </svg>
    </div>
  );
}

/** The dark book's run, in seconds: open, write, apple, a beat, snap shut, fade. */
const BOOK_S = 1.15;
const BOOK_EASE = 'easeInOut';
// Illustration colours: a black hardcover, old paper, dark ink and a red apple.
const COVER = '#0c0a0f';
const COVER_EDGE = '#3a3340';
const PAGE = '#efe6d2';
const INK = '#2a0f16';
const APPLE = '#d42a2f';

/**
 * Edit: a black hardcover book (blank cover, no lettering) opens, a quill scrawls a spooky made-up
 * cursive, a small red apple rolls in, a pause, then the book snaps shut. `onDone` fires on
 * Motion's own completion, so skipped animations finish at once and an unmount never calls it.
 */
export function DarkBookFx({ onDone }: { onDone: () => void }) {
  return (
    <m.div
      className={`${styles.fxLayer} ${styles.bookFx}`}
      aria-hidden="true"
      data-fx="edit"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: BOOK_S, times: [0, 0.06, 0.92, 1] }}
      onAnimationComplete={onDone}
    >
      <svg className={styles.book} viewBox="0 0 160 110">
        {/* Back cover and the right-hand page, written on while open. */}
        <rect x="80" y="6" width="60" height="98" rx="3" fill={COVER} stroke={COVER_EDGE} />
        <rect x="82" y="10" width="54" height="90" rx="1" fill={PAGE} />
        <m.path
          d="M87 34c3-7 6 5 9-1s3-8 6-2-2 7 3 3 4-8 7-3-1 6 4 3 3-7 6-1M88 52c4-6 6 4 10 0s4-7 7-1 3 5 6 0 5-6 8 0 3 4 6-1"
          fill="none"
          stroke={INK}
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.22, duration: 0.42, ease: 'easeIn' }}
        />
        {/* The front cover swings on the spine (x = 80): over the right page, then mirrored. */}
        <m.rect
          x="80"
          y="6"
          width="60"
          height="98"
          rx="3"
          fill={COVER}
          stroke={COVER_EDGE}
          style={{ originX: 0 }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: [1, -1, -1, 1] }}
          transition={{ duration: BOOK_S, times: [0, 0.17, 0.83, 0.9], ease: BOOK_EASE }}
        />
        <m.rect
          x="24"
          y="10"
          width="54"
          height="90"
          rx="1"
          fill={PAGE}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
          transition={{ duration: BOOK_S, times: [0, 0.1, 0.17, 0.83, 0.86, 1] }}
        />
        {/* The quill rides the two scrawled lines, nib first. */}
        <m.g
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.18, duration: 0.52, times: [0, 0.1, 0.85, 1] }}
        >
          <m.g
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, 46, 0, 50], y: [0, 0, 18, 18] }}
            transition={{ delay: 0.22, duration: 0.42, times: [0, 0.48, 0.52, 1] }}
          >
            <path d="M87 34 108 6c-2 9-8 18-17 25Z" fill={COVER_EDGE} stroke={INK} />
          </m.g>
        </m.g>
        {/* A small red apple rolls in to rest at the page's foot. */}
        <m.g
          initial={{ x: 60, rotate: 0, opacity: 0 }}
          animate={{ x: 0, rotate: -360, opacity: 1 }}
          transition={{ delay: 0.64, duration: 0.22, ease: 'easeOut' }}
        >
          <circle cx="124" cy="92" r="7" fill={APPLE} />
          <path d="M124 85v-4" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M124 83c2-3 5-3 6-2-2 2-4 2-6 2Z" fill="var(--color-success)" />
        </m.g>
      </svg>
    </m.div>
  );
}
