import { CrossedDaggers } from './CrossedDaggers';
import { EnergySword } from './EnergySword';
import { FRAME, INK, MIST, STEEL } from './palette';
import room from './room.module.css';
import { RoomProp } from './RoomProp';
import { SwordInStone } from './SwordInStone';
import { ThornWhip } from './ThornWhip';
import styles from './backProps.module.css';

/**
 * Props on the empty wall above the band posters. The same width and x units as `LowRow` (posters
 * at x 0, 86, 172 and 258, each 40 wide), so each prop sits in a gap between two posters; the
 * bottoms run past the frame (overflow visible) and the posters, drawn later, cover them.
 */
export function BackProps({ className }: { className: string }) {
  return (
    <svg
      className={`${className} ${styles.back}`}
      viewBox="0 0 300 90"
      preserveAspectRatio="xMinYMax meet"
    >
      {/* Each is a reference the mascot names when tapped, like the rest of the room. */}
      {/* On the floor in the first poster spot (the floor is at y 152), fully tappable. */}
      <RoomProp id="swordInStone">
        <g transform="translate(20 152) scale(1.3)">
          <SwordInStone />
        </g>
      </RoomProp>
      <RoomProp id="daggers">
        <g transform="translate(63 32) scale(1.4)">
          <CrossedDaggers />
        </g>
      </RoomProp>
      <RoomProp id="roseWhip">
        <g transform="translate(149 18) scale(1.5)">
          <ThornWhip />
        </g>
      </RoomProp>
      {/* Moved up from the poster row, hung above Daft Punk. */}
      <g transform="translate(258 30)">
        <RoomProp id="metallica">
          <rect width="40" height="52" rx="2" fill={INK} stroke={FRAME} />
          <path d="M22 8 l-8 16 h6 l-4 14 l11 -18 h-6 l5 -12 Z" fill={MIST} />
          <text x="20" y="47" textAnchor="middle" className={room.band} fontSize="5.6" fill={STEEL}>
            METALLICA
          </text>
        </RoomProp>
      </g>
      {/* Leans out from behind Queen. */}
      <RoomProp id="energySword">
        <g transform="translate(200 128) rotate(13) scale(1.25)">
          <EnergySword />
        </g>
      </RoomProp>
    </svg>
  );
}
