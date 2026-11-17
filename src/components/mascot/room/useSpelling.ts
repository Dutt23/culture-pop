import { useEffect, useState } from 'react';

/** Now and then the Stranger Things lights spell a word, one letter at a time. */
const WORDS = ['DECODE', 'RUN', 'HI'];
export const FIRST_WORD_MS = 3000;
const WORD_EVERY_MS = 12000;
export const LETTER_MS = 700;
const LAST_LETTER_HOLD_MS = 500;

/** The letter lit right now, or null while the bulbs just twinkle. Off when `still`. */
export function useSpelling(still: boolean): string | null {
  const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    if (still) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let word = 0;
    const spell = () => {
      timers.length = 0;
      const [firstLetter, ...rest] = [...WORDS[word++ % WORDS.length]];
      setLit(firstLetter);
      rest.forEach((letter, i) =>
        timers.push(setTimeout(() => setLit(letter), (i + 1) * LETTER_MS)),
      );
      const letters = [firstLetter, ...rest];
      timers.push(setTimeout(() => setLit(null), letters.length * LETTER_MS + LAST_LETTER_HOLD_MS));
    };
    const first = setTimeout(spell, FIRST_WORD_MS);
    const every = setInterval(spell, WORD_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      timers.forEach((timer) => clearTimeout(timer));
      setLit(null);
    };
  }, [still]);
  return lit;
}
