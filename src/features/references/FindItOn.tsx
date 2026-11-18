import { useId } from 'react';
import { ExternalLinks } from '../../components/ui/ExternalLinks';
import { cardSearchLinks } from '../../domain/externalSearch';
import type { Reference } from '../../domain/types';
import styles from './ReferencePage.module.css';

/** Three ways out for more, picked by the card's type. Hidden offline, when they can't open. */
export function FindItOn({ reference, isOnline }: { reference: Reference; isOnline: boolean }) {
  const labelId = useId();
  if (!isOnline) return null;
  return (
    <div role="group" aria-labelledby={labelId} className={styles.findItOn}>
      <p id={labelId} className={styles.findLabel}>
        Find it on
      </p>
      <ExternalLinks links={cardSearchLinks(reference)} />
      <p className={styles.note}>Opens outside the app. Nothing is sent until you tap.</p>
    </div>
  );
}
