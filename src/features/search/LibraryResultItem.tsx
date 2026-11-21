import { memo } from 'react';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import type { Reference } from '../../domain/types';

interface LibraryResultItemProps {
  reference: Reference;
  index: number;
  teaser?: string;
  meaningsCount?: number;
  matchNote?: string;
  isFavourite: boolean;
  /** Stable across key presses, so a card that stays on screen isn't drawn again. */
  onOpen: (referenceId: string) => void;
  onToggleFavourite: (referenceId: string) => void;
}

/** One library result in Search; redrawn only when something it shows changes. */
export const LibraryResultItem = memo(function LibraryResultItem({
  reference,
  index,
  teaser,
  meaningsCount,
  matchNote,
  isFavourite,
  onOpen,
  onToggleFavourite,
}: LibraryResultItemProps) {
  return (
    <AnimatedItem index={index}>
      <ReferenceCard
        reference={reference}
        teaser={teaser}
        meaningsCount={meaningsCount}
        matchNote={matchNote}
        onOpen={() => onOpen(reference.id)}
        favourite={{ isFavourite, onToggle: () => onToggleFavourite(reference.id) }}
      />
    </AnimatedItem>
  );
});
