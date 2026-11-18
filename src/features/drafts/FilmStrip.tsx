import { useEffect, useRef, type RefObject } from 'react';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { UNGRADED } from './curationLook';
import { flyToReel } from './flyToReel';
import type { Frame } from './frames';
import styles from './FilmStrip.module.css';

/** Sprocket pitch: the rails' background repeats every 20 px. */
const PITCH = 20;
const SPEED = 1.6;
const SETTLE_AFTER_MS = 90;
const SETTLE_MS = 160;
/** The gate stops above the tray pinned at the bottom of the scroll area. */
const TRAY_INSET = 84;
const GATE_TOP = 4;
const MIN_RAIL = 8;

/**
 * A projector gate: the rails cover the visible part of the strip, their holes run 1.6x the scroll
 * and settle onto the nearest hole once scrolling stops. Reduced motion: 1:1, no settle.
 * The gate is the window, or `scrollRoot` when the strip scrolls inside it (the flow's dialog).
 */
function useProjectorGate(
  stripRef: RefObject<HTMLDivElement | null>,
  reduced: boolean,
  scrollRoot?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const rails = strip.querySelectorAll<HTMLElement>('[data-rail]');
    let offset = 0;
    let lastTop = strip.getBoundingClientRect().top;
    let timer = 0;
    let frame = 0;
    const place = () => {
      const r = strip.getBoundingClientRect();
      const view = scrollRoot?.current?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight,
      };
      const top = Math.max(0, view.top + GATE_TOP - r.top);
      const height = Math.min(r.height, view.bottom - TRAY_INSET - r.top) - top;
      for (const rail of rails) {
        rail.style.display = height > MIN_RAIL ? '' : 'none';
        rail.style.top = `${top}px`;
        rail.style.height = `${Math.max(0, height)}px`;
        rail.style.backgroundPositionY = `${offset}px`;
      }
    };
    const settle = () => {
      const from = offset;
      const to = Math.round(offset / PITCH) * PITCH;
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / SETTLE_MS);
        offset = from + (to - from) * (1 - (1 - p) ** 3);
        place();
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    // Measured from the strip itself, so it works whichever element scrolls.
    const onScroll = () => {
      const top = strip.getBoundingClientRect().top;
      offset -= (lastTop - top) * (reduced ? 1 : SPEED);
      lastTop = top;
      cancelAnimationFrame(frame);
      place();
      if (reduced) return;
      clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_AFTER_MS);
    };
    place();
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', place);
    // The dialog opens after this first place() (its showModal runs later) and a short strip may
    // never scroll: place again once the strip or its scroll root gets a size.
    const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => place()) : null;
    sized?.observe(strip);
    if (scrollRoot?.current) sized?.observe(scrollRoot.current);
    return () => {
      sized?.disconnect();
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', place);
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [stripRef, reduced, scrollRoot]);
}

interface FilmStripProps {
  frames: readonly Frame[];
  pickedKeys: ReadonlySet<string>;
  /** The tray hook's `toggleFrame`: a frame flies to the reel only when it was 'added'. */
  onToggle: (frame: Frame) => string;
  reelRef?: RefObject<Element | null>;
  /** The element the strip scrolls in, when it isn't the window. */
  scrollRoot?: RefObject<HTMLElement | null>;
}

export function FilmStrip({ frames, pickedKeys, onToggle, reelRef, scrollRoot }: FilmStripProps) {
  const { reduced } = useMotionPresets();
  const stripRef = useRef<HTMLDivElement>(null);
  useProjectorGate(stripRef, reduced, scrollRoot);

  const tick = (frame: Frame, button: HTMLButtonElement) => {
    if (onToggle(frame) !== 'added' || reduced) return;
    const flash = button.querySelector(`.${styles.flash}`);
    if (typeof flash?.animate === 'function') {
      flash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 280 });
    }
    const colour = getComputedStyle(button).getPropertyValue('--grade-1').trim() || UNGRADED;
    flyToReel(button, reelRef?.current ?? null, { colour });
  };

  return (
    <div ref={stripRef} className={styles.strip} data-scene="night">
      <span data-rail className={`${styles.rail} ${styles.railLeft}`} aria-hidden="true" />
      <span data-rail className={`${styles.rail} ${styles.railRight}`} aria-hidden="true" />
      {frames.map((frame, i) => {
        const on = pickedKeys.has(frame.key);
        return (
          <button
            key={frame.key}
            type="button"
            className={on ? `${styles.frame} ${styles.on}` : styles.frame}
            aria-pressed={on}
            onClick={(e) => tick(frame, e.currentTarget)}
          >
            <span className={styles.edge}>
              <span>{frame.from}</span>
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}A</span>
            </span>
            <span className={styles.title}>{frame.title}</span>
            <span className={styles.line}>{frame.line}</span>
            <span className={styles.cut} aria-hidden="true">
              ✂ cut
            </span>
            <span className={styles.flash} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
