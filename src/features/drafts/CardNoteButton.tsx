import type { ComponentPropsWithoutRef } from 'react';
import styles from './CardNoteButton.module.css';

type CardNoteButtonProps = Pick<
  ComponentPropsWithoutRef<'button'>,
  'aria-describedby' | 'children' | 'disabled' | 'onClick'
>;

export function CardNoteButton({
  children,
  folder = false,
  ...props
}: CardNoteButtonProps & { folder?: boolean }) {
  return (
    <button
      type="button"
      className={folder ? `${styles.note} ${styles.folder}` : styles.note}
      {...props}
    >
      <svg className={styles.cards} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3" />
        <rect x="3" y="8" width="13" height="12" rx="3" />
      </svg>
      <span className={styles.label}>{children}</span>
    </button>
  );
}
