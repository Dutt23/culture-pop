import { useRef } from 'react';
import { useRepositories } from '../../app/useRepositories';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import type { Reference } from '../../domain/types';
import styles from './Packs.module.css';
import { useAttempt } from './usePacks';

interface PackDoneListProps {
  packId: string;
  /** Cards marked "Got it". */
  cards: readonly Reference[];
}

const TITLE = "Cards you've got";

/** Done cards, folded away: still filed, and one tap from going back. Deliberately no count. */
export function PackDoneList({ packId, cards }: PackDoneListProps) {
  const { packs } = useRepositories();
  const { error, attempt } = useAttempt();
  const summaryRef = useRef<HTMLElement>(null);
  if (cards.length === 0) return null;

  const putBack = async (referenceId: string) => {
    if (!(await attempt(() => packs.fileCard(referenceId, packId, Infinity)))) return;
    // The card leaves this list, button and all: focus stays on the list while it has cards left,
    // and goes to the page heading once the list is gone.
    const target = cards.length > 1 ? summaryRef.current : null;
    (target ?? document.querySelector<HTMLElement>('#main h1'))?.focus();
  };

  return (
    <details className={styles.done}>
      <summary ref={summaryRef} className={styles.doneSummary}>
        {TITLE}
      </summary>
      <ul className={styles.list} aria-label={TITLE}>
        {cards.map((reference) => (
          <li key={reference.id} className={styles.card}>
            <ReferenceCard reference={reference} packId={packId} />
            <div className={styles.row}>
              <button
                type="button"
                className={styles.button}
                aria-label={`Put back ${reference.title}`}
                onClick={() => void putBack(reference.id)}
              >
                Put back
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
