import { CORAL, INK, LAMP, LEATHER, LIGHT, STEEL } from './palette';
import { RoomProp } from './RoomProp';
import styles from './room.module.css';

function FilmPosters() {
  return (
    <>
      <RoomProp id="ddlj">
        <rect x="0" y="4" width="40" height="52" rx="2" fill="#8fd0ff" />
        <path d="M0 30 l10 -10 l8 7 l9 -12 l13 15 v4 h-40 Z" fill={LIGHT} />
        <rect x="0" y="34" width="40" height="22" fill={LAMP} />
        <g fill="#c99a3a">
          {[
            [6, 40],
            [16, 52],
            [28, 39],
            [34, 48],
            [10, 50],
            [22, 46],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" />
          ))}
        </g>
        <path
          d="M16 42 v8 M16 43 l-5 -4 M16 43 l5 -4"
          stroke={CORAL}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="16" cy="40" r="1.6" fill={INK} />
      </RoomProp>
      <g transform="translate(18 0)">
        <RoomProp id="wasseypur">
          <rect x="46" y="8" width="40" height="48" rx="2" fill="#5a1e1a" />
          <circle cx="78" cy="18" r="5" fill={CORAL} opacity="0.8" />
          <path
            d="M56 52 l6 -30 l6 30 M58 42 h8 M60 32 h4"
            stroke={INK}
            strokeWidth="2"
            fill="none"
          />
          <path d="M70 52 h14 v-6 h-14 Z M72 46 l3 -3 l4 2 l3 -2 v3" fill={INK} />
        </RoomProp>
      </g>
      <g transform="translate(40 4)">
        <RoomProp id="dus">
          <rect x="92" y="6" width="30" height="38" rx="2" fill={CORAL} />
          <text
            x="107"
            y="33"
            textAnchor="middle"
            className={styles.band}
            fontSize="20"
            fill={LIGHT}
          >
            10
          </text>
        </RoomProp>
      </g>
      <g transform="translate(62 4)">
        <RoomProp id="dune">
          <rect x="130" y="4" width="40" height="40" rx="2" fill="#f0a35e" />
          <path d="M130 32 q10 -8 20 0 t20 0 v12 h-40 Z" fill="#d07a3a" />
          <g className={styles.worm}>
            <circle cx="150" cy="24" r="9" fill={LEATHER} />
            <circle cx="150" cy="24" r="6" fill="#2a1206" />
            <path
              d="M150 18 v2 M156 24 h-2 M150 30 v-2 M144 24 h2 M146 20 l1.4 1.4 M154 20 l-1.4 1.4 M154 28 l-1.4 -1.4 M146 28 l1.4 -1.4"
              stroke={LIGHT}
              strokeWidth="1"
            />
          </g>
        </RoomProp>
      </g>
      <g transform="translate(76 10)">
        <RoomProp id="revolver">
          <path d="M188 4 v6" stroke={STEEL} strokeWidth="1.5" />
          <circle cx="188" cy="4" r="1.6" fill={STEEL} />
          <path d="M180 10 h16 l2 30 h-18 Z" fill={LEATHER} />
          <path d="M180 16 h16" stroke="#5e3a25" strokeWidth="1.5" />
          <path d="M184 10 h22 v4 h-22 Z" fill={STEEL} />
          <circle cx="188" cy="14" r="3.5" fill="#6a6595" />
          <path d="M182 10 l-3 -5 h6 l2 5 Z" fill="#5e3a25" />
        </RoomProp>
      </g>
    </>
  );
}

/** Above the window on wide screens: Hindi films, Dune and a six-shooter, spaced out. */
export function UpperWall({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 300 60" preserveAspectRatio="xMidYMax meet">
      <FilmPosters />
    </svg>
  );
}
