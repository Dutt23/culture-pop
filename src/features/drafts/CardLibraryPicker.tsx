import { useId, useState } from 'react';
import type { ToneCard } from '../../../shared/cardTypes';
import { normalizePhrase } from '../../domain/normalize';
import type { Frame } from './frames';
import styles from './CardLibraryPicker.module.css';

export interface LibraryPickerCard {
  id: string;
  /** The caller supplies spoiler-safe text for both display and search. */
  title: string;
  description: string;
  frame?: Frame;
  tone?: ToneCard;
}

interface CardLibraryPickerProps {
  cards: readonly LibraryPickerCard[];
  mode: 'source' | 'style';
  /** Card ids for sources, tone labels for style examples. */
  selected: readonly string[];
  onSelect: (card: LibraryPickerCard) => void;
}

export function CardLibraryPicker({ cards, mode, selected, onSelect }: CardLibraryPickerProps) {
  const [query, setQuery] = useState('');
  const headingId = useId();
  const inputId = useId();
  const hintId = useId();
  const source = mode === 'source';
  const available = cards.filter((card) => (source ? card.frame : card.tone));
  const words = normalizePhrase(query).split(' ').filter(Boolean);
  const matches = available.filter((card) => {
    const text = normalizePhrase(`${card.title} ${card.description}`);
    return words.every((word) => text.includes(word));
  });

  return (
    <section className={styles.picker} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        {source ? 'Add saved cards as sources' : 'Choose saved cards as style examples'}
      </h3>
      <p id={hintId} className={styles.hint}>
        {source
          ? 'Selected cards contribute facts to your new card.'
          : 'Selected cards guide tone and structure. Their facts stay in their own cards.'}
      </p>
      <label htmlFor={inputId}>Search saved cards</label>
      <input
        id={inputId}
        type="search"
        className={styles.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-describedby={hintId}
      />
      <p className={styles.hint} role="status">
        {available.length === 0
          ? 'Save a favourite or keep a draft to choose it here.'
          : matches.length === 0
            ? 'No saved cards match. Try another title or clear your search.'
            : `${matches.length} saved ${matches.length === 1 ? 'card' : 'cards'}`}
      </p>
      {matches.length > 0 && (
        <ul className={styles.cards}>
          {matches.map((card) => {
            const key = source ? card.id : card.tone!.label;
            return (
              <li key={card.id}>
                <button
                  type="button"
                  className={styles.card}
                  aria-label={card.title}
                  aria-pressed={selected.includes(key)}
                  onClick={() => onSelect(card)}
                >
                  <strong>{card.title}</strong>
                  <span className={styles.description}>{card.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
