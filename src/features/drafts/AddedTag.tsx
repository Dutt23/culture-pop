import styles from './YourCards.module.css';

interface AddedTagProps {
  /** `card`: one of your cards (accent). `own`: your own note or link (warm). */
  tone: 'card' | 'own';
  label: string;
  onRemove: () => void;
}

/** Something you added to the card maker, with × to take it out again (owner, 2026-11-22). */
export function AddedTag({ tone, label, onRemove }: AddedTagProps) {
  return (
    <span className={styles.tag} data-tone={tone}>
      {label}
      <button
        type="button"
        className={styles.remove}
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <span aria-hidden="true">×</span>
      </button>
    </span>
  );
}
