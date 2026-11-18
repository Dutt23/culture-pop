import { useLiveQuery } from 'dexie-react-hooks';
import { m, type HTMLMotionProps } from 'motion/react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { DraftCard, DraftResponse, ToneCard } from '../../../shared/cardTypes.js';
import { useRepositories } from '../../app/RepositoriesContext';
import { useRetrievalService } from '../../app/retrievalService';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import type { DraftCardRecord } from '../../data/repositories/draftRepository';
import type { Interpretation, Reference } from '../../domain/types';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import {
  WebSearchError,
  type WebResult,
  type WebSearchFailure,
} from '../../services/retrieval/webSearch';
import { AccessCodeForm, FAILURE_TEXT, WebConsent } from '../search/WiderWebSearch';
import { useSettings } from '../settings/SettingsContext';
import { CurationTray } from './CurationTray';
import { gradeOf, keptName, LIMIT_HINTS } from './curationLook';
import { DraftingProjector } from './DraftingProjector';
import { DraftReveal } from './DraftReveal';
import { FilmStrip } from './FilmStrip';
import { framesFrom, type Frame } from './frames';
import { SpliceCheck } from './SpliceCheck';
import { ToneFilters } from './ToneFilters';
import { useCurationTray } from './useCurationTray';
import styles from './drafts.module.css';

/** The search copy names the wider web search; a card has its own words. */
const DRAFT_FAILURE_TEXT: Record<WebSearchFailure, string> = {
  ...FAILURE_TEXT,
  offline: "You're offline. Making a card needs a connection.",
  bad_query: 'This search is too long to make a card from. Try fewer words.',
  rate_limited: 'Too many cards just now. Try again in a minute.',
  daily_cap: "Today's cards are used up. Try again tomorrow.",
  out_of_credit: 'The card writer is paused for now. Try again later.',
  not_configured: "The card writer isn't set up on the server yet.",
  blocked: 'The server refused to make the card.',
  failed: "The card writer didn't answer. Try again.",
};

const PHONE = '(max-width: 600px)';
const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/** Where focus goes when the entry that opened the flow went away with its results. */
const SEARCH_BOX = 'input[type="search"]';
/** On <html> while the sheet is open: the page under it doesn't scroll. */
const OPEN_ATTRIBUTE = 'data-sheet-open';

/**
 * The sheet slides up on phones and scales in on wider screens; reduced motion: a short fade.
 * `--backdrop` dims the ::backdrop in and out (it inherits from the dialog).
 */
function sheetMotion(reduced: boolean): HTMLMotionProps<'dialog'> {
  if (reduced) {
    return {
      initial: { opacity: 0, '--backdrop': 0 },
      animate: { opacity: 1, '--backdrop': 1 },
      exit: { opacity: 0, '--backdrop': 0 },
      transition: { duration: 0.12 },
    };
  }
  const phone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches;
  const hidden = phone
    ? { y: '100%', '--backdrop': 0 }
    : { opacity: 0, scale: 0.97, '--backdrop': 0 };
  return {
    initial: hidden,
    animate: { opacity: 1, y: 0, scale: 1, '--backdrop': 1 },
    exit: hidden,
    transition: { duration: 0.32, ease: EASE_OUT },
  };
}

/** A press on the backdrop: on the dialog element itself, outside its box. */
function onBackdrop(event: ReactMouseEvent<HTMLDialogElement>): boolean {
  const r = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  const outside = x < r.left || x > r.right || y < r.top || y > r.bottom;
  return event.target === event.currentTarget && outside;
}

interface AppCard {
  reference: Reference;
  interpretation: Interpretation;
  own: boolean;
}

const fromFavourite = ({ reference, interpretation: i }: AppCard): ToneCard => ({
  label: reference.title,
  gist: i.gist ?? i.summary,
  means: i.socialMove ?? i.context,
  reply: i.reply ?? '',
  summary: i.summary,
});

const fromKept = ({ card, search }: DraftCardRecord, reveal: boolean): ToneCard => ({
  label: keptName(card, search, reveal),
  gist: card.gist,
  means: card.means,
  reply: card.reply,
  summary: card.summary.map((l) => l.text).join(' '),
});

/**
 * The reader's favourites (frames and tone cards) and kept drafts (tone cards). `realLabels` maps
 * a hidden spoiler's shown name back to its own label, which is what the AI gets.
 */
function useLibraryCards(revealSpoilers: boolean) {
  const { favourites, references, drafts } = useRepositories();
  return useLiveQuery(async () => {
    const saved = await references.getByIds((await favourites.list()).map((f) => f.referenceId));
    const cards = await Promise.all(
      saved.map(async (reference) => {
        const [interpretation] = await references.getInterpretations(reference.id);
        return interpretation ? [{ reference, interpretation, own: false }] : [];
      }),
    );
    const appCards = cards.flat();
    const kept = await drafts.list();
    const realLabels = new Map(
      kept.map((k): [string, string] => [keptName(k.card, k.search, revealSpoilers), k.card.label]),
    );
    const tones = [...appCards.map(fromFavourite), ...kept.map((k) => fromKept(k, revealSpoilers))];
    // A filter is keyed by its label: the first card with a label wins.
    const toneCards = tones.filter((t, i) => tones.findIndex((u) => u.label === t.label) === i);
    return { appCards, toneCards, realLabels };
  }, [favourites, references, drafts, revealSpoilers]);
}

type Phase =
  | { kind: 'tray' }
  | { kind: 'check' }
  | { kind: 'consent' }
  | { kind: 'locked' }
  | { kind: 'drafting' }
  | { kind: 'reveal'; response: DraftResponse; sent: Frame[] };

interface CurateFlowProps {
  search: string;
  /** The reader's "on" search tags, sent as a hint. */
  about?: readonly string[];
  candidates: RetrievedCandidate[];
  webResults: readonly WebResult[];
  onClose: () => void;
}

/**
 * Pick frames and filters, check them, then have the server curate one card from them. Opens as a
 * modal dialog; Escape and a tap on the backdrop close it like Close does.
 */
export function CurateFlow({ search, about, candidates, webResults, onClose }: CurateFlowProps) {
  const { webSearch } = useRetrievalService();
  const { drafts } = useRepositories();
  const { settings, setSetting } = useSettings();
  const isOnline = useOnlineStatus();
  const library = useLibraryCards(settings.spoilers === 'show');
  const tray = useCurationTray(search);
  const reelRef = useRef<SVGSVGElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const headingId = useId();
  const { reduced } = useMotionPresets();
  // Read once: focus goes back to whatever opened the flow.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const controller = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'tray' });
  const [failure, setFailure] = useState<WebSearchFailure | null>(null);
  const [status, setStatus] = useState('');
  // After Keep or Drop the card is gone: focus goes back to the tray, not to the page.
  const [focusTray, setFocusTray] = useState(false);
  // Hint and shake change together: the tray shows a hint only when the key moves with it.
  const [shake, setShake] = useState({ key: 0, hint: '' });

  const frames = useMemo(
    () =>
      framesFrom({ candidates, webResults: [...webResults], appCards: library?.appCards ?? [] }),
    [candidates, webResults, library],
  );

  // Leaving the flow cancels a draft still running.
  useEffect(() => () => controller.current?.abort(), []);

  // Unmounting removes the dialog from the top layer, so the page is live again for the focus.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.focus();
    const html = document.documentElement;
    html.setAttribute(OPEN_ATTRIBUTE, '');
    return () => {
      html.removeAttribute(OPEN_ATTRIBUTE);
      const back = opener?.isConnected ? opener : document.querySelector<HTMLElement>(SEARCH_BOX);
      back?.focus();
    };
  }, [opener]);

  // Going offline mid-draft cancels it; the picks stay in the tray.
  useEffect(() => {
    if (isOnline || phase.kind !== 'drafting') return;
    controller.current?.abort();
    setFailure('offline');
    setPhase({ kind: 'tray' });
  }, [isOnline, phase.kind]);

  const hint = (text: string) => setShake((s) => ({ key: s.key + 1, hint: text }));
  const limit = <R extends string>(result: R) => {
    if (result in LIMIT_HINTS) hint(LIMIT_HINTS[result as unknown as keyof typeof LIMIT_HINTS]);
    return result;
  };

  const draft = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const sent = tray.picked;
    setFailure(null);
    setStatus('');
    setPhase({ kind: 'drafting' });
    try {
      const body = tray.body(about && [...about]);
      // A hidden spoiler's filter shows the search; the AI still gets the card's own label.
      const tones = body.tones?.map((t) => ({
        ...t,
        label: library?.realLabels.get(t.label) ?? t.label,
      }));
      const response = await webSearch.draftCard(tones ? { ...body, tones } : body, current.signal);
      if (current.signal.aborted) return;
      setPhase({ kind: 'reveal', response, sent });
    } catch (error) {
      if (current.signal.aborted) return;
      const failed = error instanceof WebSearchError ? error.failure : 'failed';
      if (failed === 'locked') {
        setPhase({ kind: 'locked' });
        return;
      }
      setFailure(failed);
      setPhase({ kind: 'tray' });
    }
  };

  const make = () => {
    if (settings.webSearch === 'ask') setPhase({ kind: 'consent' });
    else void draft();
  };

  const keep = (card: DraftCard, sent: readonly Frame[], promptVersion: string) =>
    drafts.save({
      id: `draft:${crypto.randomUUID()}`,
      search,
      card,
      sources: sent.map(({ from, title, url }) => (url ? { from, title, url } : { from, title })),
      promptVersion,
      savedAt: new Date().toISOString(),
    });

  const stage = () => {
    switch (phase.kind) {
      case 'check':
        return (
          <SpliceCheck
            frames={tray.picked}
            flags={tray.flags}
            kept={tray.kept}
            tones={tray.tones}
            search={search}
            canMake={tray.canMake}
            onKeep={tray.keepFlagged}
            onCut={(frame) => tray.toggleFrame(frame)}
            onRemoveTone={(tone) => tray.toggleTone(tone)}
            onMake={make}
            onBack={() => setPhase({ kind: 'tray' })}
          />
        );
      case 'consent':
        return (
          <WebConsent
            title="Make a card from these?"
            action="Make a card"
            onAllow={() => {
              // The tap is consent for this card even if storing the choice fails.
              setSetting('webSearch', 'on').catch(() => {});
              void draft();
            }}
            onCancel={() => setPhase({ kind: 'check' })}
          />
        );
      case 'locked':
        return (
          <AccessCodeForm
            onUnlocked={() => void draft()}
            onCancel={() => setPhase({ kind: 'check' })}
          />
        );
      case 'drafting':
        return (
          <DraftingProjector
            onStop={() => {
              controller.current?.abort();
              setPhase({ kind: 'tray' });
            }}
          />
        );
      case 'reveal':
        return (
          <DraftReveal
            response={phase.response}
            sent={phase.sent}
            revealSpoilers={settings.spoilers === 'show'}
            search={search}
            onKeep={(card) => keep(card, phase.sent, phase.response.promptVersion)}
            onDone={(kept) => {
              if (kept) setStatus('Kept on this device.');
              setFocusTray(true);
              setPhase({ kind: 'tray' });
            }}
          />
        );
      case 'tray':
        return (
          <>
            <h3 className={styles.sec}>The film: tap frames to cut, up to 6 (3 web)</h3>
            <FilmStrip
              frames={frames}
              pickedKeys={new Set(tray.picked.map((f) => f.key))}
              onToggle={(frame) => limit(tray.toggleFrame(frame))}
              reelRef={reelRef}
              scrollRoot={dialogRef}
            />
            {library && library.toneCards.length > 0 && (
              <>
                <h3 className={styles.sec}>Colour filters: the tone, up to 2</h3>
                <ToneFilters
                  cards={library.toneCards}
                  picked={tray.tones}
                  onToggle={(card) => limit(tray.toggleTone(card))}
                  reelRef={reelRef}
                />
              </>
            )}
            <CurationTray
              count={tray.picked.length}
              tones={tray.tones}
              onOpen={() =>
                tray.picked.length ? setPhase({ kind: 'check' }) : hint('Cut a frame first.')
              }
              shakeKey={shake.key}
              hint={shake.hint}
              reelRef={reelRef}
              autoFocus={focusTray}
            />
          </>
        );
    }
  };

  return (
    <m.dialog
      ref={dialogRef}
      className={styles.dialog}
      data-scene="night"
      aria-labelledby={headingId}
      tabIndex={-1}
      {...sheetMotion(reduced)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}
      // The browser's own close (a back gesture) goes through onClose too.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // A drag from inside the panel that ends on the backdrop clicks the dialog too: only a press
      // that began on the backdrop closes.
      onPointerDown={(event) => {
        pressedBackdrop.current = onBackdrop(event);
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && onBackdrop(event)) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div className={styles.flow} data-scene="night" style={gradeOf(tray.tones)}>
        <div className={styles.head}>
          <h2 id={headingId} className={styles.title}>
            Make a card from “{search.trim()}”
          </h2>
          <button type="button" className={styles.small} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.note} role="status">
          {status}
        </p>
        {failure && (
          <p className={styles.error} role="alert">
            {DRAFT_FAILURE_TEXT[failure]}
          </p>
        )}
        {stage()}
      </div>
    </m.dialog>
  );
}
