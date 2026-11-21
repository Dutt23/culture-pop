import { classNames } from '../../components/ui/classNames';
import styles from './SignInScene.module.css';

/**
 * The sign-in page's night sky: the mascot (public/icon.svg, drawn as in `Mascot.tsx`) with hands
 * that cover its eyes for a password, and that folds into an envelope for an emailed code. Retro
 * props float around it. All original drawings; decorative except the mascot's own label.
 */

/** Where the mascot's hands are. "peek-left": left hand down, so that eye can see. */
export type Pose = 'rest' | 'cover' | 'peek-left' | 'peek-right';

interface SignInSceneProps {
  pose: Pose;
  /** `mail`: folded into an envelope (email code); `sent`: its flap is open. */
  form: 'bot' | 'mail' | 'sent';
  /** -1 (left) to 1 (right): how far along the field the text the eyes follow has reached. */
  gazeX: number | null;
}

function Eyes({
  cx,
  cy,
  r,
  gazeX,
  down,
}: {
  cx: [number, number];
  cy: number;
  r: number;
  gazeX: number | null;
  down: number;
}) {
  const dx = gazeX === null ? 0 : gazeX * (r * 0.4);
  const dy = gazeX === null ? 0 : down;
  return (
    <>
      <circle cx={cx[0]} cy={cy} r={r} className={styles.light} />
      <circle cx={cx[1]} cy={cy} r={r} className={styles.light} />
      <g className={styles.pupils} style={{ transform: `translate(${dx}px, ${dy}px)` }}>
        <circle cx={cx[0]} cy={cy + 1} r={r * 0.45} className={styles.ink} />
        <circle cx={cx[1]} cy={cy + 1} r={r * 0.45} className={styles.ink} />
        <circle cx={cx[0] + 1.5} cy={cy - 0.5} r={r * 0.15} className={styles.white} />
        <circle cx={cx[1] + 1.5} cy={cy - 0.5} r={r * 0.15} className={styles.white} />
      </g>
    </>
  );
}

function Hand({ side, pose }: { side: 'left' | 'right'; pose: Pose }) {
  const covering =
    pose === 'cover' ||
    (pose === 'peek-left' ? side === 'right' : pose === 'peek-right' && side === 'left');
  const peeking = pose === `peek-${side}`;
  const state = covering ? 'cover' : peeking ? 'peek' : 'rest';
  return (
    <g className={styles.hand} data-side={side} data-state={state}>
      <circle cx={side === 'left' ? 46 : 74} cy={60} r={14} className={styles.handShape} />
    </g>
  );
}

function Bot({ pose, gazeX }: { pose: Pose; gazeX: number | null }) {
  const hiding = pose !== 'rest';
  return (
    <g className={styles.bot}>
      <path d="M50 30 L40 14 M70 30 L82 12" className={styles.antennae} />
      <circle cx="40" cy="14" r="4.5" className={styles.peach} />
      <circle cx="82" cy="12" r="4.5" className={styles.peach} />
      <rect x="34" y="98" width="12" height="8" rx="4" className={styles.violet} />
      <rect x="74" y="98" width="12" height="8" rx="4" className={styles.violet} />
      <rect x="16" y="30" width="88" height="72" rx="20" className={styles.violet} />
      <rect x="24" y="38" width="72" height="56" rx="14" className={styles.lilac} />
      <circle cx="35" cy="76" r="5" className={styles.blush} />
      <circle cx="85" cy="76" r="5" className={styles.blush} />
      <Eyes cx={[46, 74]} cy={60} r={11} gazeX={gazeX} down={hiding ? 3 : 2} />
      <path d={hiding ? 'M48 80 q12 4 24 0' : 'M44 78 q16 12 32 0'} className={styles.mouth} />
      <Hand side="left" pose={pose} />
      <Hand side="right" pose={pose} />
    </g>
  );
}

function Envelope({ gazeX }: { gazeX: number | null }) {
  return (
    <g className={styles.envelope}>
      <g className={styles.letter}>
        <rect x="22" y="40" width="76" height="40" rx="4" className={styles.paper} />
        <path d="M32 52 h40 M32 60 h56 M32 68 h30" className={styles.writing} />
      </g>
      <rect x="8" y="44" width="104" height="60" rx="12" className={styles.violet} />
      <path d="M8 100 L50 72 Q60 66 70 72 L112 100" className={styles.fold} />
      <path
        className={classNames(styles.flap, styles.peach)}
        d="M10 48 Q10 44 16 44 L104 44 Q110 44 110 48 L64 80 Q60 83 56 80 Z"
      />
      <Eyes cx={[47, 73]} cy={88} r={9} gazeX={gazeX} down={2} />
      <circle cx="34" cy="96" r="4" className={styles.blush} />
      <circle cx="86" cy="96" r="4" className={styles.blush} />
    </g>
  );
}

/** Small original line drawings of old tech, floating in the sky. */
function RetroProps() {
  return (
    <svg
      className={styles.props}
      viewBox="0 0 340 190"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g className={classNames(styles.float, styles.linePeach)}>
        <rect x="18" y="62" width="34" height="26" rx="5" />
        <path d="M28 62 l-6 -9 M42 62 l6 -9 M24 70 h18 v12 h-18 z" />
      </g>
      <g className={classNames(styles.float, styles.lineLilac)}>
        <path d="M44 126 h30 q8 0 8 9 q0 9 -7 9 q-4 0 -7 -5 h-18 q-3 5 -7 5 q-7 0 -7 -9 q0 -9 8 -9 z" />
        <path d="M50 131 v8 M46 135 h8 M68 133 h0.01 M73 137 h0.01" />
      </g>
      <g className={classNames(styles.float, styles.lineLilac)}>
        <path d="M282 92 q0 -20 18 -20 q18 0 18 20" />
        <rect x="278" y="90" width="9" height="14" rx="3" />
        <rect x="313" y="90" width="9" height="14" rx="3" />
      </g>
      <g className={classNames(styles.float, styles.linePeach)}>
        <rect x="262" y="128" width="40" height="26" rx="4" />
        <circle cx="274" cy="141" r="5" />
        <circle cx="290" cy="141" r="5" />
        <path d="M268 154 l4 -6 h20 l4 6" />
      </g>
      <g className={classNames(styles.float, styles.lineGold)}>
        <rect x="96" y="18" width="22" height="22" rx="3" />
        <path d="M101 18 v7 h12 v-7 M101 40 v-8 h12 v8" />
      </g>
      <g className={styles.twinkle}>
        <circle cx="30" cy="22" r="1.6" className={styles.white} />
        <circle cx="160" cy="14" r="1.2" className={styles.white} />
        <circle cx="236" cy="40" r="1.6" className={styles.gold} />
        <circle cx="200" cy="70" r="1.2" className={styles.white} />
        <path d="M66 36 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" className={styles.peach} />
      </g>
    </svg>
  );
}

export function SignInScene({ pose, form, gazeX }: SignInSceneProps) {
  const label =
    form === 'bot'
      ? pose === 'rest'
        ? 'The mascot, watching you type'
        : 'The mascot, covering its eyes'
      : 'The mascot, folded into an envelope';
  return (
    <div className={styles.scene}>
      <div className={styles.moon} aria-hidden="true" />
      <RetroProps />
      <div className={styles.floor} aria-hidden="true" />
      <svg
        className={classNames(
          styles.mascot,
          form !== 'bot' && styles.mail,
          form === 'sent' && styles.sent,
        )}
        viewBox="-10 -14 140 134"
        role="img"
        aria-label={label}
        data-form={form}
        data-pose={pose}
        data-gaze={gazeX === null ? 'none' : gazeX.toFixed(2)}
      >
        <Bot pose={pose} gazeX={gazeX} />
        <Envelope gazeX={gazeX} />
      </svg>
    </div>
  );
}
