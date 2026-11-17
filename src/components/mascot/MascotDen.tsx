import { m, useScroll, useTransform } from 'motion/react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { classNames } from '../ui/classNames';
import { Mascot } from './Mascot';
import styles from './MascotDen.module.css';

const NIGHT = '#0a0820';
const FRAME = '#3a3270';
const WOOD = '#4a3a8a';
const SHADE = '#3a2d70';
const LIGHT = '#f3efff';
const LILAC = '#b29bff';
const MIST = '#c9c2ee';
const PEACH = '#ffb27a';
const CREAM = '#ffd9a8';
const LAMP = '#ffd27a';
const CORAL = '#e8604c';
const INK = '#0d0b1f';

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

/** City windows that twinkle, each on its own beat. */
const WINDOWS: readonly [number, number, number][] = [
  [19, 58, 0],
  [28, 50, 0.6],
  [37, 62, 1.2],
  [46, 44, 0.3],
  [50, 52, 1.8],
  [61, 64, 0.9],
  [68, 54, 1.5],
  [81, 68, 0.2],
];

/** The TV's screen fades through these in turn. */
const SCREENS = ['#6fd3ff', PEACH, LILAC, '#7be0a8'];

function Note({ x, y, wait }: { x: number; y: number; wait: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={styles.note} style={delay(wait)} fill={CREAM} stroke={CREAM} strokeWidth="1.5">
        <circle r="2.5" stroke="none" />
        <path d="M2.5 0 V-9 l4 2" fill="none" />
      </g>
    </g>
  );
}

function Tape({ x, y }: { x: number; y: number }) {
  return <rect x={x} y={y} width="8" height="5" fill={MIST} opacity="0.7" />;
}

function Window() {
  return (
    <>
      <rect x="14" y="14" width="76" height="62" rx="4" fill={NIGHT} />
      <circle cx="74" cy="28" r="7" fill={LIGHT} />
      <circle cx="77.5" cy="25.5" r="6" fill={NIGHT} />
      <path d="M16 74 V54 h10 V46 h8 V58 h8 V40 h12 V60 h8 V50 h10 V64 h14 V74 Z" fill="#241d52" />
      {WINDOWS.map(([x, y, wait]) => (
        <rect
          key={`${x}-${y}`}
          className={styles.twinkle}
          style={delay(wait)}
          x={x}
          y={y}
          width="3"
          height="3"
          fill={LAMP}
        />
      ))}
      <path d="M52 14 V76 M14 45 H90" stroke={FRAME} strokeWidth="2" />
      <rect
        x="14"
        y="14"
        width="76"
        height="62"
        rx="4"
        fill="none"
        stroke={FRAME}
        strokeWidth="3"
      />
    </>
  );
}

function Radio() {
  return (
    <>
      <rect x="12" y="104" width="82" height="5" rx="2" fill={WOOD} />
      <path d="M30 84 q19 -10 38 0" stroke="#c94a38" strokeWidth="3" fill="none" />
      <rect x="22" y="84" width="54" height="20" rx="5" fill={CORAL} />
      <circle cx="35" cy="94" r="6.5" fill="#7a2a1e" />
      <circle cx="35" cy="94" r="3" fill="#a8402e" />
      <rect x="47" y="88" width="24" height="7" rx="2" fill={CREAM} />
      <rect className={styles.dial} x="49" y="88" width="1.5" height="7" fill="#7a2a1e" />
      <circle cx="52" cy="99.5" r="2" fill="#7a2a1e" />
      <circle cx="66" cy="99.5" r="2" fill="#7a2a1e" />
      <Note x={60} y={80} wait={0} />
      <Note x={42} y={78} wait={1.3} />
    </>
  );
}

/** Generic posters: a star, a rocket, comedy and tragedy masks, a film clapper. */
function Posters() {
  return (
    <>
      <rect x="104" y="18" width="32" height="44" rx="2" fill={PEACH} />
      <polygon
        points="120,27 123,35 131,35 125,40 127,48 120,43 113,48 115,40 109,35 117,35"
        fill="#6a3df0"
      />
      <Tape x={116} y={15} />
      <rect x="146" y="26" width="28" height="38" rx="2" fill="#7be0a8" />
      <path d="M160 31 q7 9 0 23 q-7 -14 0 -23Z M155 50 l-4 6 h5 Z M165 50 l4 6 h-5 Z" fill={INK} />
      <circle cx="160" cy="40" r="2.5" fill="#7be0a8" />
      <Tape x={156} y={23} />
      <rect x="184" y="16" width="32" height="44" rx="2" fill={LILAC} />
      <circle cx="194" cy="34" r="7" fill={LIGHT} />
      <circle cx="206" cy="42" r="7" fill={LIGHT} />
      <path d="M190 36 q4 4 8 0 M202 46 q4 -4 8 0" stroke={INK} strokeWidth="1.5" fill="none" />
      <Tape x={196} y={13} />
      <rect x="232" y="30" width="48" height="34" rx="2" fill={LIGHT} />
      <rect x="236" y="40" width="40" height="20" rx="1" fill={INK} />
      <path
        d="M236 34 l6 -4 h6 l-6 4Z M248 34 l6 -4 h6 l-6 4Z M260 34 l6 -4 h6 l-6 4Z"
        fill={INK}
      />
      <path d="M242 54 h10 M256 54 h14 M242 48 h22" stroke={LIGHT} strokeWidth="2" />
      <Tape x={252} y={27} />
    </>
  );
}

function Television({ clipId }: { clipId: string }) {
  return (
    <>
      <path className={styles.glow} d="M234 122 L150 150 L150 228 L234 156Z" fill={LILAC} />
      <rect x="224" y="164" width="66" height="26" rx="3" fill={WOOD} />
      <rect x="230" y="190" width="5" height="10" fill={SHADE} />
      <rect x="279" y="190" width="5" height="10" fill={SHADE} />
      <rect x="232" y="172" width="22" height="10" rx="2" fill={SHADE} />
      <rect x="260" y="172" width="22" height="10" rx="2" fill={SHADE} />
      <path d="M257 112 L242 92 M257 112 L274 94" stroke={MIST} strokeWidth="2" />
      <circle cx="242" cy="92" r="2.5" fill={PEACH} />
      <circle cx="274" cy="94" r="2.5" fill={PEACH} />
      <rect x="228" y="112" width="58" height="52" rx="8" fill="#3b2f73" />
      <g clipPath={`url(#${clipId})`}>
        <rect x="234" y="118" width="40" height="38" fill={SCREENS[0]} />
        {SCREENS.map((colour, i) => (
          <rect
            key={colour}
            className={styles.screen}
            style={delay(i * 2)}
            x="234"
            y="118"
            width="40"
            height="38"
            fill={colour}
          />
        ))}
        <rect
          className={styles.scan}
          x="234"
          y="116"
          width="40"
          height="3"
          fill="#fff"
          opacity="0.3"
        />
      </g>
      <circle cx="280" cy="128" r="3" fill={MIST} />
      <circle cx="280" cy="140" r="3" fill={MIST} />
    </>
  );
}

function Sofa() {
  return (
    <>
      <rect x="86" y="140" width="124" height="40" rx="12" fill="#5a2fd0" />
      <g className={styles.bob}>
        <g transform="translate(122 112)">
          <Mascot costume="plain" size={54} />
        </g>
      </g>
      <rect x="80" y="168" width="136" height="24" rx="8" fill="#4a26b0" />
      <rect x="76" y="152" width="18" height="40" rx="8" fill="#6a3df0" />
      <rect x="202" y="152" width="18" height="40" rx="8" fill="#6a3df0" />
      <rect x="88" y="192" width="5" height="8" fill={SHADE} />
      <rect x="203" y="192" width="5" height="8" fill={SHADE} />
    </>
  );
}

function Chai() {
  return (
    <>
      <rect x="128" y="206" width="44" height="6" rx="2" fill="#6b4fd0" />
      <rect x="132" y="212" width="4" height="12" fill={WOOD} />
      <rect x="164" y="212" width="4" height="12" fill={WOOD} />
      <rect x="144" y="196" width="12" height="10" rx="2" fill={LIGHT} />
      <path d="M156 199 q4 0 4 3 q0 3 -4 3" stroke={LIGHT} strokeWidth="1.5" fill="none" />
      {[147, 153].map((x, i) => (
        <path
          key={x}
          className={styles.steam}
          style={delay(i * 1.2)}
          d={`M${x} 192 q-3 -4 0 -8 q3 -4 0 -8`}
          stroke={MIST}
          strokeWidth="1.5"
          fill="none"
        />
      ))}
    </>
  );
}

function Plant() {
  return (
    <>
      <g className={styles.sway}>
        <path d="M27 214 C20 200 12 196 9 185 C20 190 26 200 27 214Z" fill="#3fbf7f" />
        <path d="M27 214 C30 196 38 190 45 181 C43 196 34 204 27 214Z" fill="#2fa36a" />
        <path d="M27 214 C25 198 26 186 28 173 C33 188 31 202 27 214Z" fill="#52d08f" />
      </g>
      <path d="M14 214 h26 l-3 22 h-20Z" fill="#b4501f" />
    </>
  );
}

const BULB_COLOURS = [LAMP, PEACH, LILAC, '#7be0a8', '#6fd3ff'];
const BULBS = 28;
const DROOPS = 4;
/** Height (px) of the fairy-light wire at x, from 0 to 1 across the wall. */
const droop = (x: number) => 8 + 26 * Math.sin(Math.PI * ((x * DROOPS) % 1));
const WIRE = Array.from({ length: 201 }, (_, i) => `${i * 5},${droop(i / 200)}`).join(' ');

/** A string of lights across the top of the wall, each bulb on its own beat. */
function FairyLights() {
  return (
    <div className={styles.lights}>
      <svg className={styles.wire} viewBox="0 0 1000 40" preserveAspectRatio="none">
        <polyline
          points={WIRE}
          stroke={FRAME}
          strokeWidth="2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {Array.from({ length: BULBS }, (_, i) => {
        const x = (i + 0.5) / BULBS;
        return (
          <span
            key={i}
            className={styles.bulb}
            style={{
              insetInlineStart: `${x * 100}%`,
              insetBlockStart: `${droop(x)}px`,
              color: BULB_COLOURS[i % BULB_COLOURS.length],
              ...delay((i * 0.37) % 3.2),
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Discover's first screen: the mascot's night-time living room, wall to wall, with the page's
 * heading and search bar (`children`) on its wall. Small things move, and as the page scrolls the
 * furniture drifts back and the heading fades. `still` (reduced motion) stops every movement.
 */
export function MascotDen({ still, children }: { still: boolean; children: ReactNode }) {
  const clipId = useId();
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 800], [0, 200]);
  const lift = useTransform(scrollY, [0, 800], [0, 320]);
  const fade = useTransform(scrollY, [0, 560], [1, 0]);
  return (
    <div className={classNames(styles.den, still && styles.still)} data-scene="night">
      <div className={styles.backdrop} aria-hidden="true">
        <FairyLights />
        <div className={styles.floor} />
      </div>
      <m.div className={styles.content} style={still ? undefined : { y: lift, opacity: fade }}>
        {children}
      </m.div>
      <div className={styles.stage} aria-hidden="true" data-testid="mascot-den">
        <m.div className={styles.furniture} style={still ? undefined : { y: drift }}>
          <div className={styles.tvGlow} />
          <svg className={styles.room} viewBox="0 0 300 250">
            <defs>
              <clipPath id={clipId}>
                <rect x="234" y="118" width="40" height="38" rx="5" />
              </clipPath>
            </defs>
            <ellipse cx="150" cy="228" rx="96" ry="14" fill="#2a2058" />
            <Window />
            <Radio />
            <Posters />
            <Television clipId={clipId} />
            <Sofa />
            <Chai />
            <Plant />
          </svg>
        </m.div>
      </div>
    </div>
  );
}
