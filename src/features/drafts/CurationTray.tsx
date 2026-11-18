import { useEffect, useId, useRef, type RefObject } from 'react';
import { LIMITS, type ToneCard } from '../../../api/_lib/cardTypes.js';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { filterColour } from './curationLook';
import styles from './CurationTray.module.css';

const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-7px)' },
  { transform: 'translateX(7px)' },
  { transform: 'translateX(-4px)' },
  { transform: 'translateX(0)' },
];
const FADE: Keyframe[] = [{ opacity: 0.4 }, { opacity: 1 }];
const BUMP: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.2)' },
  { transform: 'scale(1)' },
];
/** The hint fades in, stays about 1.6 s, then fades out. */
const HINT: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.1 },
  { opacity: 1, offset: 0.9 },
  { opacity: 0 },
];
const HINT_MS = 1800;

const canAnimate = (el: Element | null): el is Element => typeof el?.animate === 'function';

interface CurationTrayProps {
  count: number;
  tones: readonly ToneCard[];
  onOpen: () => void;
  /** Bump it when a pick hits a limit: the tray shakes once and shows `hint`. */
  shakeKey: number;
  hint?: string;
  /** The reel, so frames and filters can fly into it. */
  reelRef?: RefObject<SVGSVGElement | null>;
}

export function CurationTray({ count, tones, onOpen, shakeKey, hint, reelRef }: CurationTrayProps) {
  const { reduced } = useMotionPresets();
  const trayRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const shaken = useRef(shakeKey);
  const gradient = `reel${useId().replace(/[^\w-]/g, '')}`;

  useEffect(() => {
    if (shakeKey === shaken.current) return;
    shaken.current = shakeKey;
    const tray = trayRef.current;
    if (canAnimate(tray)) tray.animate(reduced ? FADE : SHAKE, { duration: reduced ? 150 : 320 });
    if (canAnimate(hintRef.current)) hintRef.current.animate(HINT, { duration: HINT_MS });
  }, [shakeKey, reduced]);

  useEffect(() => {
    if (!reduced && canAnimate(countRef.current)) {
      countRef.current.animate(BUMP, { duration: 260 });
    }
  }, [count, tones.length, reduced]);

  const frames = `${count} of ${LIMITS.sources} frames`;
  return (
    <div className={styles.dock} data-scene="night">
      <p ref={hintRef} role="status" className={styles.hint}>
        {hint}
      </p>
      <span className="sr-only" aria-live="polite">
        {frames}
      </span>
      <button
        ref={trayRef}
        type="button"
        className={styles.tray}
        aria-label={`Review ${count} ${count === 1 ? 'frame' : 'frames'}`}
        onClick={onOpen}
      >
        <svg ref={reelRef} className={styles.reel} viewBox="0 0 44 44" aria-hidden="true">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0.5" className={styles.stop1} />
              <stop offset="0.5" className={styles.stop2} />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" r="20" fill={`url(#${gradient})`} opacity=".35" />
          <circle cx="22" cy="22" r="20" fill="none" stroke={`url(#${gradient})`} strokeWidth="3" />
          <circle cx="22" cy="22" r="4" fill={`url(#${gradient})`} />
          <circle cx="22" cy="10" r="5" className={styles.hole} />
          <circle cx="32.4" cy="28" r="5" className={styles.hole} />
          <circle cx="11.6" cy="28" r="5" className={styles.hole} />
        </svg>
        <span className={styles.text}>
          <span ref={countRef} className={styles.count}>
            {frames}
          </span>
          <span className={styles.sub}>
            {tones.length ? `Graded: ${tones.map((t) => t.label).join(' + ')}` : 'No filter yet'}
          </span>
        </span>
        <span className={styles.dots} aria-hidden="true">
          {tones.map((t) => (
            <span
              key={t.label}
              className={styles.dot}
              style={{ background: filterColour(t.label) }}
            />
          ))}
        </span>
        <span aria-hidden="true">↑</span>
      </button>
    </div>
  );
}
