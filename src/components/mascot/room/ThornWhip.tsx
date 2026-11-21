import { INK, STEEL } from './palette';
import styles from './backProps.module.css';

const VINE = '#3fae6e';
const THORN = '#7be0a8';

/** A thorny green rose whip, coiled and hanging from a hook at the origin. */
export function ThornWhip() {
  return (
    <g aria-hidden="true">
      <path d="M0 0 v-3 q0 -3 3 -3" stroke={STEEL} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g className={styles.sway}>
        <g fill="none" stroke={VINE} strokeWidth="2.2" strokeLinecap="round">
          <ellipse cx="0" cy="6" rx="7" ry="3" />
          <ellipse cx="0" cy="10.5" rx="7.5" ry="3" />
          <ellipse cx="0" cy="15" rx="7" ry="3" />
          <path d="M5 17 C12 24 -4 30 4 38 S10 48 6 56" />
        </g>
        <path
          d="M-7 6 l-3 -1 M7 10.5 l3 -1.5 M-7 15 l-3 1 M9 22 l3 -1 M0 28 l-3 0 M5 36 l3 0 M7 47 l3 1"
          stroke={THORN}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="6" cy="58" r="3" fill="#e8604c" stroke={INK} strokeWidth="0.6" />
        <path d="M6 55 q-3 1 -4 -2 M6 55 q3 1 4 -2" stroke={VINE} strokeWidth="1.2" fill="none" />
      </g>
    </g>
  );
}
