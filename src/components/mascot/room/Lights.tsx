import { Fragment, type CSSProperties } from 'react';
import { classNames } from '../../ui/classNames';
import { FRAME, LAMP } from './palette';
import { RoomProp } from './RoomProp';
import styles from './lights.module.css';
import { useSpelling } from './useSpelling';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Plain bulbs at the start of the string, over the app's name; the alphabet comes after them. */
const PLAIN = 14;
const BULBS = PLAIN + ALPHABET.length;
const COLOURS = ['#ff4d4d', '#3fbf7f', '#6fd3ff', LAMP, '#ff8a3d'];
const DROOPS = 4;
/** Height (px) of the wire at x, from 0 to 1 across the screen. */
const droop = (x: number) => 8 + 22 * Math.sin(Math.PI * ((x * DROOPS) % 1));
const WIRE = Array.from({ length: 201 }, (_, i) => `${i * 5},${droop(i / 200)}`).join(' ');

/**
 * The Stranger Things lights, strung across the top of the screen with the alphabet painted under
 * them; now and then they spell a word. A secret prop like the rest.
 */
export function Lights({
  still,
  quiet = false,
  className,
}: {
  still: boolean;
  /** Off screen or resting: the bulbs keep twinkling but stop spelling words (D69). */
  quiet?: boolean;
  className: string;
}) {
  const lit = useSpelling(still || quiet);
  return (
    <RoomProp id="lights" as="div" className={classNames(className, lit && styles.spelling)}>
      <svg
        className={styles.wire}
        viewBox="0 0 1000 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
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
        const letter = i >= PLAIN ? ALPHABET[i - PLAIN] : undefined;
        const place: CSSProperties = { insetInlineStart: `${x * 100}%` };
        return (
          <Fragment key={i}>
            <span
              className={styles.bulb}
              data-on={(letter && lit === letter) || undefined}
              style={{
                ...place,
                insetBlockStart: `${droop(x)}px`,
                color: COLOURS[i % COLOURS.length],
                animationDelay: `${(i * 0.37) % 3.2}s`,
              }}
            />
            {letter && (
              <span
                className={styles.letter}
                aria-hidden="true"
                style={{ ...place, insetBlockStart: `${droop(x) + 13}px` }}
              >
                {letter}
              </span>
            )}
          </Fragment>
        );
      })}
    </RoomProp>
  );
}
