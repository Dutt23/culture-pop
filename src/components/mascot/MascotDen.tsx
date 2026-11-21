import { m, useScroll, useTransform } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { classNames } from '../ui/classNames';
import styles from './MascotDen.module.css';
import { BackProps } from './room/BackProps';
import { Furniture } from './room/Furniture';
import { Lights } from './room/Lights';
import { LowRow } from './room/LowRow';
import { PropBubble } from './room/PropBubble';
import {
  isShown,
  propElement,
  ROOM_ATTRIBUTE,
  RoomContext,
  type PropElement,
} from './room/roomContext';
import type { RoomPropId } from './room/roomProps';
import { ToyScenes } from './room/ToyScenes';
import { UpperWall } from './room/UpperWall';
import { useResting } from './useResting';

/**
 * Discover's first screen: the mascot's night-time living room, wall to wall, with the page's
 * heading and search bar (`children`) on its wall. Every prop is a pop-culture reference, and
 * secretly a button: tap one and the mascot says what it is. Small things move, and as the page
 * scrolls the furniture drifts back and the heading fades. `still` (reduced motion) stops every
 * movement. Fades always run; the drawings that move force the page to be laid out again on every
 * frame (SVG movement can't go to the graphics chip), so they rest after 20 s without a touch or
 * scroll and wake on the next one (D69). Off screen, everything pauses.
 */
export function MascotDen({ still, children }: { still: boolean; children: ReactNode }) {
  const clipId = useId();
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 800], [0, 200]);
  const lift = useTransform(scrollY, [0, 800], [0, 320]);
  const fade = useTransform(scrollY, [0, 560], [1, 0]);
  const [openId, setOpenId] = useState<RoomPropId | null>(null);
  const [tabStop, setTabStop] = useState<RoomPropId>('signal');
  const opener = useRef<PropElement | null>(null);
  const denRef = useRef<HTMLDivElement>(null);
  const [offScreen, setOffScreen] = useState(false);
  const resting = useResting(undefined, !still);
  const close = useCallback(() => {
    setOpenId(null);
    // Back to the prop without jumping the page to it.
    opener.current?.focus({ preventScroll: true });
  }, []);
  const room = useMemo(
    () => ({
      openId,
      tabStop,
      setTabStop,
      close,
      open: (id: RoomPropId, element: PropElement) => {
        opener.current = element;
        setOpenId(id);
      },
    }),
    [openId, tabStop, close],
  );

  // A wide-screen prop holding the tab stop can be hidden by turning the phone or resizing the
  // window: hand the stop back to one that's always there.
  useEffect(() => {
    const check = () => {
      const den = denRef.current;
      const stop = den && propElement(den, tabStop);
      if (stop && !isShown(stop)) setTabStop('signal');
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [tabStop]);

  // Scrolled away, the room stops animating: its drawings are repainted on every frame.
  useEffect(() => {
    const den = denRef.current;
    if (!den) return;
    const observer = new IntersectionObserver(([entry]) => setOffScreen(!entry.isIntersecting));
    observer.observe(den);
    return () => observer.disconnect();
  }, []);

  return (
    <RoomContext.Provider value={room}>
      <div
        ref={denRef}
        className={classNames(styles.den, still && styles.still, offScreen && styles.paused)}
        data-scene="night"
        // Read by room.module.css and toys.module.css: their moving drawings pause.
        data-resting={resting || undefined}
        // The room runs up behind the app header, so the site name stays light over it.
        data-behind-header
        {...{ [ROOM_ATTRIBUTE]: '' }}
      >
        <div className={styles.backdrop} aria-hidden="true">
          <div className={styles.floor} />
        </div>
        <m.div className={styles.content} style={still ? undefined : { y: lift, opacity: fade }}>
          {children}
        </m.div>
        <Lights still={still} quiet={offScreen || resting} className={styles.lights} />
        <UpperWall className={styles.upper} />
        <ToyScenes className={styles.toys} />
        <BackProps className={styles.wall} />
        <LowRow className={styles.lowRow} />
        <div className={styles.stage} data-testid="mascot-den">
          <m.div className={styles.furniture} style={still ? undefined : { y: drift }}>
            <div className={styles.tvGlow} aria-hidden="true" />
            <svg className={styles.room} viewBox="0 0 300 250">
              <Furniture clipId={clipId} />
            </svg>
          </m.div>
        </div>
        {openId && <PropBubble id={openId} still={still} onClose={close} />}
      </div>
    </RoomContext.Provider>
  );
}
