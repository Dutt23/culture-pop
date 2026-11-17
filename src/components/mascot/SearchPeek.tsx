import type { ReactNode } from 'react';
import { Antennae, Body, Smile } from './Mascot';
import styles from './SearchPeek.module.css';
import { usePeek, type PeekOutcome, type PeekPhase } from './usePeek';

interface SearchPeekProps {
  query: string;
  outcome: PeekOutcome;
  enabled: boolean;
  children: ReactNode;
}

const LIGHT = '#f3efff';
const INK = '#0d0b1f';

/** Eyes on the typing while it watches (further left as the text grows), down at the result. */
function gaze(phase: PeekPhase, query: string): string {
  if (phase === 'pointing') return 'translate(-4px, 5px)';
  if (phase === 'watching') return `translate(${-Math.min(query.trim().length, 12) / 4}px, 3px)`;
  return 'none';
}

/**
 * Wraps the search bar: the mascot rises from behind its right end, hands on the edge, points
 * over it at the first result, then ducks. Decorative, untappable, never covers the typing.
 */
export function SearchPeek({ query, outcome, enabled, children }: SearchPeekProps) {
  const phase = usePeek(query, outcome, enabled);
  return (
    <div className={enabled ? styles.peek : `${styles.peek} ${styles.still}`} data-peek={phase}>
      {children}
      <div className={styles.window} aria-hidden="true">
        <svg className={styles.mascot} viewBox="-10 -14 140 134">
          <Antennae />
          <Body />
          <circle cx="46" cy="60" r="11" fill={LIGHT} />
          <circle cx="74" cy="60" r="11" fill={LIGHT} />
          <g className={styles.pupils} style={{ transform: gaze(phase, query) }}>
            <circle cx="46" cy="60" r="5" fill={INK} />
            <circle cx="74" cy="60" r="5" fill={INK} />
          </g>
          <Smile />
        </svg>
      </div>
      <span className={`${styles.hand} ${styles.farHand}`} aria-hidden="true" />
      <span className={`${styles.hand} ${styles.nearHand}`} aria-hidden="true" />
      <span className={styles.arm} aria-hidden="true" />
    </div>
  );
}
