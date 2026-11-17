import { useEffect, useId, useRef, useState } from 'react';
import styles from './UndoNotice.module.css';

/** How long "Undo" stays once nothing holds it open. */
const UNDO_MS = 8000;

interface UndoNoticeProps {
  message: string;
  onUndo: () => void;
  /** Time's up: the notice should go. */
  onExpire: () => void;
}

/**
 * "Removed … Undo", shown for a few seconds after a card leaves a list. When focus left with the
 * card, it moves to Undo; while focus stays there, the notice does too.
 */
export function UndoNotice({ message, onUndo, onExpire }: UndoNoticeProps) {
  const messageId = useId();
  const undoRef = useRef<HTMLButtonElement>(null);
  const expireRef = useRef(onExpire);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    // Only focus that was lost: a page that already moved it (to its heading) keeps its choice.
    if (document.activeElement && document.activeElement !== document.body) return;
    // Fixed above the navigation, so taking focus never scrolls the page.
    undoRef.current?.focus({ preventScroll: true });
  }, [message]);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => expireRef.current(), UNDO_MS);
    return () => clearTimeout(timer);
  }, [held, message]);

  return (
    <p
      className={styles.notice}
      role="status"
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        // Switching apps blurs too, and focus comes back to Undo: keep holding.
        if (!document.hasFocus()) return;
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <span id={messageId}>{message}</span>
      <button
        ref={undoRef}
        type="button"
        className={styles.undo}
        aria-describedby={messageId}
        onClick={() => {
          // The notice goes with the click: the page heading takes focus, as when a card leaves.
          document.querySelector<HTMLElement>('#main h1')?.focus();
          onUndo();
        }}
      >
        Undo
      </button>
    </p>
  );
}
