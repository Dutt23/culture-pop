import { Mascot, type Costume } from '../Mascot';
import { CORAL, INK, LAMP, LIGHT, MIST, PEACH, SKY, WOOD } from './palette';
import styles from './toys.module.css';

const TOY = 96;
const SMALL_TOY = 80;

/** A costumed toy mascot standing at (x, y); `facing="left"` mirrors it. */
function Toy({
  costume,
  x,
  y,
  size = TOY,
  facing = 'right',
  className,
  wait,
}: {
  costume: Costume;
  x: number;
  y: number;
  size?: number;
  facing?: 'left' | 'right';
  className?: string;
  wait?: number;
}) {
  const place =
    facing === 'left' ? `translate(${x + size} ${y}) scale(-1 1)` : `translate(${x} ${y})`;
  return (
    <g className={className} style={wait ? { animationDelay: `${wait}s` } : undefined}>
      <g transform={place}>
        <Mascot costume={costume} size={size} />
      </g>
    </g>
  );
}

function Spark({
  x,
  colour,
  wait,
  left,
}: {
  x: number;
  colour: string;
  wait: number;
  left?: boolean;
}) {
  return (
    <circle
      className={left ? styles.sparkLeft : styles.spark}
      style={{ animationDelay: `${wait}s` }}
      cx={x}
      cy="92"
      r="3.5"
      fill={colour}
    />
  );
}

const STAR = 'M0 -9 l3 7 7 2 -7 2 -3 7 -3 -7 -7 -2 7 -2Z';

/**
 * Small costumed toys on the floor, acting out a genre scene; the scene changes every few
 * seconds. Decoration only.
 */
export function ToyScenes({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 400 170" aria-hidden="true">
      <ellipse cx="200" cy="158" rx="180" ry="10" fill={INK} opacity="0.45" />
      <g className={styles.scene}>
        <Toy costume="hero" x={70} y={60} className={styles.lunge} />
        <Toy costume="villain" x={230} y={60} facing="left" className={styles.recoil} />
        <g transform="translate(212 46)">
          <g className={styles.pow}>
            <polygon
              points="0,-34 9,-12 32,-20 18,-2 36,12 12,12 8,34 -4,14 -26,26 -16,4 -36,-6 -12,-10 -16,-32"
              fill={LAMP}
              stroke={CORAL}
              strokeWidth="3"
            />
            <text x="0" y="6" textAnchor="middle" fontWeight="900" fontSize="16" fill={CORAL}>
              POW!
            </text>
          </g>
        </g>
      </g>
      <g className={styles.scene}>
        <Toy costume="wizard" x={40} y={60} className={styles.cast} />
        <Toy costume="wizard" x={264} y={60} facing="left" className={styles.cast} wait={0.5} />
        <path
          d="M130 112 l24 -18 M270 112 l-24 -18"
          stroke={MIST}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {[0, 0.33, 0.66].map((wait) => (
          <Spark key={wait} x={156} colour={SKY} wait={wait} />
        ))}
        {[0, 0.33, 0.66].map((wait) => (
          <Spark key={wait} x={244} colour={PEACH} wait={wait} left />
        ))}
        <circle className={styles.clash} cx="200" cy="92" r="12" fill={LIGHT} />
      </g>
      <g className={styles.scene}>
        <Toy costume="outlaw" x={40} y={60} className={styles.sway} />
        <Toy costume="outlaw" x={264} y={60} facing="left" className={styles.sway} wait={1} />
        <g className={styles.weed}>
          <circle cx="140" cy="140" r="14" fill="none" stroke="#b4501f" strokeWidth="3" />
          <path
            d="M128 134 q12 12 24 -2 M130 146 q10 -14 22 4 M140 126 q-4 14 2 28"
            stroke="#d07a3a"
            strokeWidth="2.5"
            fill="none"
          />
        </g>
      </g>
      <g className={styles.scene}>
        <rect x="160" y="132" width="80" height="24" rx="4" fill={WOOD} />
        <Toy costume="royal" x={152} y={40} className={styles.hop} />
        <Toy costume="meme" x={40} y={76} size={SMALL_TOY} className={styles.cheer} />
        <Toy costume="hero" x={280} y={76} size={SMALL_TOY} className={styles.cheer} wait={0.2} />
        <g fill={LAMP}>
          {[
            [150, 48, 0],
            [252, 38, 0.5],
            [200, 22, 1],
          ].map(([x, y, wait]) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path className={styles.glint} style={{ animationDelay: `${wait}s` }} d={STAR} />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
