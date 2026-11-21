import { useCallback, useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { classNames } from './classNames';
import styles from './BusyButton.module.css';

/**
 * One pattern for every button that starts work (owner, 2026-11-21: "gray out the buttons if
 * something is in progress"). While `busy` it is greyed, says what it is doing (`busyLabel`, e.g.
 * "Signing out…"), shows a small spinner (still under reduced motion), and ignores clicks and
 * Enter-to-submit. It uses `aria-disabled`, not `disabled`, so keyboard focus stays on it.
 */
export interface BusyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy: boolean;
  busyLabel: string;
}

export function BusyButton({
  busy,
  busyLabel,
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: BusyButtonProps) {
  const click = (event: MouseEvent<HTMLButtonElement>) => {
    // Also stops a form submit (Enter in a text box clicks the submit button).
    if (busy) return event.preventDefault();
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={classNames(className, styles.busyButton)}
      aria-disabled={busy || rest['aria-disabled'] || undefined}
      aria-busy={busy}
      onClick={click}
    >
      {busy ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * `[busy, run]`: `run(work)` marks busy until `work` settles (success or error) and ignores a
 * second call while the first is still running, so a double tap does the work once.
 */
export function useBusy(): [boolean, <T>(work: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
