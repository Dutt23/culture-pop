import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalAnchor } from '../../components/ui/ExternalAnchor';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { hostOf } from '../../components/ui/safeHref';
import { UndoNotice } from '../../components/ui/UndoNotice';
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
import { useSavedLinks } from './useSavedLinks';

/** A kept card's sources were saved without their kind: links keep their link. */
const framesOf = (sources: { from: string; title: string; url?: string }[]) =>
  sources.map((s) => ({ ...s, kind: s.url ? 'web' : 'app', key: s.from, line: s.title })) as Frame[];

export function FavouritesPage() {
  const { drafts } = useRepositories();
  const keptCards = useLiveQuery(() => drafts.list(), [drafts]);
  const [open, setOpen] = useState<string | null>(null);
  const references = useFavouriteReferences();
  const favourites = useFavourites();
  const { reduced } = useMotionPresets();
  const { settings } = useSettings();
  const listRef = useRef<HTMLUListElement>(null);
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
  const savedLinks = useSavedLinks();
  const links = savedLinks.links;
  const hasReferences = references !== undefined && references.length > 0;
  const hasLinks = links !== undefined && links.length > 0;

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
        <ul className={styles.list} ref={listRef}>
          {references.map((reference, index) => (
            <AnimatedItem key={reference.id} index={index}>
              <ReferenceCard
                reference={reference}
                favourite={{
                  isFavourite: favourites.ids.has(reference.id),
                  onToggle: () => void unfavourite(reference.id, reference.title),
                }}
              />
            </AnimatedItem>
          ))}
        </ul>
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
          <ul className={styles.list}>
            {keptCards.map((kept) => {
              const name = keptName(kept.card, kept.search, settings.spoilers === 'show');
              return (
                <li key={kept.id} className={styles.keptCard}>
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
                  {open === kept.id && (
                    // The card's colours live on the flow, as in the card flow itself.
                    <div className={draftStyles.flow} data-scene="night">
                      <DraftReveal
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
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {hasLinks && (
        <Section title="Saved web links">
          {savedLinks.error && (
            <p className={styles.error} role="alert">
              {savedLinks.error}
            </p>
          )}
          <ul className={styles.list}>
            {links.map((link) => (
              <li key={link.url} className={styles.link}>
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
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
