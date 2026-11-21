import { m, useIsPresent, type HTMLMotionProps, type Variants } from 'motion/react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { CarrierMascot, type CarrierPhase } from '../mascot/CarrierMascot';
import { Antennae } from '../mascot/Mascot';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import type { SheetMotion } from '../../motion/presets';
import { TrayHeader } from './TrayHeader';
import styles from './SideTray.module.css';

/**
 * One side tray for the whole app (D67; owner: "reuse it anywhere by just passing inputs"). Render
 * it inside <AnimatePresence>; pass a title, the content as children and, if wanted, a footer.
 * `look` picks how it arrives:
 * - `tv` (default): the mascot's TV slides in, then its screen switches on like an old CRT; it
 *   switches off to a dot before sliding away.
 * - `carried`: the mascot carries the panel in from the right, muscles bulging and sweat flying,
 *   sits down for a rest once it's there, and shoves it back out on close.
 * Reduced motion: a short fade and a still mascot.
 *
 * A `TrayHeader` (title and Close) stays at the top and `footer` at the bottom; everything between
 * scrolls on its own. Phones (under 40rem) get the whole screen; `size` sets the width above that.
 * Escape, the backdrop, Close and Back close it (unless `stayOpen`); focus goes back to `opener`.
 *
 * To use it in place of another modal: render `<SideTray title onClose opener footer>` with the
 * modal's content as children, inside the same <AnimatePresence> that held the modal.
 */

export type SideTrayLook = 'tv' | 'carried';
export type SideTraySize = 'narrow' | 'default' | 'wide';

export interface SideTrayProps {
  title: string;
  onClose: () => void;
  look?: SideTrayLook;
  /**
   * Width on tablets and desktops: narrow 20rem, default 22.5rem, wide 30rem (36rem from 64rem).
   * Phones (under 40rem) always get the whole screen.
   */
  size?: SideTraySize;
  /** Gets focus back when the tray closes. */
  opener?: RefObject<HTMLElement | null>;
  /** Pinned under the scrolling content, always reachable (e.g. Sign out). */
  footer?: ReactNode;
  /** While true nothing closes the tray (a request it started is still running). */
  stayOpen?: boolean;
  /**
   * Plays the closing move now (screen off, or the mascot's shove) while the tray stays mounted,
   * e.g. just before the caller navigates away. Wait `SIDE_TRAY_LEAVE_MS`, then go.
   */
  leaving?: boolean;
  children: ReactNode;
}

/** How long the closing move takes before the tray slides away. */
export const SIDE_TRAY_LEAVE_MS = 360;

/** Marks the history entry the open tray adds, so Back closes the tray instead of the page. */
const HISTORY_MARK = 'pcdSideTray';
/** On <html> while a tray is open: the page under it doesn't scroll. */
const OPEN_ATTRIBUTE = 'data-tray-open';
const LEAVE_S = SIDE_TRAY_LEAVE_MS / 1000;
const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
/** The carried tray walks in slower than the TV slides: the mascot is lugging it. */
const CARRY_S = 0.8;

function trayMotion(
  tray: SheetMotion,
  reduced: boolean,
  look: SideTrayLook,
): HTMLMotionProps<'dialog'> {
  const enter =
    look === 'carried' && !reduced ? { duration: CARRY_S, ease: EASE_OUT } : tray.transition;
  return {
    initial: { ...tray.hidden, '--backdrop': 0 },
    animate: { ...tray.visible, '--backdrop': 1 },
    exit: {
      ...tray.hidden,
      '--backdrop': 0,
      transition: { ...tray.transition, delay: reduced ? 0 : LEAVE_S },
    },
    transition: enter,
  };
}

/**
 * An old TV's screen: on, a bright line opens up into the picture; off, the picture squeezes to a
 * line, then a dot. Starts once the set has slid in.
 */
const SCREEN: Variants = {
  off: { scaleY: 0.01, scaleX: 0.7, backgroundColor: '#f3efff' },
  on: {
    scaleY: 1,
    scaleX: 1,
    backgroundColor: '#0d0b1f',
    transition: {
      delay: 0.26,
      scaleX: { delay: 0.26, duration: 0.16, ease: EASE_OUT },
      scaleY: { delay: 0.4, duration: 0.3, ease: EASE_OUT },
      backgroundColor: { delay: 0.5, duration: 0.3 },
    },
  },
  leave: {
    scaleY: [1, 0.01, 0.01],
    scaleX: [1, 1, 0.01],
    backgroundColor: ['#0d0b1f', '#f3efff', '#f3efff'],
    transition: { duration: LEAVE_S, times: [0, 0.55, 1] },
  },
};

/** The carrier leans into the shove before the panel slides away. */
const CARRIER: Variants = {
  here: { x: 0, rotate: 0 },
  leave: { x: 10, rotate: 6, transition: { duration: LEAVE_S, ease: EASE_OUT } },
};

/** A press on the backdrop: on the dialog element itself, outside its box. */
function onBackdrop(event: ReactMouseEvent<HTMLDialogElement>): boolean {
  const r = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  const outside = x < r.left || x > r.right || y < r.top || y > r.bottom;
  return event.target === event.currentTarget && outside;
}

export function SideTray({
  title,
  onClose,
  look = 'tv',
  size = 'default',
  opener,
  footer,
  stayOpen = false,
  leaving = false,
  children,
}: SideTrayProps) {
  const { tray, reduced } = useMotionPresets();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const headingId = useId();
  // The carrier walks in, then rests; it pushes when leaving or once the tray starts to go.
  const [arrived, setArrived] = useState(reduced);
  // False while <AnimatePresence> plays the tray's exit.
  const present = useIsPresent();
  const phase: CarrierPhase =
    leaving || !present ? 'pushing' : arrived ? 'resting' : 'carrying';
  const close = () => {
    if (!stayOpen) onClose();
  };
  const closeRef = useRef(close);
  const stayOpenRef = useRef(stayOpen);
  useLayoutEffect(() => {
    closeRef.current = close;
    stayOpenRef.current = stayOpen;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const html = document.documentElement;
    html.setAttribute(OPEN_ATTRIBUTE, '');
    return () => {
      html.removeAttribute(OPEN_ATTRIBUTE);
      // Only if focus went down with the tray: a page it led to may have focused its heading.
      const active = document.activeElement;
      if (!active || active === document.body) opener?.current?.focus();
    };
  }, [opener]);

  // Back (a phone's back gesture or the browser's button) closes the tray, not the page.
  useEffect(() => {
    window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_MARK]: true }, '');
    let poppedByBack = false;
    const onPop = () => {
      // A pop that lands on another of our entries (StrictMode's second mount) is not a close.
      if ((window.history.state as Record<string, unknown> | null)?.[HISTORY_MARK]) return;
      // Work still running: stay, and put our entry back so the next Back still closes.
      if (stayOpenRef.current) {
        window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_MARK]: true }, '');
        return;
      }
      poppedByBack = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed some other way: take our entry back off the history.
      const state = window.history.state as Record<string, unknown> | null;
      if (!poppedByBack && state?.[HISTORY_MARK]) window.history.back();
    };
  }, []);

  const content = (
    <>
      <TrayHeader title={title} titleId={headingId} onClose={close} />
      <div className={styles.scroll}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  );

  return (
    <m.dialog
      ref={dialogRef}
      className={styles.set}
      data-look={look}
      data-size={size}
      data-scene="night"
      aria-labelledby={headingId}
      {...trayMotion(tray, reduced, look)}
      onAnimationComplete={() => setArrived(true)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeRef.current();
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = onBackdrop(event);
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && onBackdrop(event)) closeRef.current();
        pressedBackdrop.current = false;
      }}
    >
      {look === 'tv' ? (
        <>
          <svg className={styles.antennae} viewBox="30 4 60 28" aria-hidden="true">
            <Antennae />
          </svg>
          <m.div
            className={styles.screen}
            variants={reduced ? undefined : SCREEN}
            initial={reduced ? undefined : 'off'}
            animate={reduced ? undefined : leaving ? 'leave' : 'on'}
            exit={reduced ? undefined : 'leave'}
          >
            {content}
          </m.div>
          <div className={styles.controls} aria-hidden="true">
            <span className={styles.grille} />
            <span className={styles.knob} />
            <span className={styles.knob} />
          </div>
        </>
      ) : (
        <>
          <m.div
            className={styles.carrier}
            variants={reduced ? undefined : CARRIER}
            initial={reduced ? undefined : 'here'}
            animate={reduced ? undefined : leaving ? 'leave' : 'here'}
            exit={reduced ? undefined : 'leave'}
          >
            <CarrierMascot phase={reduced ? 'resting' : phase} />
          </m.div>
          <div className={styles.panel}>{content}</div>
        </>
      )}
    </m.dialog>
  );
}
