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
} from '../../../shared/cardTypes.js';
import { useRepositories } from '../../app/useRepositories';
import { CurationCapacityError } from '../../data/repositories/curationJobRepository';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { Chip } from '../../components/ui/Chip';
import { Lanyard } from '../../components/ui/Lanyard';
import { useBackCloses } from '../../components/ui/useBackCloses';
import { useCurationJobs } from '../../app/useCurationJobs';
import { watchJob } from '../../app/watchedJobs';
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
import { gradeOf, LIMIT_HINTS } from './curationLook';
import { DraftingProjector } from './DraftingProjector';
import { DraftReveal } from './DraftReveal';
import { FilmStrip } from './FilmStrip';
import { framesFrom, type Frame } from './frames';
import { SpliceCheck } from './SpliceCheck';
import { CardLibraryPicker } from './CardLibraryPicker';
import { UserAdditions } from './UserAdditions';
import { useCurationTray } from './useCurationTray';
import { useLibraryCards } from './useLibraryCards';
import { AddedTag as Tag } from './AddedTag';
import { PaperPage, PaperRig } from './PaperPage';
import { usePaperPage } from './usePaperPage';
import { ReconsiderSources } from './ReconsiderSources';
import styles from './drafts.module.css';
import yours from './YourCards.module.css';
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
  // The dialog fills the screen and the pass's rig lets presses through around it: a press on the
  // dialog itself is a press on the backdrop.
  return event.target === event.currentTarget;
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
  // The one paper page behind the pass (owner, 2026-11-22): your cards and your own text or link
  // on step 1, the card whose style to match on step 2.
  const page = usePaperPage<'cards' | 'text' | 'style'>();
  // Your own words on tone and structure stay folded away until asked for.
  const [toneOpen, setToneOpen] = useState(false);
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

  /** Between steps the page is put away at once: each step has its own sections. */
  const goTo = (next: Phase) => {
    page.close();
    setPhase(next);
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
        return styleStep();
      case 'tray':
        return sourcesStep();
    }
  };

  const pickedCards = tray.picked.filter((frame) => frame.kind === 'app');
  const styleCard = tray.tones[0];

  /** Step 1: the results, what you added (each with ×), and the page for your own. */
  const sourcesStep = () => (
    <>
      <h3 className={styles.sec}>Results: tap to pick, up to {LIMITS.sources}</h3>
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
      <section className={yours.group} aria-label="Added by you">
        <p className={yours.groupLabel}>Added by you</p>
        {pickedCards.length === 0 && !userContext.trim() && userLinks.length === 0 && (
          <p className={yours.hint}>Nothing yet. Your cards and your own text or link go here.</p>
        )}
        {pickedCards.map((frame) => (
          <Tag
            key={frame.key}
            tone="card"
            label={frame.title}
            onRemove={() => tray.toggleFrame(frame)}
          />
        ))}
        {userContext.trim() && (
          <Tag tone="own" label="Your note" onRemove={() => setUserContext('')} />
        )}
        {userLinks.map((link) => (
          <Tag
            key={link.url}
            tone="own"
            label={link.title || new URL(link.url).hostname}
            onRemove={() => removeLink(link.url)}
          />
        ))}
      </section>
      <div className={yours.addRow}>
        <button
          type="button"
          className={yours.addButton}
          aria-expanded={page.side === 'cards'}
          onClick={(event) => page.show('cards', event.currentTarget)}
        >
          + Your cards
        </button>
        <button
          type="button"
          className={yours.addButton}
          aria-expanded={page.side === 'text'}
          onClick={(event) => page.show('text', event.currentTarget)}
        >
          + Your text or link
        </button>
      </div>
      <ReconsiderSources
        picked={tray.picked}
        issues={sourceIssues}
        preserveKeys={preserveKeys}
        onChange={setPreserveKeys}
      />
      <CurationTray
        count={tray.picked.length}
        tones={tray.tones}
        onOpen={() =>
          tray.picked.length ? goTo({ kind: 'style' }) : hint('Cut a frame first.')
        }
        shakeKey={shake.key}
        hint={shake.hint}
        reelRef={reelRef}
        autoFocus={focusTray}
      />
    </>
  );

  const removeLink = (url: string) => {
    const frame = tray.picked.find((picked) => picked.key === url);
    if (frame) tray.toggleFrame(frame);
    setUserLinks((links) => links.filter((link) => link.url !== url));
  };

  /** Step 2 (optional): how the new card looks and reads. */
  const styleStep = () => (
    <section className={styles.sheet} aria-label="Card style">
      <h3 className={styles.heading}>Choose the style</h3>
      <p className={styles.note}>
        Optional. How the new card looks and reads. Its facts come only from your{' '}
        {tray.picked.length} {tray.picked.length === 1 ? 'source' : 'sources'}.
      </p>
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
      <div className={yours.group}>
        <p className={yours.groupLabel}>Match a card&apos;s style</p>
        {styleCard ? (
          <Tag
            tone="card"
            label={`Styled like ${styleCard.label}`}
            onRemove={() => tray.setStyleCard(null)}
          />
        ) : (
          <p className={yours.hint}>Its tone, length and layout, never its facts.</p>
        )}
        {library && library.toneCards.length === 0 ? (
          <p className={yours.hint}>
            No cards to match yet. Favourite a reference card or keep a draft first.
          </p>
        ) : (
          <button
            type="button"
            className={yours.addButton}
            aria-expanded={page.side === 'style'}
            onClick={(event) => page.show('style', event.currentTarget)}
          >
            {styleCard ? 'Change card' : '+ Pick a card'}
          </button>
        )}
      </div>
      <button
        type="button"
        className={yours.addButton}
        aria-expanded={toneOpen || Boolean(tone || structure)}
        onClick={() => setToneOpen((open) => !open)}
      >
        + Describe the tone yourself
      </button>
      {(toneOpen || tone || structure) && (
        <>
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
            Your written preferences take priority over the matched card. Card fields and evidence
            rules still apply.
          </p>
        </>
      )}
      <button type="button" className={styles.keep} onClick={() => goTo({ kind: 'check' })}>
        Review sources and style
      </button>
      <button type="button" className={styles.small} onClick={() => goTo({ kind: 'tray' })}>
        Back to sources
      </button>
    </section>
  );

  /** The page's sections: step 1 turns between your cards and your text; step 2 has one. */
  const pageTabs =
    page.side === 'style' ? undefined : (
      <>
        <Chip selected={page.side === 'cards'} onClick={() => page.show('cards')}>
          Your cards
        </Chip>
        <Chip selected={page.side === 'text'} onClick={() => page.show('text')}>
          Your text or link
        </Chip>
      </>
    );

  const pageBody = () => {
    switch (page.side) {
      case 'cards':
        return (
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
        );
      case 'text':
        return (
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
            onRemoveLink={removeLink}
          />
        );
      case 'style':
        return (
          <>
            <p className={yours.hint}>
              Pick one. The new card copies its tone, length and layout, not its facts.
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
              selected={styleCard ? [styleCard.label] : []}
              onSelect={(card) => {
                if (!card.tone) return;
                tray.setStyleCard(card.tone.label === styleCard?.label ? null : card.tone);
                page.fold();
              }}
            />
          </>
        );
      default:
        return null;
    }
  };

  const pageTitle =
    page.side === 'cards'
      ? 'Your cards'
      : page.side === 'text'
        ? 'Your text or link'
        : 'Match a card’s style';

  const eyebrow =
    phase.kind === 'tray'
      ? 'Step 1 of 2 · Sources'
      : phase.kind === 'style'
        ? 'Step 2 of 2 · Style (optional)'
        : undefined;

  /** Escape (and the browser's own close) folds the page first, then closes the pass. */
  const closeOrFold = () => (page.side ? page.fold() : onClose());

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
        closeOrFold();
      }}
      // The browser's own close (Escape, a back gesture) goes the same way.
      onCancel={(event) => {
        event.preventDefault();
        closeOrFold();
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
      <PaperRig open={page.side !== null}>
        <Lanyard
          className={styles.pass}
          title={title}
          eyebrow={eyebrow}
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
        {(phase.kind === 'tray' || phase.kind === 'style') && (
          <PaperPage page={page} title={pageTitle} tabs={pageTabs}>
            {pageBody()}
          </PaperPage>
        )}
      </PaperRig>
    </m.dialog>
  );
}
