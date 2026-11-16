import { Link } from 'react-router';
import { CATEGORY_LABEL, ERA_LABEL, fromWorks } from '../../domain/labels';
import type { Reference } from '../../domain/types';
import { classNames } from '../ui/classNames';
import styles from './ReferenceCard.module.css';

export type ReferenceCardVariant = 'compact' | 'feature';

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
}: ReferenceCardProps) {
  const works = fromWorks(reference);
  return (
    <Link
      to={`/references/${encodeURIComponent(reference.id)}`}
      className={classNames(styles.card, styles[variant])}
      onClick={onOpen}
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
}
