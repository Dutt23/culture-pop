import styles from './UndoNotice.module.css';

interface UndoNoticeProps {
  message: string;
  onUndo: () => void;
}

/** "Removed … Undo", shown for a few seconds after a card leaves a list. */
export function UndoNotice({ message, onUndo }: UndoNoticeProps) {
  return (
    <p className={styles.notice} role="status">
      {message}{' '}
      <button type="button" className={styles.undo} onClick={onUndo}>
        Undo
      </button>
    </p>
  );
}
