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
import { useRepositories } from '../../app/useRepositories';
import { CurationCapacityError } from '../../data/repositories/curationJobRepository';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { Chip } from '../../components/ui/Chip';
import { Lanyard } from '../../components/ui/Lanyard';
import { useBackCloses } from '../../components/ui/useBackCloses';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { useCurationJobs } from '../../app/useCurationJobs';
import { watchJob } from '../../app/watchedJobs';
import type { DraftCardRecord } from '../../data/repositories/draftRepository';
import type { Interpretation, Reference } from '../../domain/types';
import { useMotionPresets } from '../../motion/useMotionPresets';
import type { MotionPresets } from '../../motion/presets';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import {
  WebSearchError,
  type WebResult,
  type WebSearchFailure,
} from '../../services/retrieval/webSearch';
import type { AuthClient } from '../../services/auth/authClient';
import { useWiderWebAccess } from '../account/useWiderWebAccess';
import { AccessNotice, WebConsent } from '../search/WiderWebSearch';
import { useSettings } from '../settings/useSettings';
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
 * The card maker hangs on a lanyard that drops from the top of the screen (owner, 2026-11-22): the
 * pass swings in and lifts away itself (Lanyard's `swing`); the dialog only dims the ::backdrop in
 * and out with `--backdrop` (it inherits from the dialog). Reduced motion: the pass just appears.
 */
function backdropMotion(sheet: MotionPresets['sheet']): HTMLMotionProps<'dialog'> {
  return {
    initial: { '--backdrop': 0 },
    animate: { '--backdrop': 1 },
    exit: { '--backdrop': 0 },
    transition: sheet(false).transition,
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
    // All four reads at once, and two for the whole library, not one read per card (D69).
    const [favouriteRows, saved, interpretations, kept] = await Promise.all([
      favourites.list(),
      references.getAll(),
      references.getAllInterpretations(),
      drafts.list(),
    ]);
    const favouriteIds = new Set(favouriteRows.map((f) => f.referenceId));
    // Each card's first interpretation by ID, as `getInterpretations` ordered them.
    const firstOf = new Map<string, Interpretation>();
    for (const i of interpretations) {
      const held = firstOf.get(i.referenceId);
      if (!held || i.id < held.id) firstOf.set(i.referenceId, i);
    }
    const appCards = saved.flatMap((reference) => {
      const interpretation = firstOf.get(reference.id);
      return interpretation && (revealSpoilers || interpretation.spoiler !== 'major')
        ? [{ reference, interpretation, own: false }]
        : [];
    });
    const realLabels = new Map(
      kept.map((k): [string, string] => [keptName(k.card, k.search, revealSpoilers), k.card.label]),
    );
    // A kept card by the name its tone card shows, for starting from it.
    const keptByName = new Map(
      kept.map((k): [string, DraftCardRecord] => [keptName(k.card, k.search, revealSpoilers), k]),
    );
    const tones = [
      ...appCards.filter((card) => favouriteIds.has(card.reference.id)).map(fromFavourite),
      ...kept.map((k) => fromKept(k, revealSpoilers)),
    ];
    // A filter is keyed by its label: the first card with a label wins.
    const toneCards = tones.filter((t, i) => tones.findIndex((u) => u.label === t.label) === i);
    return { appCards, toneCards, realLabels, keptByName, kept };
  }, [favourites, references, drafts, revealSpoilers]);
}

type Start = 'pick' | 'card';

const START_OPTIONS: readonly SegmentedOption<Start>[] = [
  { value: 'pick', label: 'Pick one by one' },
  { value: 'card', label: 'Start from one of my cards' },
];

/** What starting from a card filled in, said on the tray until the reader starts over. */
interface StartedFrom {
  name: string;
  sources: number;
}

/** Says plainly what starting from a card filled in, and that its sources' facts will be used. */
function startedText({ name, sources }: StartedFrom): string {
  const set = `Started from “${name}”: format, colour and style are set.`;
  if (sources === 0) return `${set} Pick the sources from the film.`;
  const these = sources === 1 ? 'This source comes' : `These ${sources} sources come`;
  const say = sources === 1 ? 'it says' : 'they say';
  const use = `The new card will use what ${say}. Cut any you don't want in Review.`;
  return `${set} ${these} from your card. ${use}`;
}

/** A kept card's own web pages, as frames to start from (pages without a link can't be sent). */
const framesOfKept = (record: DraftCardRecord): Frame[] =>
  record.sources.flatMap((source) =>
    source.url
      ? [
          {
            key: source.url,
            kind: 'web' as const,
            from: source.from,
            title: source.title,
            line: 'From your card',
            url: source.url,
            ...(source.provenance ? { provenance: source.provenance } : {}),
          },
        ]
      : [],
  );

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
  /** Asks who is signed in (tests pass a fake). */
  authClient?: AuthClient;
}

/**
 * Pick frames and filters, check them, then have the server curate one card from them. Opens as a
 * modal dialog; Escape and a tap on the backdrop close it like Close does.
 */
export function CurateFlow({
  search,
  about,
  candidates,
  webResults,
  onClose,
  authClient,
}: CurateFlowProps) {
  // Signed out or not turned on: say so now, before any picking or the consent text (D65).
  const access = useWiderWebAccess(authClient);
  const blocked = access === 'signed_out' || access === 'not_allowed';
  const activity = useCurationJobs();
  const cancelActivity = activity.cancel;
  const activeJob = useRef<string | null>(null);
  // The job this flow is showing: no "card is ready" pop-up for it while the flow is open.
  const unwatchJob = useRef<(() => void) | null>(null);
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
  const title = `Make a card from “${search.trim()}”`;
  const formId = useId();
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
  // Two ways in (owner, 2026-11-22): pick frames one by one, or start from one of your cards.
  const [start, setStart] = useState<Start>('pick');
  const [startedFrom, setStartedFrom] = useState<StartedFrom | null>(null);
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

  // Leaving stops local updates; the root runner keeps the job in Activity (and its pop-up).
  useEffect(
    () => () => {
      controller.current?.abort();
      unwatchJob.current?.();
    },
    [],
  );

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

  // Back (a phone's back gesture or the browser's button) closes the dialog instead of leaving the
  // page and its picks.
  useBackCloses(onClose);

  // When the notice replaces the stage, focus stays in the dialog instead of falling to the page.
  useEffect(() => {
    if (blocked) dialogRef.current?.focus();
  }, [blocked]);

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
      unwatchJob.current?.();
      unwatchJob.current = watchJob(started.job.id);
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
    if (access === 'signed_out' || access === 'not_allowed') return setFailure(access);
    if (access === 'checking') return;
    if (settings.webSearch === 'ask') setPhase({ kind: 'consent' });
    else void draft();
  };

  /**
   * One card sets the format, colour and writing style; a card you kept also brings its web pages
   * as the picks. The tone card's facts still stay out of the new card; the picks' facts don't.
   */
  const startFromCard = (tone: ToneCard) => {
    const record = library?.keptByName.get(tone.label);
    setKind(record?.card.kind ?? 'reference');
    setColor(record?.color ?? 'lavender');
    const sources = tray.startFrom(record ? framesOfKept(record) : [], tone);
    setStartedFrom({ name: tone.label, sources });
    setStart('pick');
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
            {/* The app's own chips, like Search's filters, not the device's dropdowns (owner). */}
            <div className={styles.choice} role="group" aria-labelledby={`${formId}-format`}>
              <p id={`${formId}-format`} className={styles.choiceLabel}>
                Card format
              </p>
              {CARD_KINDS.map((value) => (
                <Chip key={value} selected={kind === value} onClick={() => setKind(value)}>
                  {KIND_LABELS[value]}
                </Chip>
              ))}
            </div>
            <div className={styles.choice} role="group" aria-labelledby={`${formId}-colour`}>
              <p id={`${formId}-colour`} className={styles.choiceLabel}>
                Card colour
              </p>
              {CARD_COLORS.map((value) => (
                <Chip key={value} selected={color === value} onClick={() => setColor(value)}>
                  <span className={styles.swatch} data-card-color={value} aria-hidden="true" />
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </Chip>
              ))}
            </div>
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
            <SegmentedControl
              legend="How do you want to start?"
              name={`${formId}-start`}
              options={START_OPTIONS}
              value={start}
              onChange={setStart}
            />
            {start === 'card' ? startPicker() : pickOneByOne()}
          </>
        );
    }
  };

  const startPicker = () => (
    <section className={styles.sheet} aria-label="Start from one of my cards">
      <p className={styles.note}>
        Pick one card. It sets the format, colour and writing style; its facts stay out of your new
        card. A card you made also brings the web pages it used, as your picks.
      </p>
      <CardLibraryPicker
        mode="style"
        cards={(library?.toneCards ?? []).map((card) => ({
          id: card.label,
          title: card.label,
          description: library?.keptByName.has(card.label) ? 'A card you made' : 'A favourite',
          tone: card,
        }))}
        selected={startedFrom ? [startedFrom.name] : []}
        onSelect={(card) => {
          if (card.tone) startFromCard(card.tone);
        }}
      />
    </section>
  );

  const pickOneByOne = () => (
    <>
      {startedFrom && (
        <p className={styles.note} role="status">
          {startedText(startedFrom)}
        </p>
      )}
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

  return (
    <m.dialog
      ref={dialogRef}
      className={styles.dialog}
      data-scene="night"
      aria-label={title}
      tabIndex={-1}
      {...backdropMotion(sheet)}
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
      <Lanyard
        className={styles.pass}
        title={title}
        headingLevel={2}
        swing
        corner={
          <button type="button" className={styles.small} onClick={onClose}>
            Close
          </button>
        }
      >
        <div className={styles.flow} data-scene="night" style={gradeOf(tray.tones)}>
          <p className={styles.note} role="status">
            {status}
          </p>
          {failure && (
            <p className={styles.error} role="alert">
              <AccessNotice failure={failure} text={DRAFT_FAILURE_TEXT} />
            </p>
          )}
          {access === 'checking' ? (
            <p className={styles.note} role="status">
              Checking your account…
            </p>
          ) : blocked ? (
            <p className={styles.error} role="alert">
              <AccessNotice failure={access} text={DRAFT_FAILURE_TEXT} />
            </p>
          ) : (
            stage()
          )}
        </div>
      </Lanyard>
    </m.dialog>
  );
}
