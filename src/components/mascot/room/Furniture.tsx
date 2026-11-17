import { Mascot } from '../Mascot';
import {
  CORAL,
  CREAM,
  delay,
  FRAME,
  INK,
  LAMP,
  LEATHER,
  LIGHT,
  MINT,
  MIST,
  NIGHT,
  PEACH,
  SHADE,
  SKY,
  STEEL,
  WOOD,
} from './palette';
import { RoomProp } from './RoomProp';
import styles from './room.module.css';

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

/** The night outside: a hero signal in the sky and E.T.'s bike crossing the moon. */
function Window() {
  return (
    <>
      <rect x="14" y="14" width="76" height="62" rx="4" fill={NIGHT} />
      <circle cx="74" cy="28" r="7" fill={LIGHT} />
      <circle cx="77.5" cy="25.5" r="6" fill={NIGHT} />
      <RoomProp id="signal">
        <g className={styles.signal}>
          <path className={styles.beam} d="M44 76 L22 31 L44 29 Z" fill={LAMP} />
          <ellipse className={styles.spot} cx="33" cy="27" rx="12" ry="8" fill={LAMP} />
          <rect x="28.5" y="24" width="9" height="7" rx="2" fill={NIGHT} />
          <path d="M31 24 l-2 -3.5 M35 24 l2 -3.5" stroke={NIGHT} strokeWidth="1.2" />
        </g>
      </RoomProp>
      <RoomProp id="et">
        <rect className={styles.hit} x="56" y="16" width="32" height="26" />
        <g className={styles.bike} fill={NIGHT} stroke={NIGHT}>
          <circle cx="68" cy="31" r="2.4" fill="none" strokeWidth="1" />
          <circle cx="76" cy="31" r="2.4" fill="none" strokeWidth="1" />
          <path d="M68 31 l3 -4 h4 l1 4 M71 27 l1 -2" fill="none" strokeWidth="1" />
          <circle cx="72" cy="22.5" r="1.6" stroke="none" />
          <path d="M71 24 l1 3 l3 -1" fill="none" strokeWidth="1.2" />
          <rect x="75.5" y="25" width="3" height="2" stroke="none" />
          <circle cx="77" cy="24" r="1" stroke="none" />
        </g>
      </RoomProp>
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

/** Star-Lord's Walkman and orange headphones on the shelf, still playing. */
function Walkman() {
  return (
    <>
      <rect x="12" y="104" width="82" height="5" rx="2" fill={WOOD} />
      <RoomProp id="walkman">
        <rect x="22" y="84" width="34" height="20" rx="3" fill="#7c93d6" />
        <rect x="22" y="84" width="34" height="5" rx="2" fill={MIST} />
        <rect x="27" y="92" width="24" height="9" rx="1.5" fill="#2a2058" />
        <circle cx="33" cy="96.5" r="2.3" fill={MIST} />
        <circle cx="45" cy="96.5" r="2.3" fill={MIST} />
        <path d="M62 102 q11 -24 22 0" stroke={STEEL} strokeWidth="2.5" fill="none" />
        <circle cx="62" cy="100" r="5" fill="#ff8a3d" />
        <circle cx="84" cy="100" r="5" fill="#ff8a3d" />
      </RoomProp>
      <Note x={60} y={80} wait={0} />
      <Note x={42} y={78} wait={1.3} />
    </>
  );
}

function Posters() {
  return (
    <>
      <RoomProp id="interstellar">
        <rect x="104" y="18" width="32" height="44" rx="2" fill={NIGHT} />
        <circle cx="120" cy="38" r="11" fill={PEACH} opacity="0.18" />
        <path d="M108 38 a12 9 0 0 1 24 0" stroke={CREAM} strokeWidth="2.5" fill="none" />
        <ellipse cx="120" cy="39" rx="14" ry="3.2" fill="none" stroke={PEACH} strokeWidth="2.5" />
        <circle cx="120" cy="38" r="6.5" fill="#000" />
        <Tape x={116} y={15} />
      </RoomProp>
      <RoomProp id="gundam">
        <rect x="146" y="22" width="28" height="42" rx="2" fill={MIST} />
        <path
          d="M152 33 L160 41 L168 33"
          stroke={LAMP}
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        <rect x="152" y="39" width="16" height="5" rx="1.5" fill="#3b5bdb" />
        <rect
          x="153"
          y="43"
          width="14"
          height="13"
          rx="2"
          fill={LIGHT}
          stroke="#6a6595"
          strokeWidth="0.8"
        />
        <rect x="155" y="46" width="10" height="2.6" rx="1" fill={MINT} />
        <rect x="158" y="51" width="4" height="4" rx="0.8" fill={CORAL} />
        <path d="M150 58 h20" stroke="#6a6595" strokeWidth="1.5" />
        <Tape x={156} y={19} />
      </RoomProp>
      <RoomProp id="rush">
        <rect x="184" y="16" width="32" height="44" rx="2" fill="#2a2058" />
        <path d="M187 33 h14 l3 3 v3 h-17 Z" fill={CORAL} />
        <path d="M195 43 h14 l3 3 v3 h-17 Z" fill={LIGHT} />
        <g fill={INK}>
          <circle cx="190" cy="40" r="2.4" />
          <circle cx="201" cy="40" r="2.4" />
          <circle cx="198" cy="50" r="2.4" />
          <circle cx="209" cy="50" r="2.4" />
        </g>
        <path d="M186 55.5 h27" stroke={LIGHT} strokeWidth="3" strokeDasharray="3 3" />
        <text x="200" y="27" textAnchor="middle" className={styles.band} fontSize="7" fill={LAMP}>
          1976
        </text>
        <Tape x={196} y={13} />
      </RoomProp>
      <RoomProp id="memento">
        <g transform="rotate(-7 246 44)">
          <rect x="230" y="28" width="26" height="30" rx="1" fill={LIGHT} />
          <rect x="233" y="31" width="20" height="17" fill="#6a6595" />
          <path d="M234 52 h12 M234 55 h8" stroke={INK} strokeWidth="1" />
        </g>
        <g transform="rotate(8 266 46)">
          <rect x="254" y="30" width="26" height="30" rx="1" fill={LIGHT} />
          <rect x="257" y="33" width="20" height="17" fill={WOOD} />
          <path d="M258 54 h14 M258 57 h6" stroke={INK} strokeWidth="1" />
        </g>
        <Tape x={252} y={26} />
      </RoomProp>

      <RoomProp id="friendsDoor">
        <ellipse cx="114" cy="88" rx="8" ry="10.5" fill="none" stroke={LAMP} strokeWidth="3.2" />
        <ellipse
          cx="114"
          cy="88"
          rx="8"
          ry="10.5"
          fill="none"
          stroke="#c99a3a"
          strokeWidth="1"
          strokeDasharray="1.5 2"
        />
        <circle cx="114" cy="88" r="1.6" fill={NIGHT} />
      </RoomProp>
      <RoomProp id="inception">
        <rect x="130" y="74" width="22" height="30" rx="2" fill="#221d4a" />
        <g className={styles.top}>
          <path d="M141 80 v3" stroke={MIST} strokeWidth="1.5" />
          <path d="M135 86 h12 l-6 9 Z M135 86 l6 -3 l6 3" fill={MIST} />
        </g>
        <path d="M133 99 h16" stroke="#6a6595" strokeWidth="1" />
      </RoomProp>
      <RoomProp id="bttf">
        <rect x="158" y="72" width="30" height="32" rx="2" fill={NIGHT} />
        <path
          className={styles.flame}
          d="M165 102 L172 80 M181 102 L176 80"
          stroke={PEACH}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </RoomProp>
      <RoomProp id="jaws">
        <rect x="194" y="76" width="24" height="28" rx="2" fill={SKY} />
        <rect x="194" y="92" width="24" height="12" fill="#2f7fbf" />
        <path className={styles.fin} d="M200 92 l5 -9 l3 9 Z" fill="#2a2058" />
      </RoomProp>
    </>
  );
}

/** The cursed tape: a well in flickering static. */
function Television({ clipId }: { clipId: string }) {
  return (
    <>
      <path className={styles.glow} d="M234 122 L150 150 L150 228 L234 156Z" fill={MIST} />
      <rect x="224" y="164" width="66" height="26" rx="3" fill={WOOD} />
      <rect x="230" y="190" width="5" height="10" fill={SHADE} />
      <rect x="279" y="190" width="5" height="10" fill={SHADE} />
      <rect x="232" y="172" width="22" height="10" rx="2" fill={SHADE} />
      <rect x="260" y="172" width="22" height="10" rx="2" fill={SHADE} />
      <RoomProp id="ring">
        <path d="M257 112 L242 92 M257 112 L274 94" stroke={MIST} strokeWidth="2" />
        <circle cx="242" cy="92" r="2.5" fill={PEACH} />
        <circle cx="274" cy="94" r="2.5" fill={PEACH} />
        <rect x="228" y="112" width="58" height="52" rx="8" fill="#3b2f73" />
        <g clipPath={`url(#${clipId})`}>
          <rect x="234" y="118" width="40" height="38" fill="#9a98a8" />
          <g fill="#d8d6e2">
            {[
              [121, 2, 0],
              [129, 1.5, 0.3],
              [137, 2, 0.7],
              [146, 1.5, 0.5],
            ].map(([y, height, wait]) => (
              <rect
                key={y}
                className={styles.static}
                style={delay(wait)}
                x="234"
                y={y}
                width="40"
                height={height}
              />
            ))}
          </g>
          <ellipse cx="254" cy="134" rx="12" ry="9" fill={LIGHT} opacity="0.35" />
          <rect x="247" y="140" width="14" height="10" fill="#4a4858" />
          <path d="M247 144 h14 M251 140 v4 M257 144 v6" stroke="#2a2836" strokeWidth="0.8" />
          <ellipse cx="254" cy="140" rx="7" ry="2" fill="#16141e" />
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
      </RoomProp>
    </>
  );
}

/** The Big Bang Theory's brown leather couch, with the mascot in the spot. */
function Couch() {
  return (
    <RoomProp id="couch">
      <rect x="86" y="140" width="124" height="40" rx="12" fill={LEATHER} />
      <g className={styles.bob}>
        <g transform="translate(122 112)">
          <Mascot costume="plain" size={54} />
        </g>
      </g>
      <rect x="80" y="168" width="136" height="24" rx="8" fill="#74492f" />
      <path d="M125 170 v20 M171 170 v20" stroke="#5e3a25" strokeWidth="1.5" />
      <rect x="76" y="152" width="18" height="40" rx="8" fill="#9a6646" />
      <rect x="202" y="152" width="18" height="40" rx="8" fill="#9a6646" />
      <rect x="88" y="192" width="5" height="8" fill={SHADE} />
      <rect x="203" y="192" width="5" height="8" fill={SHADE} />
    </RoomProp>
  );
}

/** The coffee table: a Central Perk mug and Sholay's coin. */
function CoffeeTable() {
  return (
    <>
      <rect x="128" y="206" width="44" height="6" rx="2" fill="#6b4fd0" />
      <rect x="132" y="212" width="4" height="12" fill={WOOD} />
      <rect x="164" y="212" width="4" height="12" fill={WOOD} />
      <RoomProp id="mug">
        <path d="M140 192 h18 l-2 14 h-14 Z" fill={LIGHT} />
        <path d="M158 195 q6 0 6 4 q0 4 -7 4" stroke={LIGHT} strokeWidth="2" fill="none" />
        {[146, 152].map((x, i) => (
          <path
            key={x}
            className={styles.steam}
            style={delay(i * 1.2)}
            d={`M${x} 188 q-3 -4 0 -8 q3 -4 0 -8`}
            stroke={MIST}
            strokeWidth="1.5"
            fill="none"
          />
        ))}
      </RoomProp>
      <RoomProp id="coin">
        <circle className={styles.hit} cx="133" cy="203" r="9" />
        <ellipse
          className={styles.coin}
          cx="133"
          cy="203"
          rx="3.5"
          ry="3.5"
          fill={LAMP}
          stroke="#c99a3a"
          strokeWidth="0.8"
        />
      </RoomProp>
    </>
  );
}

/** Baby Groot, dancing in his pot. */
function Plant() {
  return (
    <RoomProp id="plant">
      <g className={styles.sway}>
        <path d="M27 214 C20 200 12 196 9 185 C20 190 26 200 27 214Z" fill="#3fbf7f" />
        <path d="M27 214 C30 196 38 190 45 181 C43 196 34 204 27 214Z" fill="#2fa36a" />
        <path d="M27 214 C25 198 26 186 28 173 C33 188 31 202 27 214Z" fill="#52d08f" />
      </g>
      <path d="M14 214 h26 l-3 22 h-20Z" fill="#b4501f" />
    </RoomProp>
  );
}

/** The room's furniture: on every screen size. */
export function Furniture({ clipId }: { clipId: string }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x="234" y="118" width="40" height="38" rx="5" />
        </clipPath>
      </defs>
      <ellipse cx="150" cy="228" rx="96" ry="14" fill="#2a2058" />
      <Window />
      <Walkman />
      <Posters />
      <Television clipId={clipId} />
      <Couch />
      <CoffeeTable />
      <Plant />
    </>
  );
}
