import type { ReactNode } from 'react';
import type { Costume } from './Mascot';

/** Five-point star centred on (x, y). */
function star(x: number, y: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 ? r * 0.45 : r;
    return `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

/** Generic places for each kind of character: never a real show's location. */
const PLACES: Partial<Record<Costume, ReactNode>> = {
  hero: (
    <>
      <circle cx="320" cy="110" r="38" />
      <polygon points="40,700 150,140 190,140 120,700" opacity="0.5" />
      <path d="M0 700 V560 h60 V500 h50 V580 h40 V470 h70 V560 h50 V520 h60 V600 h70 V700 Z" />
      <path d="M215 470 v-30 h40 v30 Z M220 440 l15 -14 l15 14 Z" />
    </>
  ),
  wizard: (
    <>
      {[
        [60, 90, 14],
        [150, 50, 9],
        [300, 80, 16],
        [350, 170, 8],
        [90, 200, 9],
      ].map(([x, y, r]) => (
        <polygon key={`${x}-${y}`} points={star(x, y, r)} />
      ))}
      <path d="M0 700 V560 h70 V520 h40 V600 h180 V520 h40 V560 h70 V700 Z" />
      <path d="M30 560 L70 470 L110 520 Z M290 520 L330 440 L370 560 Z" />
      <path d="M160 600 V500 h80 V600 Z M150 500 L200 400 L250 500 Z" />
    </>
  ),
  villain: (
    <>
      <polygon points="300,40 250,150 290,150 240,260 340,120 300,120 340,40" />
      <path d="M0 700 L0 600 L70 520 L120 580 L180 470 L240 560 L300 500 L400 610 L400 700 Z" />
      <path d="M165 520 V430 h30 V520 Z M155 430 h50 l-10 -20 h-30 Z" />
    </>
  ),
  royal: (
    <>
      <path d="M0 0 H110 Q90 200 120 360 Q60 300 0 330 Z" />
      <path d="M400 0 H290 Q310 200 280 360 Q340 300 400 330 Z" />
      <path d="M0 0 H400 V40 Q300 70 200 40 Q100 70 0 40 Z" />
      <path d="M40 700 V470 h30 V700 Z M330 700 V470 h30 V700 Z" />
      <path d="M150 700 L170 560 H230 L250 700 Z" opacity="0.6" />
    </>
  ),
  outlaw: (
    <>
      <circle cx="200" cy="170" r="90" opacity="0.6" />
      <path d="M0 700 V600 Q100 560 200 600 T400 590 V700 Z" />
      <path d="M300 600 V470 a14 14 0 0 1 28 0 V600 Z M300 540 h-22 v-40 a10 10 0 0 1 20 0 v18 Z M328 520 h20 v-34 a10 10 0 0 1 20 0 v50 h-40 Z" />
      <path d="M40 610 l20 -50 l20 50 Z" />
    </>
  ),
  meme: (
    <>
      <path d="M30 80 h150 a20 20 0 0 1 20 20 v40 a20 20 0 0 1 -20 20 h-120 l-30 24 v-24 a20 20 0 0 1 -20 -20 v-40 a20 20 0 0 1 20 -20 Z" />
      <path
        d="M370 180 h-140 a20 20 0 0 0 -20 20 v40 a20 20 0 0 0 20 20 h110 l30 24 v-24 a20 20 0 0 0 20 -20 v-40 a20 20 0 0 0 -20 -20 Z"
        opacity="0.7"
      />
      <path
        d="M40 520 h120 a20 20 0 0 1 20 20 v30 a20 20 0 0 1 -20 20 h-90 l-30 24 v-24 a20 20 0 0 1 -20 -20 v-30 a20 20 0 0 1 20 -20 Z"
        opacity="0.7"
      />
      <path d="M300 560 c-30 -30 -60 0 -30 30 l30 30 l30 -30 c30 -30 0 -60 -30 -30 Z" />
    </>
  ),
};

/**
 * The place behind a costume in the opening flip-book, drawn in the panel's text colour so each
 * panel's palette tints it. Still, decorative, behind everything else in the panel. The plain
 * mascot has no place of its own.
 */
export function GenrePlace({ costume, className }: { costume: Costume; className?: string }) {
  if (!PLACES[costume]) return null;
  return (
    <svg
      className={className}
      viewBox="0 0 400 700"
      preserveAspectRatio="xMidYMax slice"
      fill="currentColor"
      aria-hidden="true"
    >
      {PLACES[costume]}
    </svg>
  );
}
