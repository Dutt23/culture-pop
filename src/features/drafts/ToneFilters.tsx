import type { RefObject } from 'react';
import type { ToneCard } from '../../../shared/cardTypes.js';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { filterColour } from './curationLook';
import { flyToReel, spinReel } from './flyToReel';
import styles from './FilmStrip.module.css';

interface ToneFiltersProps {
  cards: readonly ToneCard[];
  picked: readonly ToneCard[];
  /** The tray hook's `toggleTone`: 'added' flies the lens to the reel, 'removed' winds it back. */
  onToggle: (card: ToneCard) => string;
  reelRef?: RefObject<Element | null>;
}

/** Tone cards as colour filters (lenses) that grade the film. */
export function ToneFilters({ cards, picked, onToggle, reelRef }: ToneFiltersProps) {
  const { reduced } = useMotionPresets();

  const toggle = (card: ToneCard, lens: Element | null) => {
    const result = onToggle(card);
    if (reduced || !lens) return;
    const reel = reelRef?.current ?? null;
    if (result === 'added') {
      flyToReel(lens, reel, { round: true, colour: filterColour(card.label) });
    }
    if (result === 'removed') spinReel(reel, -180);
  };

  return (
    <div
      className={reduced ? `${styles.filters} ${styles.still}` : styles.filters}
      data-scene="night"
    >
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          className={styles.filter}
          aria-pressed={picked.some((t) => t.label === card.label)}
          onClick={(e) => toggle(card, e.currentTarget.firstElementChild)}
        >
          <span
            className={styles.lens}
            style={{ background: filterColour(card.label) }}
            aria-hidden="true"
          />
          {card.label}
        </button>
      ))}
    </div>
  );
}
