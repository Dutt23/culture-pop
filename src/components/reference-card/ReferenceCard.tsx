import { Link } from 'react-router';
import { CATEGORY_LABEL, ERA_LABEL } from '../../domain/labels';
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
}

/** Static card; entrance motion belongs to the list item or stage that hosts it. */
export function ReferenceCard({
  reference,
  variant = 'compact',
  teaser,
  meaningsCount,
  matchNote,
}: ReferenceCardProps) {
  return (
    <Link
      to={`/references/${encodeURIComponent(reference.id)}`}
      className={classNames(styles.card, styles[variant])}
    >
      <span className={styles.meta}>
        <span>{CATEGORY_LABEL[reference.category]}</span>
        {reference.decade && <span className={styles.era}>{ERA_LABEL[reference.decade]}</span>}
      </span>
      <span className={styles.title}>{reference.title}</span>
      {teaser && <span className={styles.teaser}>{teaser}</span>}
      <span className={styles.footer}>
        {meaningsCount !== undefined && (
          <span>{meaningsCount === 1 ? '1 meaning' : `${meaningsCount} meanings`}</span>
        )}
        {matchNote && <span className={styles.matchNote}>{matchNote}</span>}
        {reference.editorialState === 'demo' && <span className={styles.demo}>Demo entry</span>}
      </span>
    </Link>
  );
}
