import { Link } from 'react-router';
import { CATEGORY_LABEL, ERA_LABEL, fromWorks } from '../../domain/labels';
import type { Reference } from '../../domain/types';
import { FavouriteButton } from '../favourite-button/FavouriteButton';
import { classNames } from '../ui/classNames';
import styles from './ReferenceCard.module.css';
import { rememberOpenPack } from './openPack';

export type ReferenceCardVariant = 'compact' | 'feature';

export interface ReferenceCardFavourite {
  isFavourite: boolean;
  onToggle: () => void;
}

interface ReferenceCardProps {
  reference: Reference;
  variant?: ReferenceCardVariant;
  teaser?: string;
  meaningsCount?: number;
  /** e.g. which alias matched the search. */
  matchNote?: string;
  /** Type and year may still change (an online source hasn't answered yet). */
  pending?: boolean;
  /** Called when the card is opened (e.g. to record the search that led here). */
  onOpen?: () => void;
  /** Adds a heart that favourites the reference without opening it. */
  favourite?: ReferenceCardFavourite;
  /** Opened from this pack: the pack's spoiler ceiling applies on the reference page. */
  packId?: string;
}

/** Static card; entrance motion belongs to the list item or stage that hosts it. */
export function ReferenceCard({
  reference,
  variant = 'compact',
  teaser,
  meaningsCount,
  matchNote,
  pending = false,
  onOpen,
  favourite,
  packId,
}: ReferenceCardProps) {
  const works = fromWorks(reference);
  const card = (
    <Link
      to={`/references/${encodeURIComponent(reference.id)}`}
      className={classNames(styles.card, styles[variant], favourite && styles.hasFavourite)}
      // Compact cards take the shape of their type (ReferenceCard.module.css); not while it's checked.
      data-kind={pending ? undefined : reference.category}
      // Always set, so Back to a card opened elsewhere never falls back to the stored pack.
      state={{ packId: packId ?? null }}
      onClick={() => {
        // Opened from anywhere but a pack, the last pack's ceiling no longer applies.
        rememberOpenPack(packId);
        onOpen?.();
      }}
    >
      <span className={styles.meta}>
        {pending ? (
          <span className={styles.pending}>Checking type…</span>
        ) : (
          <>
            <span>{CATEGORY_LABEL[reference.category]}</span>
            {reference.year !== undefined ? (
              <span className={styles.era}>{reference.year}</span>
            ) : (
              reference.decade && <span className={styles.era}>{ERA_LABEL[reference.decade]}</span>
            )}
          </>
        )}
      </span>
      <span className={styles.title}>{reference.title}</span>
      {teaser && <span className={styles.teaser}>{teaser}</span>}
      {works.length > 0 && (
        // Plain text: the whole card is already a link, and links can't nest.
        <span className={styles.from}>From: {works.map((work) => work.label).join(', ')}</span>
      )}
      <span className={styles.footer}>
        {meaningsCount !== undefined && (
          <span>{meaningsCount === 1 ? '1 meaning' : `${meaningsCount} meanings`}</span>
        )}
        {matchNote && <span className={styles.matchNote}>{matchNote}</span>}
        {reference.editorialState === 'demo' && <span className={styles.badge}>Demo entry</span>}
        {reference.editorialState === 'source_curated' && (
          <span className={styles.badge}>Explained from sources</span>
        )}
        {reference.editorialState === 'retrieved' && (
          <span className={styles.badge}>Found online · unverified</span>
        )}
      </span>
    </Link>
  );
  // Always the same wrapper, so a heart arriving later (online results once saved) adds a button
  // instead of replacing the link: the card keeps its place and any keyboard focus.
  return (
    // `data-card`: the snap effect (motion/dissolve.ts) finds a card leaving a list by it.
    <div className={styles.wrapper} data-card={reference.id}>
      {card}
      {/* A sibling of the link, never inside it: a link can't contain a button. */}
      {favourite && (
        <div className={styles.favourite}>
          <FavouriteButton
            iconOnly
            label={`Favourite ${reference.title}`}
            isFavourite={favourite.isFavourite}
            onToggle={favourite.onToggle}
          />
        </div>
      )}
    </div>
  );
}
