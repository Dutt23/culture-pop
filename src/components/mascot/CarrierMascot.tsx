import { Body } from './Mascot';
import styles from './CarrierMascot.module.css';

/**
 * The mascot as a mover (owner, 2026-11-21): muscled arms, sweat flying while it carries something
 * in, a rest when it gets there, and a shove to push it back out. `phase` picks the pose; the
 * walking, sweating and breathing are CSS and hold still under reduced motion. Decorative.
 */

export type CarrierPhase = 'carrying' | 'resting' | 'pushing';

const INK = '#0d0b1f';
const LIGHT = '#f3efff';
const SKIN = '#6a3df0';
const MUSCLE = '#5530cf';

export function CarrierMascot({ phase }: { phase: CarrierPhase }) {
  return (
    <svg className={styles.mascot} data-phase={phase} viewBox="-24 -26 172 160" aria-hidden="true">
      {/* Sweat: three drops flying off its head while it works. */}
      <g className={styles.sweat}>
        <path d="M6 18 q-5 8 0 11 q5 -3 0 -11 Z" fill="#9fd8ff" />
        <path d="M-2 34 q-4 7 0 9 q4 -2 0 -9 Z" fill="#9fd8ff" />
        <path d="M112 14 q-5 8 0 11 q5 -3 0 -11 Z" fill="#9fd8ff" />
      </g>

      <g>
        <rect className={styles.legBack} x="36" y="100" width="12" height="22" rx="5" fill={SKIN} />
        <rect
          className={styles.legFront}
          x="72"
          y="100"
          width="12"
          height="22"
          rx="5"
          fill={SKIN}
        />
      </g>

      <g className={styles.body}>
        <path
          d="M50 30 L40 14 M70 30 L82 12"
          stroke={LIGHT}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="40" cy="14" r="4.5" fill="#ffb27a" />
        <circle cx="82" cy="12" r="4.5" fill="#ffb27a" />
        <Body />
        {/* Working: eyes squeezed with effort, gritted teeth. Resting: eyes shut, a smile. */}
        <g className={styles.working}>
          <path d="M38 56 l12 6 l-12 4" stroke={INK} strokeWidth="4" fill="none" />
          <path d="M82 56 l-12 6 l12 4" stroke={INK} strokeWidth="4" fill="none" />
          <rect
            x="44"
            y="74"
            width="32"
            height="10"
            rx="3"
            fill={LIGHT}
            stroke={INK}
            strokeWidth="3"
          />
          <path d="M52 74 v10 M60 74 v10 M68 74 v10" stroke={INK} strokeWidth="2" />
        </g>
        <g className={styles.rested}>
          <path d="M38 60 q8 6 16 0 M66 60 q8 6 16 0" stroke={INK} strokeWidth="4" fill="none" />
          <path
            d="M46 76 q14 10 28 0"
            stroke={INK}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* Arms with bulging biceps: up and forward to hold the load, down to rest. */}
      <g className={styles.armBack}>
        <path
          d="M22 62 Q4 44 22 22"
          stroke={SKIN}
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="11" cy="46" rx="9" ry="7" fill={MUSCLE} />
      </g>
      <g className={styles.armFront}>
        <path
          d="M98 62 Q128 50 128 24"
          stroke={SKIN}
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="119" cy="48" rx="10" ry="8" fill={MUSCLE} />
        <circle cx="128" cy="22" r="7" fill={SKIN} />
      </g>
    </svg>
  );
}
