import { CrossedDaggers } from './CrossedDaggers';
import { EnergySword } from './EnergySword';
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
      {/* On the floor at Metallica's left edge, half behind it (the floor is at y 152). Further left
          runs off the screen on laptops, where the posters start at the page margin. */}
      <RoomProp id="swordInStone">
        <g transform="translate(2 152) scale(1.3)">
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
      {/* Leans out from behind Queen. */}
      <RoomProp id="energySword">
        <g transform="translate(200 128) rotate(13) scale(1.25)">
          <EnergySword />
        </g>
      </RoomProp>
    </svg>
  );
}
