import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useRepositories } from '../../app/useRepositories';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { classNames } from '../../components/ui/classNames';
import type { Pack, Reference } from '../../domain/types';
import { cardElement } from '../../motion/cardElement';
import { dissolve } from '../../motion/dissolve';
import { useMotionPresets } from '../../motion/useMotionPresets';
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
 * A card in the open pack. "Got it" folds it into "Cards you've got"; "More" opens the tidying:
 * up or down the list, or to another pack. Every move files through `fileCard`.
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
  const { reduced } = useMotionPresets();
  const itemRef = useRef<HTMLLIElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [over, setOver] = useState(false);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const moveRef = useRef<HTMLButtonElement>(null);
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
    // The card crumbles out of the list, buttons and all: the page heading takes focus instead.
    // "Put back" in "Cards you've got" is its undo.
    const dust = dissolve(cardElement(itemRef.current, reference.id), reduced);
    if (await attempt(() => packs.markDone(packId, reference.id))) {
      document.querySelector<HTMLElement>('#main h1')?.focus();
    } else {
      dust.restore();
    }
  };

  return (
    <li
      ref={itemRef}
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
        <button type="button" className={styles.button} onClick={() => void markDone()}>
          <span aria-hidden="true">✓ </span>Got it
        </button>
        <button
          type="button"
          className={styles.button}
          aria-expanded={moreOpen}
          onClick={() => {
            setMoreOpen((open) => !open);
            setSheetOpen(false);
          }}
        >
          <span aria-hidden="true">⋯ </span>More
        </button>
      </div>
      {moreOpen && (
        <div role="group" aria-label={`Arrange ${reference.title}`} className={styles.row}>
          {/* aria-disabled, not disabled: the button keeps focus when the card reaches an end. */}
          <button
            ref={upRef}
            type="button"
            className={styles.button}
            aria-disabled={index === 0}
            onClick={() => moveTo(index - 1, upRef.current)}
          >
            <span aria-hidden="true">↑ </span>Move up the list
          </button>
          <button
            ref={downRef}
            type="button"
            className={styles.button}
            aria-disabled={index === count - 1}
            onClick={() => moveTo(index + 1, downRef.current)}
          >
            <span aria-hidden="true">↓ </span>Move down the list
          </button>
          <button
            ref={moveRef}
            type="button"
            className={styles.button}
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((open) => !open)}
          >
            Move to another pack
          </button>
        </div>
      )}
      <AnimatePresence>
        {sheetOpen && (
          <PackSheet
            key="sheet"
            referenceId={reference.id}
            title={reference.title}
            fromPackId={packId}
            opener={moveRef}
            onLeft={(movedTo) =>
              onLeft({ referenceId: reference.id, title: reference.title, index, movedTo })
            }
            onClose={() => setSheetOpen(false)}
          />
        )}
      </AnimatePresence>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
