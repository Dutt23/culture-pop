import { useEffect, useRef, useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { classNames } from '../../components/ui/classNames';
import type { Pack, Reference } from '../../domain/types';
import { PackChips } from './PackChips';
import styles from './Packs.module.css';
import { PackSheet } from './PackSheet';
import {
  acceptsCard,
  FROM_PACK_DRAG_TYPE,
  REFERENCE_DRAG_TYPE,
  useAttempt,
  type LeftCard,
} from './usePacks';

interface PackMemberItemProps {
  reference: Reference;
  packId: string;
  index: number;
  count: number;
  /** The other packs this card is filed in. */
  otherPacks: readonly Pack[];
  /** Fine pointers only: touch files and reorders with the buttons. */
  draggable: boolean;
  /** The card left this pack through the Move sheet. */
  onLeft: (left: LeftCard) => void;
}

/**
 * A card in the open pack, with Move, Up, Down and "I get this now". Every move files through
 * `fileCard`.
 */
export function PackMemberItem({
  reference,
  packId,
  index,
  count,
  otherPacks,
  draggable,
  onLeft,
}: PackMemberItemProps) {
  const { packs } = useRepositories();
  const { error, attempt } = useAttempt();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [over, setOver] = useState(false);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  // The card moves in the list; keep keyboard focus on the button that moved it.
  const refocus = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    refocus.current?.focus();
    refocus.current = null;
  }, [index]);

  const moveTo = (to: number, button: HTMLButtonElement | null) => {
    if (to < 0 || to >= count) return;
    refocus.current = button;
    void attempt(() => packs.fileCard(reference.id, packId, to));
  };

  const markDone = async () => {
    // The card leaves the list, buttons and all: the page heading takes focus instead.
    if (await attempt(() => packs.markDone(packId, reference.id))) {
      document.querySelector<HTMLElement>('#main h1')?.focus();
    }
  };

  return (
    <li
      className={classNames(styles.card, over && styles.dropOver)}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData(REFERENCE_DRAG_TYPE, reference.id);
        event.dataTransfer.setData(FROM_PACK_DRAG_TYPE, packId);
        event.dataTransfer.effectAllowed = 'copyMove';
      }}
      onDragOver={(event) => setOver(acceptsCard(event))}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        if (!acceptsCard(event)) return;
        // This row's place, not the end of the list around it.
        event.stopPropagation();
        const dropped = event.dataTransfer.getData(REFERENCE_DRAG_TYPE);
        void attempt(() => packs.fileCard(dropped, packId, index));
      }}
    >
      <ReferenceCard reference={reference} packId={packId} />
      <PackChips label="Also in:" packs={otherPacks} />
      <div role="group" aria-label={reference.title} className={styles.row}>
        <button
          type="button"
          className={styles.button}
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}
        >
          Move
        </button>
        {/* aria-disabled, not disabled: the button keeps focus when the card reaches an end. */}
        <button
          ref={upRef}
          type="button"
          className={styles.button}
          aria-disabled={index === 0}
          onClick={() => moveTo(index - 1, upRef.current)}
        >
          Up
        </button>
        <button
          ref={downRef}
          type="button"
          className={styles.button}
          aria-disabled={index === count - 1}
          onClick={() => moveTo(index + 1, downRef.current)}
        >
          Down
        </button>
        <button type="button" className={styles.button} onClick={() => void markDone()}>
          I get this now
        </button>
      </div>
      {sheetOpen && (
        <PackSheet
          referenceId={reference.id}
          title={reference.title}
          fromPackId={packId}
          onLeft={(movedTo) =>
            onLeft({ referenceId: reference.id, title: reference.title, index, movedTo })
          }
          onClose={() => setSheetOpen(false)}
        />
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
