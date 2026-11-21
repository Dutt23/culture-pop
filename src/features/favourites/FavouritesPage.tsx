import { m } from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { usePagedList } from '../../app/usePagedList';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { Collection } from '../../components/ui/Collection';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalAnchor } from '../../components/ui/ExternalAnchor';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { hostOf } from '../../components/ui/safeHref';
import { UndoNotice } from '../../components/ui/UndoNotice';
import { DRAW_ALL_UP_TO, VirtualCollection } from '../../components/ui/VirtualCollection';
import { cardElement } from '../../motion/cardElement';
import { dissolve } from '../../motion/dissolve';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { DraftReveal } from '../drafts/DraftReveal';
import { keptName } from '../drafts/curationLook';
import type { Frame } from '../drafts/frames';
import draftStyles from '../drafts/drafts.module.css';
import { useSettings } from '../settings/SettingsContext';
import styles from './FavouritesPage.module.css';
import { useFavourites, useFavouriteReferences } from './useFavourites';
import { useSavedLinkList, useSavedLinks } from './useSavedLinks';

/** Up to this many kept cards read as a film strip; a longer strip is slow to scan, so rows. */
const MAX_FRAMES = 20;
/** First guesses at a row's height (px); each row is measured once on screen (D69). */
const CARD_ESTIMATE_PX = 200;
const ROW_ESTIMATE_PX = 72;
/** Matches `--size-card-grid` in tokens.css: cards sit side by side once two fit. */
const CARD_MIN_REM = 18;

/** A kept card's sources were saved without their kind: links keep their link. */
const framesOf = (sources: { from: string; title: string; url?: string }[]) =>
  sources.map((s) => ({
    ...s,
    kind: s.url ? 'web' : 'app',
    key: s.from,
    line: s.title,
  })) as Frame[];

export function FavouritesPage() {
  const { drafts } = useRepositories();
  // Every list here is read 1,000 at a time and draws only the rows on screen above 200 (D69, D70).
  const keptList = usePagedList(
    (limit) => drafts.list(limit),
    () => drafts.count(),
    [drafts],
  );
  const keptCards = keptList.rows;
  const [open, setOpen] = useState<string | null>(null);
  const saved = useFavouriteReferences();
  const references = saved.rows;
  // Removing goes through the heart, so the cards read so far are the ones asked about.
  const favourites = useFavourites(references?.map((reference) => reference.id) ?? []);
  const { reduced, reveal } = useMotionPresets();
  const { settings } = useSettings();
  const listRef = useRef<HTMLDivElement>(null);
  const [removed, setRemoved] = useState<{ id: string; title: string } | null>(null);

  // On this page the heart only ever removes: the card crumbles away and can be put back.
  const unfavourite = async (id: string, title: string) => {
    const card = cardElement(listRef.current, id);
    const dust = dissolve(card, reduced);
    if (await favourites.toggle(id)) {
      // Let go of the heart now, not when the list catches up: the Undo bar picks focus up.
      if (card?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      setRemoved({ id, title });
    } else {
      dust.restore();
    }
  };
  const linkList = useSavedLinkList();
  const links = linkList.rows;
  const savedLinks = useSavedLinks();
  const hasReferences = references !== undefined && references.length > 0;
  const hasLinks = links !== undefined && links.length > 0;
  const isStrip = keptList.total <= MAX_FRAMES;
  const openKept = keptCards?.find((kept) => kept.id === open);
  // The open card itself, read-only, in the card flow's own colours.
  const keptReveal = (kept: NonNullable<typeof openKept>) => (
    <div className={draftStyles.flow} data-scene="night">
      <DraftReveal
        userContext={kept.userContext}
        color={kept.color}
        readOnly
        revealSpoilers={settings.spoilers === 'show'}
        search={kept.search}
        response={{
          card: kept.card,
          notUsed: [],
          provider: 'fake',
          promptVersion: kept.promptVersion,
        }}
        sent={framesOf(kept.sources)}
      />
    </div>
  );

  const renderKept = (kept: NonNullable<typeof keptCards>[number]) => {
    const name = keptName(kept.card, kept.search, settings.spoilers === 'show');
    return (
      <div className={styles.keptCard}>
        <div className={styles.link}>
          <button
            type="button"
            className={styles.keptOpen}
            aria-expanded={open === kept.id}
            onClick={() => setOpen(open === kept.id ? null : kept.id)}
          >
            {name}
          </button>
          <button
            type="button"
            className={styles.keptRemove}
            aria-label={`Remove ${name}`}
            onClick={() => void drafts.remove(kept.id)}
          >
            Remove
          </button>
        </div>
        {/* Rows open the card in place; a frame is too narrow, see below the strip. */}
        {!isStrip && open === kept.id && keptReveal(kept)}
      </div>
    );
  };

  return (
    <Page title="Favourites" intro="Saved on this device only." wide>
      {references && links && references.length === 0 && links.length === 0 && (
        <EmptyState title="No favourites yet">
          <p>Tap “Favourite” on any reference to keep it here. You can save web links too.</p>
          <Link to="/discover">Start exploring</Link>
        </EmptyState>
      )}
      {favourites.error && (
        <p className={styles.error} role="alert">
          {favourites.error}
        </p>
      )}
      {hasReferences && (
        <div ref={listRef}>
          <VirtualCollection
            label="Favourite references"
            className={styles.list}
            items={references}
            total={saved.total}
            getKey={(reference) => reference.id}
            estimateSize={CARD_ESTIMATE_PX}
            minItemRem={CARD_MIN_REM}
            onNeedMore={saved.more}
            renderItem={(reference, index) => {
              const card = (
                <ReferenceCard
                  reference={reference}
                  favourite={{
                    isFavourite: favourites.ids.has(reference.id),
                    onToggle: () => void unfavourite(reference.id, reference.title),
                  }}
                />
              );
              // A short list deals its cards in, as before; recycled rows of a long one don't.
              return saved.total > DRAW_ALL_UP_TO ? (
                card
              ) : (
                <m.div variants={reveal} custom={index} initial="hidden" animate="visible">
                  {card}
                </m.div>
              );
            }}
          />
        </div>
      )}
      {removed && (
        <UndoNotice
          message={`Removed “${removed.title}” from Favourites.`}
          onExpire={() => setRemoved(null)}
          onUndo={() => {
            setRemoved(null);
            void favourites.toggle(removed.id);
          }}
        />
      )}
      {keptCards && keptCards.length > 0 && (
        <Section title="Your cards" description="Kept AI drafts. They only live on this device.">
          <div className={styles.kept} data-scene={isStrip ? 'night' : undefined}>
            {isStrip ? (
              <Collection
                items={keptCards}
                getKey={(card) => card.id}
                label="Kept cards"
                variant="frames"
                renderItem={renderKept}
              />
            ) : (
              <VirtualCollection
                items={keptCards}
                total={keptList.total}
                getKey={(card) => card.id}
                label="Kept cards"
                estimateSize={ROW_ESTIMATE_PX}
                onNeedMore={keptList.more}
                renderItem={renderKept}
              />
            )}
          </div>
          {isStrip && openKept && keptReveal(openKept)}
        </Section>
      )}
      {hasLinks && (
        <Section title="Saved web links">
          {savedLinks.error && (
            <p className={styles.error} role="alert">
              {savedLinks.error}
            </p>
          )}
          <VirtualCollection
            label="Saved web links"
            className={styles.list}
            items={links}
            total={linkList.total}
            getKey={(link) => link.url}
            estimateSize={ROW_ESTIMATE_PX}
            onNeedMore={linkList.more}
            renderItem={(link) => (
              <div className={styles.link}>
                <div className={styles.linkText}>
                  <ExternalAnchor href={link.url} className={styles.linkTitle}>
                    {link.title}
                  </ExternalAnchor>
                  <span className={styles.linkMeta}>{hostOf(link.url)} · Web link, unverified</span>
                </div>
                <FavouriteButton
                  iconOnly
                  label={`Save link ${link.title}`}
                  isFavourite
                  onToggle={() => void savedLinks.toggle(link)}
                />
              </div>
            )}
          />
        </Section>
      )}
    </Page>
  );
}
