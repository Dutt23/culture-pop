import { useEffect, useId, useRef } from 'react';
import { roleOf, type FlagReason } from '../../../api/_lib/cardCurate.js';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import type { Frame } from './frames';
import film from './FilmStrip.module.css';
import styles from './drafts.module.css';

const FADE_IN: Keyframe[] = [{ opacity: 0.4 }, { opacity: 1 }];
const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const SPRING_OPEN: Keyframe[] = [
  { transform: 'translateY(40%)', opacity: 0 },
  { transform: 'translateY(-2%)', opacity: 1 },
  { transform: 'translateY(0)', opacity: 1 },
];
const WIGGLE: Keyframe[] = [
  { transform: 'rotate(0)' },
  { transform: 'rotate(-1.5deg)' },
  { transform: 'rotate(1.5deg)' },
  { transform: 'rotate(0)' },
];
const FLICK_OFF: Keyframe[] = [
  { transform: 'translateX(0)', opacity: 1 },
  { transform: 'translateX(130%) rotate(8deg)', opacity: 0 },
];
const REDUCED_MS = 150;

const canAnimate = (el: Element | null): el is Element => typeof el?.animate === 'function';

const REASONS: Record<Exclude<FlagReason, 'off_topic'>, string> = {
  other_language: 'Looks like another language',
  duplicate: 'Repeats another frame',
};
const reasonText = (reason: FlagReason, search: string) =>
  reason === 'off_topic' ? `Doesn’t seem to be about “${search.trim()}”` : REASONS[reason];

interface CheckFrameProps {
  frame: Frame;
  flag: FlagReason | null;
  kept: boolean;
  search: string;
  onKeep: () => void;
  onCut: () => void;
}

function CheckFrame({ frame, flag, kept, search, onKeep, onCut }: CheckFrameProps) {
  const { reduced } = useMotionPresets();
  const ref = useRef<HTMLLIElement>(null);
  const cutting = useRef(false);
  const flagged = flag !== null;

  // A flagged frame arrives with one wiggle.
  useEffect(() => {
    if (!flagged || !canAnimate(ref.current)) return;
    ref.current.animate(reduced ? FADE_IN : WIGGLE, {
      duration: reduced ? REDUCED_MS : 360,
      delay: reduced ? 0 : 300,
    });
  }, [flagged, reduced]);

  const cut = () => {
    if (cutting.current) return;
    cutting.current = true;
    if (!canAnimate(ref.current)) return onCut();
    const flick = ref.current.animate(reduced ? FADE_OUT : FLICK_OFF, {
      duration: reduced ? REDUCED_MS : 320,
      fill: 'forwards',
    });
    flick.onfinish = onCut;
  };

  const waiting = flagged && !kept;
  const look = waiting ? styles.flagged : film.on;
  return (
    <li ref={ref} className={`${film.frame} ${styles.checkFrame} ${look}`}>
      <span className={film.edge}>
        <span>{frame.from}</span>
      </span>
      <span className={film.title}>{frame.title}</span>
      <span className={film.line}>{frame.line}</span>
      {flag && (
        <p className={styles.warn}>
          {kept ? '⚠ Kept by you: the AI may leave it out' : `⚠ ${reasonText(flag, search)}`}
        </p>
      )}
      {waiting && (
        <div className={styles.actions}>
          <button type="button" className={styles.small} onClick={onKeep}>
            Keep
          </button>
          <button type="button" className={styles.small} onClick={cut}>
            Cut it out
          </button>
        </div>
      )}
    </li>
  );
}

interface SpliceCheckProps {
  frames: readonly Frame[];
  flags: Record<string, FlagReason | null>;
  kept: ReadonlySet<string>;
  search: string;
  canMake: boolean;
  onKeep: (key: string) => void;
  onCut: (frame: Frame) => void;
  onMake: () => void;
  onBack: () => void;
}

/** The review before anything is sent: every pick, its flag, and Make a card. */
export function SpliceCheck(props: SpliceCheckProps) {
  const { frames, flags, kept, search, canMake, onKeep, onCut, onMake, onBack } = props;
  const { reduced } = useMotionPresets();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!canAnimate(ref.current)) return;
    ref.current.animate(reduced ? FADE_IN : SPRING_OPEN, {
      duration: reduced ? REDUCED_MS : 480,
      easing: 'cubic-bezier(.2,.9,.3,1)',
    });
  }, [reduced]);

  const showsUse = frames.some((f) => roleOf(f.from, f.kind) === 'usage');
  return (
    <section ref={ref} className={styles.sheet} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.heading}>
        Splice check
      </h2>
      <p className={styles.note}>Nothing is sent until you tap Make a card.</p>
      <ol className={`${film.strip} ${styles.checkStrip}`}>
        {frames.map((frame) => (
          <CheckFrame
            key={frame.key}
            frame={frame}
            flag={flags[frame.key] ?? null}
            kept={kept.has(frame.key)}
            search={search}
            onKeep={() => onKeep(frame.key)}
            onCut={() => onCut(frame)}
          />
        ))}
      </ol>
      {frames.length > 0 && !showsUse && (
        <p className={styles.note}>Add a web result to show how people use it.</p>
      )}
      <button type="button" className={styles.make} disabled={!canMake} onClick={onMake}>
        Make a card
      </button>
      <button type="button" className={styles.small} onClick={onBack}>
        Back to the film
      </button>
    </section>
  );
}
