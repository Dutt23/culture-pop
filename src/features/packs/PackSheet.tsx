import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { useRepositories } from '../../app/useRepositories';
import { BusyButton } from '../../components/ui/BusyButton';
import { useBusy } from '../../components/ui/useBusy';
import { SideTray } from '../../components/ui/SideTray';
import { cardElement } from '../../motion/cardElement';
import { dissolve } from '../../motion/dissolve';
import { useMotionPresets } from '../../motion/useMotionPresets';
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
  /** The button that opened it: gets focus back when the tray closes. */
  opener: RefObject<HTMLElement | null>;
}

/**
 * The one way to file a card that works everywhere (touch, keyboard, mouse): tap a pack name to
 * file the card at the end of it, or, opened from a pack, to move it there. Packs the card is
 * already in are listed but can't be tapped. It is a `SideTray` (the mascot carries it in), so the
 * parent renders it inside <AnimatePresence>.
 */
export function PackSheet({
  referenceId,
  title,
  fromPackId,
  onLeft,
  onClose,
  opener,
}: PackSheetProps) {
  const { packs } = useRepositories();
  const list = useLiveQuery(() => packs.list(), [packs]);
  const filedIn = usePacksOf(referenceId);
  const { error, attempt } = useAttempt();
  const { reduced } = useMotionPresets();
  const [busy, runBusy] = useBusy();
  // Which button started the work, so only that one shows the spinner.
  const [doing, setDoing] = useState('');

  // Focus goes back here on close: the opener, or the page heading once the card has left.
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnTo.current = opener.current;
  }, [opener]);

  const filed = new Set((filedIn ?? []).map((pack) => pack.id));
  const run = async (action: () => Promise<unknown>) => {
    if (await attempt(action)) onClose();
  };
  // The card crumbles out of this pack's list, Move button and all: the page heading takes focus.
  const leave = async (action: () => Promise<unknown>, movedTo?: { id: string; name: string }) => {
    const dust = dissolve(cardElement(opener.current?.closest('li'), referenceId), reduced);
    if (!(await attempt(action))) {
      dust.restore();
      return;
    }
    returnTo.current = document.querySelector<HTMLElement>('#main h1');
    onLeft?.(movedTo);
    onClose();
  };
  const start = (key: string, work: () => Promise<void>) => {
    if (busy) return;
    setDoing(key);
    void runBusy(work);
  };
  const fileIn = (packId: string) => () =>
    packs.fileCard(referenceId, packId, Infinity, fromPackId);

  return (
    <SideTray
      look="carried"
      // Titles often carry their own quote marks, so none are added around them.
      title={fromPackId ? `Move ${title} to another pack` : `File ${title} in a pack`}
      opener={returnTo}
      onClose={onClose}
      // A request is still running: closing now would hide its result.
      stayOpen={busy}
      footer={
        (fromPackId || error) && (
          <>
            {fromPackId && (
              <BusyButton
                busy={busy && doing === 'remove'}
                busyLabel="Removing…"
                aria-disabled={busy || undefined}
                className={styles.button}
                onClick={() =>
                  start('remove', () => leave(() => packs.removeMember(fromPackId, referenceId)))
                }
              >
                Remove from this pack
              </BusyButton>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </>
        )
      }
    >
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
              <BusyButton
                busy={busy && doing === pack.id}
                busyLabel="Filing…"
                className={styles.sheetButton}
                disabled={filed.has(pack.id)}
                aria-disabled={busy || undefined}
                onClick={() =>
                  start(pack.id, () =>
                    fromPackId
                      ? leave(fileIn(pack.id), { id: pack.id, name: pack.name })
                      : run(fileIn(pack.id)),
                  )
                }
              >
                {pack.name}
                {filed.has(pack.id) && <span className={styles.muted}> · Filed here</span>}
              </BusyButton>
            </li>
          ))}
        </ul>
      )}
    </SideTray>
  );
}
