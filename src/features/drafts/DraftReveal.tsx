import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CitedLine, DraftCard, DraftResponse } from '../../../shared/cardTypes.js';
import { Antennae, Body, Smile } from '../../components/mascot/Mascot';
import { ExternalAnchor } from '../../components/ui/ExternalAnchor';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { UNGRADED } from './curationLook';
import { flyToLibrary } from './flyToReel';
import type { Frame } from './frames';
import styles from './drafts.module.css';

const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const FLIP_IN: Keyframe[] = [
  { transform: 'perspective(700px) rotateY(90deg) scale(.9)', opacity: 0 },
  { transform: 'perspective(700px) rotateY(-8deg) scale(1.02)', opacity: 1 },
  { transform: 'perspective(700px) rotateY(0) scale(1)', opacity: 1 },
];
const FOLD: Keyframe[] = [
  { transform: 'scaleY(1)', opacity: 1 },
  { transform: 'scaleY(.05) translateY(400px)', opacity: 0 },
];
const UNVEIL: Keyframe[] = [
  { opacity: 0, transform: 'translateY(6px)' },
  { opacity: 1, transform: 'translateY(0)' },
];
const REDUCED_MS = 150;
/** The flight (560 ms) plus a beat for the thumbs-up, then back to the film. */
const CHEER_MS = 1100;
/** Where kept cards go: the Favourites tab in the app's navigation. */
const LIBRARY_LINK = 'nav a[href="/favourites"]';
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
  onKeep?: (card: DraftCard) => Promise<void>;
  /** The card has flown out (kept) or folded away (dropped). */
  onDone?: (kept: boolean) => void;
  /** Just the card, to read: no Keep, Edit or Drop. */
  readOnly?: boolean;
  /** The reader's spoiler setting; a major spoiler is veiled without it. */
  revealSpoilers?: boolean;
  /** The reader's search: the veiled card's heading, since the AI label can give it away. */
  search?: string;
}

/** The checked card: flips in with its stamp and sources; Keep, Edit or Drop. */
export function DraftReveal(props: DraftRevealProps) {
  const { response, sent, onKeep, onDone, readOnly, revealSpoilers = false, search = '' } = props;
  const { reduced } = useMotionPresets();
  const ref = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [card, setCard] = useState(response.card);
  const [editing, setEditing] = useState(false);
  const [revealedHere, setRevealedHere] = useState(false);
  const isSpoiler = card.spoiler === 'major';
  const veiled = isSpoiler && !revealSpoilers && !revealedHere;
  // Keep saves the card as shown, so the fields a card can't do without must not be blank.
  const blank = [card.label, card.gist, card.means, card.reply].some((v) => !v.trim());
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const [cheering, setCheering] = useState(false);
  // Everything still running when the reveal goes: cancelled on unmount, so nothing calls back.
  const alive = useRef(true);
  const running = useRef<Animation[]>([]);
  const cheerTimer = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      running.current.forEach((a) => a.cancel());
      clearTimeout(cheerTimer.current);
    };
  }, []);

  // The stage changed under the reader: start them at the card's name. Read-only opens in place.
  useEffect(() => {
    if (!readOnly) titleRef.current?.focus();
  }, [readOnly]);

  // The reveal button goes on tap: focus moves to the real name, and the card fades in.
  useEffect(() => {
    if (!revealedHere) return;
    titleRef.current?.focus();
    if (!canAnimate(bodyRef.current)) return;
    bodyRef.current.animate(reduced ? FADE_IN : UNVEIL, { duration: reduced ? REDUCED_MS : 320 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per reveal
  }, [revealedHere]);

  useEffect(() => {
    if (!canAnimate(ref.current)) return;
    ref.current.animate(reduced ? FADE_IN : FLIP_IN, {
      duration: reduced ? REDUCED_MS : 650,
      easing: 'cubic-bezier(.2,.9,.3,1)',
    });
  }, [reduced]);

  const leave = (frames: Keyframe[], kept: boolean) => {
    if (!canAnimate(ref.current)) return onDone?.(kept);
    const exit = ref.current.animate(reduced ? FADE_OUT : frames, {
      duration: reduced ? REDUCED_MS : 520,
      easing: 'cubic-bezier(.4,0,.2,1)',
      fill: 'forwards',
    });
    exit.onfinish = () => onDone?.(kept);
    running.current.push(exit);
  };

  // Full motion: a copy flies into the library while the mascot gives a thumbs-up.
  const flyOut = () => {
    const el = ref.current;
    if (reduced || !el) return leave(FADE_OUT, true);
    const colour = getComputedStyle(el).getPropertyValue('--g1').trim() || UNGRADED;
    const flight = flyToLibrary(el, document.querySelector(LIBRARY_LINK), colour);
    if (!flight) return leave(FADE_OUT, true);
    running.current.push(flight);
    setCheering(true);
    cheerTimer.current = window.setTimeout(() => onDone?.(true), CHEER_MS);
  };

  const keep = async () => {
    setBusy(true);
    setSaveFailed(false);
    try {
      await onKeep?.(card);
    } catch {
      if (!alive.current) return;
      setSaveFailed(true);
      setBusy(false);
      return;
    }
    if (alive.current) flyOut();
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
      {cheering && (
        // The mascot's thumbs-up: the usual body with one arm raised.
        <svg className={styles.cheer} viewBox="-10 -14 150 134" role="img" aria-label="Thumbs up">
          <Antennae />
          <Body />
          <circle cx="46" cy="58" r="11" fill="#f3efff" />
          <circle cx="74" cy="58" r="11" fill="#f3efff" />
          <circle cx="48" cy="58" r="5" fill="#0d0b1f" />
          <circle cx="76" cy="58" r="5" fill="#0d0b1f" />
          <Smile />
          <path d="M104 74 L120 56" stroke="#6a3df0" strokeWidth="8" strokeLinecap="round" />
          <circle cx="122" cy="52" r="7" fill="#b29bff" />
          <rect x="119" y="34" width="6" height="14" rx="3" fill="#b29bff" />
        </svg>
      )}
      <article
        ref={ref}
        className={cheering ? `${styles.card} ${styles.gone}` : styles.card}
        aria-labelledby={titleId}
      >
        <span className={styles.stamp}>AI draft · check the sources</span>
        <h2 ref={titleRef} id={titleId} className={styles.label} tabIndex={-1}>
          {veiled ? search.trim() || 'Spoiler' : card.label}
        </h2>
        {isSpoiler && <span className={styles.spoilerTag}>Spoiler</span>}
        {veiled ? (
          <div className={styles.veil}>
            <p>This card gives away the ending of a story.</p>
            <button type="button" className={styles.small} onClick={() => setRevealedHere(true)}>
              Reveal spoiler
            </button>
          </div>
        ) : (
          <div ref={bodyRef}>
            {editing && text('Label', card.label, (label) => setCard((c) => ({ ...c, label })))}
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
                  <li key={n.source}>
                    {`Not used: ${sent[n.source]?.from ?? 'a source'} (${n.why})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </article>
      {!readOnly && saveFailed && (
        <p className={styles.error} role="alert">
          Couldn&rsquo;t keep the card. Please try again.
        </p>
      )}
      {!readOnly && (
        <div className={styles.actions}>
          {/* Busy from the Keep tap on: a drop or edit can't race the save or the flight. */}
          <button
            type="button"
            className={styles.small}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              leave(FOLD, false);
            }}
          >
            Drop
          </button>
          {!editing && (
            <button
              type="button"
              className={styles.small}
              disabled={busy}
              onClick={() => {
                // A hidden card can't be edited: Edit uncovers it first.
                if (veiled) setRevealedHere(true);
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            className={styles.keep}
            disabled={busy || blank}
            onClick={() => void keep()}
          >
            Keep
          </button>
        </div>
      )}
    </div>
  );
}
