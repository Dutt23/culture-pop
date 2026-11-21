import { INK, LAMP, LIGHT, MIST, NIGHT, STEEL } from './palette';
import { RoomProp } from './RoomProp';
import styles from './room.module.css';

function BandPosters() {
  return (
    <>
      {/* Metallica hangs on the wall above Daft Punk (BackProps); the sword in the stone has its spot. */}
      <g transform="translate(86 0)">
        <RoomProp id="linkinPark">
          <rect width="40" height="52" rx="2" fill="#4a4858" />
          <path
            d="M20 10 l7 4 v8 l-7 4 l-7 -4 v-8 Z M20 16 l3 2 v3 l-3 2 l-3 -2 v-3 Z"
            fill="none"
            stroke={MIST}
            strokeWidth="1"
          />
          <text
            x="20"
            y="45"
            textAnchor="middle"
            className={styles.band}
            fontSize="5.2"
            fill={LIGHT}
          >
            LINKIN PARK
          </text>
        </RoomProp>
      </g>
      <g transform="translate(172 0)">
        <RoomProp id="queen">
          <rect width="40" height="52" rx="2" fill={LIGHT} />
          <path
            d="M8 28 l3 -14 l6 8 l3 -11 l3 11 l6 -8 l3 14 Z"
            fill={LAMP}
            stroke="#c99a3a"
            strokeWidth="0.8"
          />
          <text
            x="20"
            y="44"
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontWeight="700"
            fontSize="7"
            fill={INK}
          >
            QUEEN
          </text>
        </RoomProp>
      </g>
      <g transform="translate(258 0)">
        <RoomProp id="daftPunk">
          <rect width="40" height="52" rx="2" fill={NIGHT} />
          <ellipse cx="12" cy="26" rx="8" ry="10" fill={LAMP} />
          <rect x="5" y="23" width="14" height="5" rx="2" fill={INK} />
          <ellipse cx="29" cy="26" rx="8" ry="10" fill={MIST} />
          <path d="M22 20 h14 v8 h-14 Z" fill={INK} />
          <path className={styles.visor} d="M23 24 h12" stroke="#ff4d6d" strokeWidth="1.6" />
          <text x="20" y="46" textAnchor="middle" className={styles.band} fontSize="5" fill={LIGHT}>
            DAFT PUNK
          </text>
        </RoomProp>
      </g>
    </>
  );
}

function FloorProps() {
  return (
    <>
      <g transform="translate(-22 0)">
        <RoomProp id="kitt">
          <ellipse cx="170" cy="106" rx="42" ry="4" fill={INK} opacity="0.5" />
          <path
            d="M132 102 v-8 q2 -4 10 -5 l12 -6 h22 l14 6 q14 1 18 5 v8 Z"
            fill={INK}
            stroke="#3a3270"
            strokeWidth="0.8"
          />
          <path d="M156 85 h19 l10 5 h-35 Z" fill="#221d4a" />
          <rect x="188" y="95" width="14" height="2.5" fill="#2a1206" />
          <rect className={styles.scanner} x="188" y="95" width="4" height="2.5" fill="#ff3b3b" />
          <circle cx="145" cy="103" r="5" fill="#16141e" stroke="#4a4858" />
          <circle cx="192" cy="103" r="5" fill="#16141e" stroke="#4a4858" />
        </RoomProp>
      </g>
      <g transform="translate(4 0)">
        <RoomProp id="dhoom">
          <ellipse cx="248" cy="107" rx="26" ry="3.5" fill={INK} opacity="0.5" />
          <circle cx="232" cy="100" r="7" fill="none" stroke="#16141e" strokeWidth="3" />
          <circle cx="265" cy="100" r="7" fill="none" stroke="#16141e" strokeWidth="3" />
          <path
            d="M232 100 l10 -12 h14 l9 12 M242 88 l-4 -4 h-4 M256 88 l6 -6 h5"
            stroke={STEEL}
            strokeWidth="2"
            fill="none"
          />
          <path d="M238 92 q8 -10 22 -6 l6 8 h-16 Z" fill="#3b5bdb" />
          <path d="M242 86 h12" stroke={LAMP} strokeWidth="1.5" />
        </RoomProp>
      </g>
    </>
  );
}

/**
 * Under the search bar on wide screens: band posters spread along the wall, KITT and the Dhoom bike
 * on the floor. The toys play at the floor's left end.
 */
export function LowRow({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 300 112" preserveAspectRatio="xMinYMax meet">
      <BandPosters />
      <FloorProps />
    </svg>
  );
}
