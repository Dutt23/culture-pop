import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CitedLine, DraftCard, DraftResponse } from '../../../api/_lib/cardTypes.js';
import { ExternalAnchor } from '../../components/ui/ExternalAnchor';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import type { Frame } from './frames';
import styles from './drafts.module.css';

const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const FLIP_IN: Keyframe[] = [
  { transform: 'perspective(700px) rotateY(90deg) scale(.9)', opacity: 0 },
  { transform: 'perspective(700px) rotateY(-8deg) scale(1.02)', opacity: 1 },
  { transform: 'perspective(700px) rotateY(0) scale(1)', opacity: 1 },
];
const FLY_OUT: Keyframe[] = [
  { transform: 'translateY(0) scale(1)', opacity: 1 },
  { transform: 'translateY(-340px) scale(.2)', opacity: 0 },
];
const FOLD: Keyframe[] = [
  { transform: 'scaleY(1)', opacity: 1 },
  { transform: 'scaleY(.05) translateY(400px)', opacity: 0 },
];
const REDUCED_MS = 150;
/** Source chips pop in one after another, after the flip. */
const CHIP_DELAY_S = 0.7;
const CHIP_STEP_S = 0.15;

const canAnimate = (el: Element | null): el is Element => typeof el?.animate === 'function';

type LineField = 'summary' | 'context';

interface DraftRevealProps {
  response: DraftResponse;
  /** The frames sent, in order: a line's `sources` index into these. */
  sent: readonly Frame[];
  /** Saves the card as shown (edits included); rejects when it couldn't be saved. */
  onKeep: (card: DraftCard) => Promise<void>;
  /** The card has flown out (kept) or folded away (dropped). */
  onDone: (kept: boolean) => void;
}

/** The checked card: flips in with its stamp and sources; Keep, Edit or Drop. */
export function DraftReveal({ response, sent, onKeep, onDone }: DraftRevealProps) {
  const { reduced } = useMotionPresets();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const [card, setCard] = useState(response.card);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!canAnimate(ref.current)) return;
    ref.current.animate(reduced ? FADE_IN : FLIP_IN, {
      duration: reduced ? REDUCED_MS : 650,
      easing: 'cubic-bezier(.2,.9,.3,1)',
    });
  }, [reduced]);

  const leave = (frames: Keyframe[], kept: boolean) => {
    if (!canAnimate(ref.current)) return onDone(kept);
    const exit = ref.current.animate(reduced ? FADE_OUT : frames, {
      duration: reduced ? REDUCED_MS : 520,
      easing: 'cubic-bezier(.4,0,.2,1)',
      fill: 'forwards',
    });
    exit.onfinish = () => onDone(kept);
  };

  const keep = async () => {
    setBusy(true);
    setSaveFailed(false);
    try {
      await onKeep(card);
      leave(FLY_OUT, true);
    } catch {
      setSaveFailed(true);
      setBusy(false);
    }
  };

  let chip = 0;
  const chips = (sources: readonly number[]) =>
    sources.map((i) => {
      const frame = sent[i];
      if (!frame) return null;
      const delay = `${CHIP_DELAY_S + chip++ * CHIP_STEP_S}s`;
      return (
        <span
          key={i}
          className={styles.chip}
          style={reduced ? undefined : { animationDelay: delay }}
        >
          {frame.kind === 'web' && frame.url ? (
            <ExternalAnchor href={frame.url}>{frame.from}</ExternalAnchor>
          ) : (
            frame.title
          )}
        </span>
      );
    });

  // Labels are unique on a card ("Summary 1", "Summary 2"), so they key the fields.
  const text = (label: string, value: string, onChange: (v: string) => void, extra?: ReactNode) => (
    <div key={label} className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {editing ? (
        <textarea
          className={styles.input}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className={styles.fieldText}>{value}</p>
      )}
      {extra}
    </div>
  );

  const setLine = (field: LineField, at: number, value: string) =>
    setCard((c) => {
      const edited = c[field].map((l, i) => (i === at ? { ...l, text: value } : l));
      return field === 'summary' ? { ...c, summary: edited } : { ...c, context: edited };
    });

  const lines = (label: string, field: LineField) =>
    card[field].map((line: CitedLine, i) =>
      text(
        card[field].length > 1 ? `${label} ${i + 1}` : label,
        line.text,
        (v) => setLine(field, i, v),
        chips(line.sources),
      ),
    );

  return (
    <div className={reduced ? `${styles.reveal} ${styles.still}` : styles.reveal}>
      <article ref={ref} className={styles.card} aria-labelledby={titleId}>
        <span className={styles.stamp}>AI draft · check the sources</span>
        <h2 id={titleId} className={styles.label}>
          {card.label}
        </h2>
        {text('Gist', card.gist, (gist) => setCard((c) => ({ ...c, gist })))}
        {text('What they mean', card.means, (means) => setCard((c) => ({ ...c, means })))}
        {text('You could say', card.reply, (reply) => setCard((c) => ({ ...c, reply })))}
        {lines('Summary', 'summary')}
        {lines('How it’s used', 'context')}
        {card.example &&
          text(
            'Example',
            card.example.text,
            (v) => setCard((c) => ({ ...c, example: c.example && { ...c.example, text: v } })),
            chips(card.example.sources),
          )}
        {response.notUsed.length > 0 && (
          <ul className={styles.unused}>
            {response.notUsed.map((n) => (
              <li key={n.source}>{`Not used: ${sent[n.source]?.from ?? 'a source'} (${n.why})`}</li>
            ))}
          </ul>
        )}
      </article>
      {saveFailed && (
        <p className={styles.error} role="alert">
          Couldn&rsquo;t keep the card. Please try again.
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.small} onClick={() => leave(FOLD, false)}>
          Drop
        </button>
        {!editing && (
          <button type="button" className={styles.small} onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        <button type="button" className={styles.keep} disabled={busy} onClick={() => void keep()}>
          Keep
        </button>
      </div>
    </div>
  );
}
