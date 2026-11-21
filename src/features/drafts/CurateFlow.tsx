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
import {
  CARD_COLORS,
  CARD_KINDS,
  isStructured,
  LIMITS,
  type CardColor,
  type CardKind,
  type DraftCard,
  type DraftResponse,
  type ToneCard,
} from '../../../shared/cardTypes.js';
import { useRepositories } from '../../app/RepositoriesContext';
import { CurationCapacityError } from '../../data/repositories/curationJobRepository';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { useCurationJobs } from '../../app/CurationJobsProvider';
import type { DraftCardRecord } from '../../data/repositories/draftRepository';
import type { Interpretation, Reference } from '../../domain/types';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import type { MotionPresets } from '../../motion/presets';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import {
  WebSearchError,
  type WebResult,
  type WebSearchFailure,
} from '../../services/retrieval/webSearch';
import { AccessNotice, WebConsent } from '../search/WiderWebSearch';
import { useSettings } from '../settings/SettingsContext';
import { CurationTray } from './CurationTray';
import { gradeOf, keptName, LIMIT_HINTS } from './curationLook';
import { DraftingProjector } from './DraftingProjector';
import { DraftReveal } from './DraftReveal';
import { FilmStrip } from './FilmStrip';
import { framesFrom, type Frame } from './frames';
import { SpliceCheck } from './SpliceCheck';
import { CardLibraryPicker } from './CardLibraryPicker';
import { UserAdditions } from './UserAdditions';
import { useCurationTray } from './useCurationTray';
import styles from './drafts.module.css';
import { DRAFT_FAILURE_TEXT } from './failureText';

/** Where the sheet goes full screen (drafts.module.css): under the 40rem breakpoint, or short. */
const PHONE = '(max-width: 39.99rem), (max-height: 30rem)';

const KIND_LABELS: Record<CardKind, string> = {
  reference: 'Reference and reply',
  topic: 'Topic explanation',
  list: 'List',
  ranking: 'Ranking with a supported basis',
};

/** Where focus goes when the entry that opened the flow went away with its results. */
const SEARCH_BOX = 'input[type="search"]';
/** On <html> while the sheet is open: the page under it doesn't scroll. */
const OPEN_ATTRIBUTE = 'data-sheet-open';

/**
 * The sheet slides up on phones and scales in on wider screens; reduced motion: a short fade.
 * `--backdrop` dims the ::backdrop in and out (it inherits from the dialog).
 */
function sheetMotion(sheet: MotionPresets['sheet']): HTMLMotionProps<'dialog'> {
  const phone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches;
  const { hidden, visible, transition } = sheet(phone);
  return {
    initial: { ...hidden, '--backdrop': 0 },
    animate: { ...visible, '--backdrop': 1 },
    exit: { ...hidden, '--backdrop': 0 },
    transition,
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
    const favouriteIds = new Set((await favourites.list()).map((f) => f.referenceId));
    const saved = await references.getAll();
    const cards = await Promise.all(
      saved.map(async (reference) => {
        const [interpretation] = await references.getInterpretations(reference.id);
        return interpretation && (revealSpoilers || interpretation.spoiler !== 'major')
          ? [{ reference, interpretation, own: false }]
          : [];
      }),
    );
    const appCards = cards.flat();
    const kept = await drafts.list();
    const realLabels = new Map(
      kept.map((k): [string, string] => [keptName(k.card, k.search, revealSpoilers), k.card.label]),
    );
    const tones = [
      ...appCards.filter((card) => favouriteIds.has(card.reference.id)).map(fromFavourite),
      ...kept.map((k) => fromKept(k, revealSpoilers)),
    ];
    // A filter is keyed by its label: the first card with a label wins.
    const toneCards = tones.filter((t, i) => tones.findIndex((u) => u.label === t.label) === i);
    return { appCards, toneCards, realLabels, kept };
  }, [favourites, references, drafts, revealSpoilers]);
}

type Phase =
  | { kind: 'tray' }
  | { kind: 'style' }
  | { kind: 'check' }
  | { kind: 'consent' }
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
  const activity = useCurationJobs();
  const cancelActivity = activity.cancel;
  const activeJob = useRef<string | null>(null);
  const cancelRequested = useRef(false);
  const { drafts } = useRepositories();
  const { settings, setSetting } = useSettings();
  const isOnline = useOnlineStatus();
  const library = useLibraryCards(settings.spoilers === 'show');
  const tray = useCurationTray(search);
  const reelRef = useRef<SVGSVGElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filmScrollRef = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);
  const headingId = useId();
  const { sheet } = useMotionPresets();
  // Read once: focus goes back to whatever opened the flow.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const controller = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'tray' });
  const [failure, setFailure] = useState<WebSearchFailure | null>(null);
  const [sourceIssues, setSourceIssues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState<CardKind>('reference');
  const [userContext, setUserContext] = useState('');
  const [userLinks, setUserLinks] = useState<{ url: string; title: string }[]>([]);
  const [preserveKeys, setPreserveKeys] = useState<string[]>([]);
  const [color, setColor] = useState<CardColor>('lavender');
  const [tone, setTone] = useState('');
  const [structure, setStructure] = useState('');
  // After Keep or Drop the card is gone: focus goes back to the tray, not to the page.
  const [focusTray, setFocusTray] = useState(false);
  // Hint and shake change together: the tray shows a hint only when the key moves with it.
  const [shake, setShake] = useState({ key: 0, hint: '' });

  const frames = useMemo(
    () => [
      ...framesFrom({ candidates, webResults: [...webResults], appCards: library?.appCards ?? [] }),
      ...(library?.kept ?? [])
        .filter((record) => record.card.spoiler !== 'major' || settings.spoilers === 'show')
        .map((record): Frame => ({
          key: record.id,
          kind: 'app',
          from: 'your card',
          title: record.card.label,
          line: record.card.gist,
          text: [
            record.card.gist,
            record.card.means,
            ...record.card.summary.map((line) => line.text),
            ...record.card.context.map((line) => line.text),
          ].join(' '),
        })),
    ],
    [candidates, webResults, library, settings.spoilers],
  );

  // Leaving stops local updates; the root runner keeps the job in Activity.
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
    cancelRequested.current = true;
    if (activeJob.current) void cancelActivity(activeJob.current);
    setFailure('offline');
    setPhase({ kind: 'tray' });
  }, [isOnline, phase.kind, cancelActivity]);

  const hint = (text: string) => setShake((s) => ({ key: s.key + 1, hint: text }));
  const limit = <R extends string>(result: R) => {
    if (result in LIMIT_HINTS) hint(LIMIT_HINTS[result as unknown as keyof typeof LIMIT_HINTS]);
    return result;
  };

  const draft = async () => {
    controller.current?.abort();
    cancelRequested.current = false;
    activeJob.current = null;
    const current = new AbortController();
    controller.current = current;
    const sent = tray.picked;
    setFailure(null);
    setSourceIssues({});
    setStatus('');
    setPhase({ kind: 'drafting' });
    try {
      const body = {
        ...tray.body(about && [...about]),
        ...(isStructured(kind) ? { kind } : {}),
        ...(userContext.trim() ? { userContext: userContext.trim() } : {}),
        ...(preserveKeys.length
          ? {
              retry: {
                preserveSources: sent.flatMap((frame, index) =>
                  preserveKeys.includes(frame.key) ? [index] : [],
                ),
              },
            }
          : {}),
        ...(tone.trim() || structure.trim()
          ? { styleGuidance: { tone: tone.trim(), structure: structure.trim() } }
          : {}),
      };
      // A hidden spoiler's filter shows the search; the AI still gets the card's own label.
      const tones = body.tones?.map((t) => ({
        ...t,
        label: library?.realLabels.get(t.label) ?? t.label,
      }));
      const started = await activity.start({
        request: tones ? { ...body, tones } : body,
        sent,
        userContext,
        color,
      });
      activeJob.current = started.job.id;
      if (cancelRequested.current) {
        await activity.cancel(started.job.id);
        return;
      }
      const response = await started.completion;
      if (current.signal.aborted) return;
      setPhase({ kind: 'reveal', response, sent });
    } catch (error) {
      if (current.signal.aborted) return;
      if (error instanceof CurationCapacityError) {
        setStatus(error.message);
        setPhase({ kind: 'tray' });
        return;
      }
      const failed = error instanceof WebSearchError ? error.failure : 'failed';
      if (error instanceof WebSearchError && error.details) {
        setSourceIssues(
          Object.fromEntries(
            error.details.notUsed.flatMap((item) => {
              const frame = sent[item.source];
              return frame ? [[frame.key, item.why]] : [];
            }),
          ),
        );
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
      id: activeJob.current ? `activity:${activeJob.current}` : `draft:${crypto.randomUUID()}`,
      search,
      card,
      sources: sent.map(({ from, title, url, provenance }) => ({
        from,
        title,
        ...(url ? { url } : {}),
        ...(provenance ? { provenance } : {}),
      })),
      ...(userContext.trim() ? { userContext: userContext.trim() } : {}),
      ...(color !== 'lavender' ? { color } : {}),
      promptVersion,
      savedAt: new Date().toISOString(),
    });

  const stage = () => {
    switch (phase.kind) {
      case 'check':
        return (
          <SpliceCheck
            userContext={userContext}
            styleGuidance={{ tone, structure }}
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
      case 'drafting':
        return (
          <DraftingProjector
            onContinue={onClose}
            onStop={() => {
              cancelRequested.current = true;
              if (activeJob.current) void activity.cancel(activeJob.current);
              controller.current?.abort();
              setPhase({ kind: 'tray' });
            }}
          />
        );
      case 'reveal':
        return (
          <DraftReveal
            response={phase.response}
            userContext={userContext}
            color={color}
            onRetry={(keys) => {
              setPreserveKeys(keys);
              setPhase({ kind: 'tray' });
            }}
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
      case 'style':
        return (
          <section className={styles.sheet} aria-label="Card style">
            <h3 className={styles.heading}>Choose the style</h3>
            <p className={styles.note}>
              Optional. Pick up to {LIMITS.tones} cards for tone, length and organization. Their
              facts stay out of your new card.
            </p>
            <CardLibraryPicker
              mode="style"
              cards={(library?.toneCards ?? []).map((card) => ({
                id: card.label,
                title: card.label,
                description:
                  library?.realLabels.get(card.label) !== undefined &&
                  library.realLabels.get(card.label) !== card.label
                    ? 'Spoiler hidden'
                    : card.gist,
                tone: card,
              }))}
              selected={tray.tones.map((card) => card.label)}
              onSelect={(card) => {
                if (card.tone) limit(tray.toggleTone(card.tone));
              }}
            />
            <label>
              Card format
              <select
                className={styles.styleInput}
                value={kind}
                onChange={(event) => setKind(event.target.value as CardKind)}
              >
                {CARD_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {KIND_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Card colour
              <select
                className={styles.styleInput}
                value={color}
                onChange={(event) => setColor(event.target.value as CardColor)}
              >
                {CARD_COLORS.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            {library && library.toneCards.length === 0 && (
              <p className={styles.note}>
                No example cards yet. Favourite a reference card or keep a draft to use it as a
                colour filter. Filters are optional.
              </p>
            )}

            <label>
              Tone
              <textarea
                className={styles.styleInput}
                maxLength={LIMITS.styleGuidanceChars}
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                placeholder="Warm, concise, beginner-friendly…"
              />
            </label>
            <label>
              Structure
              <textarea
                className={styles.styleInput}
                maxLength={LIMITS.styleGuidanceChars}
                value={structure}
                onChange={(event) => setStructure(event.target.value)}
                placeholder="Start with a plain explanation, then context and an example…"
              />
            </label>
            <p className={styles.note}>
              Your written preferences take priority over example cards. Card fields and evidence
              rules still apply.
            </p>
            <button
              type="button"
              className={styles.keep}
              onClick={() => setPhase({ kind: 'check' })}
            >
              Review sources and style
            </button>
            <button
              type="button"
              className={styles.small}
              onClick={() => setPhase({ kind: 'tray' })}
            >
              Back to sources
            </button>
          </section>
        );
      case 'tray':
        return (
          <>
            <h3 className={styles.sec}>
              The film: tap frames to cut, up to {LIMITS.sources} (including web)
            </h3>
            <div
              ref={filmScrollRef}
              className={styles.filmScroll}
              role="region"
              aria-label="Film results"
              tabIndex={0}
            >
              <FilmStrip
                issues={sourceIssues}
                frames={frames.filter((frame) => frame.kind !== 'app')}
                pickedKeys={new Set(tray.picked.map((f) => f.key))}
                onToggle={(frame) => limit(tray.toggleFrame(frame))}
                reelRef={reelRef}
                scrollRoot={filmScrollRef}
              />
            </div>
            <CardLibraryPicker
              mode="source"
              cards={frames
                .filter((frame) => frame.kind === 'app')
                .map((frame) => ({
                  id: frame.key,
                  title: frame.title,
                  description: frame.line,
                  frame,
                }))}
              selected={tray.picked.map((frame) => frame.key)}
              onSelect={(card) => {
                if (card.frame) limit(tray.toggleFrame(card.frame));
              }}
            />
            {Object.keys(sourceIssues).length > 0 && (
              <fieldset className={styles.sheet}>
                <legend>Reconsider omitted sources</legend>
                {tray.picked
                  .filter((frame) => sourceIssues[frame.key])
                  .map((frame) => (
                    <label key={frame.key}>
                      <input
                        type="checkbox"
                        checked={preserveKeys.includes(frame.key)}
                        onChange={(event) =>
                          setPreserveKeys((keys) =>
                            event.target.checked
                              ? [...keys, frame.key]
                              : keys.filter((key) => key !== frame.key),
                          )
                        }
                      />
                      {frame.title} · {sourceIssues[frame.key]}
                    </label>
                  ))}
                <p className={styles.note}>
                  Retry considers checked sources again. Unsupported claims remain excluded and
                  explained.
                </p>
              </fieldset>
            )}
            <UserAdditions
              context={userContext}
              onContextChange={setUserContext}
              links={userLinks}
              onAddLink={(link) => {
                const frame: Frame = {
                  key: link.url,
                  kind: 'web',
                  from: new URL(link.url).hostname,
                  title: link.title,
                  line: 'Added by you',
                  url: link.url,
                  provenance: 'user',
                };
                if (tray.picked.some((picked) => picked.key === frame.key)) return;
                if (limit(tray.toggleFrame(frame)) === 'added')
                  setUserLinks((links) => [...links, link]);
              }}
              onRemoveLink={(url) => {
                const frame = tray.picked.find((picked) => picked.key === url);
                if (frame) tray.toggleFrame(frame);
                setUserLinks((links) => links.filter((link) => link.url !== url));
              }}
            />
            <CurationTray
              count={tray.picked.length}
              tones={tray.tones}
              onOpen={() =>
                tray.picked.length ? setPhase({ kind: 'style' }) : hint('Cut a frame first.')
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
      {...sheetMotion(sheet)}
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
            <AccessNotice failure={failure} text={DRAFT_FAILURE_TEXT} />
          </p>
        )}
        {stage()}
      </div>
    </m.dialog>
  );
}
