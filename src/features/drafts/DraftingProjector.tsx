import { useEffect, useId, useState } from 'react';
import { Antennae, Body, Smile } from '../../components/mascot/Mascot';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './drafts.module.css';

const LINES = [
  'Threading your frames…',
  'Checking every fact…',
  'Grading it with your filters…',
  'Cutting it into one card…',
];
/** Playful, not progress: the lines just take turns. */
const LINE_MS = 850;

interface DraftingProjectorProps {
  onContinue?: () => void;
  /** Cancels the draft and goes back to the film. */
  onStop: () => void;
}

/** While a card is drafted: the mascot at the projector, a spinning reel and the graded beam. */
export function DraftingProjector({ onStop, onContinue }: DraftingProjectorProps) {
  const { reduced } = useMotionPresets();
  const [line, setLine] = useState(0);
  // Filled after mount: a live region's first text is often not read if it arrives with it.
  const [said, setSaid] = useState('');
  const gradient = `beam${useId().replace(/[^\w-]/g, '')}`;

  useEffect(() => {
    const timer = window.setInterval(() => setLine((n) => (n + 1) % LINES.length), LINE_MS);
    const announce = window.setTimeout(() => setSaid('Making your card…'), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(announce);
    };
  }, []);

  return (
    <div className={reduced ? `${styles.projector} ${styles.still}` : styles.projector}>
      <p className="sr-only" role="status">
        {said}
      </p>
      <div className={styles.rig} aria-hidden="true">
        <svg className={styles.mascot} viewBox="-10 -14 140 134">
          <Antennae />
          <Body />
          <circle cx="46" cy="58" r="11" fill="#f3efff" />
          <circle cx="74" cy="58" r="11" fill="#f3efff" />
          <circle cx="52" cy="60" r="5" fill="#0d0b1f" />
          <circle cx="80" cy="60" r="5" fill="#0d0b1f" />
          <Smile />
        </svg>
        <svg className={styles.spinReel} viewBox="0 0 44 44">
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
        <div className={styles.beam} />
        <div className={styles.gather}>
          <span />
        </div>
      </div>
      {/* Keyed, so each new line plays its entrance. */}
      <p key={line} className={styles.projectorLine} aria-hidden="true">
        {LINES[line]}
      </p>
      <button type="button" className={styles.small} onClick={onStop}>
        Back to the film
      </button>
      {onContinue && (
        <>
          <p className={styles.note}>
            Your card is being made in Activity. You can keep using the app.
          </p>
          <button type="button" className={styles.keep} onClick={onContinue}>
            Continue browsing
          </button>
        </>
      )}
    </div>
  );
}
