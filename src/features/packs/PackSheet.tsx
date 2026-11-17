import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { cardElement } from '../../motion/cardElement';
import { dissolve } from '../../motion/dissolve';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './Packs.module.css';
import { useAttempt, usePacksOf } from './usePacks';

interface PackSheetProps {
  referenceId: string;
  title: string;
  /** Opened on a card inside this pack: a tap moves it out, and "Remove from this pack" shows. */
  fromPackId?: string;
  /** The card left this pack (removed, or moved to `movedTo`). */
  onLeft?: (movedTo?: { id: string; name: string }) => void;
  onClose: () => void;
}

/**
 * The one way to file a card that works everywhere (touch, keyboard, mouse): tap a pack name to
 * file the card at the end of it, or, opened from a pack, to move it there. Packs the card is
 * already in are listed but can't be tapped.
 */
export function PackSheet({ referenceId, title, fromPackId, onLeft, onClose }: PackSheetProps) {
  const { packs } = useRepositories();
  const list = useLiveQuery(() => packs.list(), [packs]);
  const filedIn = usePacksOf(referenceId);
  const { error, attempt } = useAttempt();
  const { reduced } = useMotionPresets();
  const headingId = useId();
  const sheetRef = useRef<HTMLElement>(null);

  // Set false when focus has already been placed elsewhere.
  const returnFocus = useRef(true);

  // Focus moves into the sheet, and back to whatever opened it once it closes.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shouldReturn = returnFocus;
    sheetRef.current?.focus();
    return () => {
      if (shouldReturn.current && opener?.isConnected) opener.focus();
    };
  }, []);

  const filed = new Set((filedIn ?? []).map((pack) => pack.id));
  const run = async (action: () => Promise<unknown>) => {
    if (await attempt(action)) onClose();
  };
  // The card crumbles out of this pack's list, Move button and all: the page heading takes focus.
  const leave = async (action: () => Promise<unknown>, movedTo?: { id: string; name: string }) => {
    const dust = dissolve(cardElement(sheetRef.current?.closest('li'), referenceId), reduced);
    if (!(await attempt(action))) {
      dust.restore();
      return;
    }
    returnFocus.current = false;
    document.querySelector<HTMLElement>('#main h1')?.focus();
    onLeft?.(movedTo);
    onClose();
  };
  const fileIn = (packId: string) => () =>
    packs.fileCard(referenceId, packId, Infinity, fromPackId);

  return (
    <section
      ref={sheetRef}
      role="dialog"
      aria-labelledby={headingId}
      tabIndex={-1}
      className={styles.sheet}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Handled: an open tour leaves this Escape alone.
        event.preventDefault();
        onClose();
      }}
    >
      <h3 id={headingId} className={styles.sheetTitle}>
        {fromPackId ? `Move “${title}” to another pack` : `File “${title}” in a pack`}
      </h3>
      {list && list.length === 0 && (
        <p className={styles.muted}>
          No packs yet. <Link to="/packs">Make one</Link>
        </p>
      )}
      {list && list.length > 0 && (
        <ul className={styles.sheetList}>
          {list.map((pack) => (
            <li key={pack.id}>
              {/* Already filed there: tapping would only move it to the end, so it's off. */}
              <button
                type="button"
                className={styles.sheetButton}
                disabled={filed.has(pack.id)}
                onClick={() =>
                  void (fromPackId
                    ? leave(fileIn(pack.id), { id: pack.id, name: pack.name })
                    : run(fileIn(pack.id)))
                }
              >
                {pack.name}
                {filed.has(pack.id) && <span className={styles.muted}> · Filed here</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.row}>
        {fromPackId && (
          <button
            type="button"
            className={styles.button}
            onClick={() => void leave(() => packs.removeMember(fromPackId, referenceId))}
          >
            Remove from this pack
          </button>
        )}
        <button type="button" className={styles.button} onClick={onClose}>
          Cancel
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
