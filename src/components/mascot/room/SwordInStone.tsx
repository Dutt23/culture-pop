import { INK, LAMP, LIGHT, MIST, STEEL } from './palette';

/** A sword stuck in a stone (the Excalibur myth), drawn with the stone's base centre at the origin. */
export function SwordInStone() {
  return (
    <g aria-hidden="true">
      <ellipse cx="0" cy="1" rx="20" ry="2.5" fill={INK} opacity="0.5" />
      <path d="M-18 0 L-15 -10 L-7 -16 L6 -15 L14 -8 L18 0 Z" fill="#5b5a78" />
      <path d="M-7 -16 L6 -15 L2 -9 L-9 -8 Z" fill="#7a78a0" />
      <path d="M-15 -10 L-9 -8 L-11 0 L-18 0 Z" fill="#46446a" />
      <path d="M-3.5 -14 L-3.5 -40 L0 -46 L3.5 -40 L3.5 -14 Z" fill={MIST} />
      <path d="M0 -44 V-15" stroke={LIGHT} strokeWidth="0.8" />
      <rect x="-10" y="-42" width="20" height="3.4" rx="1.4" fill={LAMP} />
      <rect x="-1.8" y="-58" width="3.6" height="16" rx="1.2" fill="#8a5a3c" />
      <circle cx="0" cy="-60" r="3.2" fill={STEEL} stroke={LAMP} strokeWidth="1" />
    </g>
  );
}
