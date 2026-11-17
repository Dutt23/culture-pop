import { useEffect, useRef, useState } from 'react';
import { takePeek } from './peekBudget';

/** How the search is going: still looking, something on screen, or nothing found. */
export type PeekOutcome = 'pending' | 'found' | 'none';
export type PeekPhase = 'hidden' | 'watching' | 'pointing';

const MIN_LETTERS = 2;
/** Results change with every keystroke; the mascot points once typing pauses this long. */
export const SETTLE_MS = 600;
export const POINT_MS = 1200;
/** However the search goes, the mascot never stays up longer than this. */
export const MAX_UP_MS = 4000;

/**
 * The mascot's short visit over the search bar: up once a search has two letters, pointing when
 * typing pauses on a result, then gone. Once per search, and only while today's peeks last.
 */
export function usePeek(query: string, outcome: PeekOutcome, enabled: boolean): PeekPhase {
  const [phase, setPhase] = useState<PeekPhase>('hidden');
  const letters = query.trim().length;
  const searching = letters >= MIN_LETTERS;
  const cleared = letters === 0;
  const peeked = useRef(false);

  // A search starts at two letters and ends when the box is cleared, so fixing a typo doesn't spend
  // another peek. A search that starts while the peek is off (a tour, reduced motion) doesn't get a
  // late one.
  useEffect(() => {
    if (cleared) peeked.current = false;
    if (!searching) {
      setPhase('hidden');
      return;
    }
    if (!enabled) {
      peeked.current = true;
      setPhase('hidden');
      return;
    }
    if (peeked.current) return;
    peeked.current = true;
    if (takePeek()) setPhase('watching');
  }, [searching, cleared, enabled]);

  // Each keystroke restarts the wait, so it points at what's there when typing stops.
  useEffect(() => {
    if (phase !== 'watching' || outcome === 'pending') return;
    const timer = setTimeout(
      () => setPhase(outcome === 'found' ? 'pointing' : 'hidden'),
      SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, outcome, query]);

  useEffect(() => {
    if (phase !== 'pointing') return;
    const timer = setTimeout(() => setPhase('hidden'), POINT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const up = phase !== 'hidden';
  useEffect(() => {
    if (!up) return;
    const timer = setTimeout(() => setPhase('hidden'), MAX_UP_MS);
    return () => clearTimeout(timer);
  }, [up]);

  return phase;
}
