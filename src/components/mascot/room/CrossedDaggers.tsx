import { INK, STEEL } from './palette';
import styles from './backProps.module.css';

const BLADE = '#c4162f';
const EDGE = '#ff5a6e';
const JAGGED = 'M-3.5 -11.5 L-4.6 -20 L-2.8 -22 L-4.2 -31 L-1.8 -33 L0 -47 L1.8 -33 L4.2 -31 L2.8 -22 L4.6 -20 L3.5 -11.5 Z';

/** One jagged dagger, handle end at the origin, point up. */
function Dagger() {
  return (
    <g>
      <path className={styles.pulse} d={JAGGED} fill="none" stroke={BLADE} strokeWidth="5" opacity="0.4" />
      <path d={JAGGED} fill={BLADE} stroke={EDGE} strokeWidth="0.7" strokeLinejoin="round" />
      <rect x="-6" y="-13.5" width="12" height="2.6" rx="1" fill={INK} />
      <rect x="-1.8" y="-11" width="3.6" height="11" rx="1" fill={INK} />
      <path d="M-1.8 -6 h3.6" stroke={BLADE} strokeWidth="1" />
    </g>
  );
}

/** Two crimson daggers crossed on wall pegs, centred on the origin (the pegs sit 24 apart). */
export function CrossedDaggers() {
  return (
    <g aria-hidden="true">
      <g transform="translate(-12 22) rotate(34)">
        <Dagger />
      </g>
      <g transform="translate(12 22) rotate(-34)">
        <Dagger />
      </g>
      {[-12, 12].map((x) => (
        <circle key={x} cx={x} cy="22" r="2.2" fill={STEEL} stroke={INK} strokeWidth="0.8" />
      ))}
    </g>
  );
}
