import type { CSSProperties } from 'react';
import type { ToneCard } from '../../../api/_lib/cardTypes.js';

/**
 * A kept card's name in lists and filters. A major spoiler hidden by the reader's setting shows
 * its search instead, since the AI label can give the ending away.
 */
export function keptName(
  card: { label: string; spoiler: string },
  search: string,
  reveal: boolean,
): string {
  return card.spoiler === 'major' && !reveal ? `${search.trim()} (spoiler)` : card.label;
}

/** The film's colour with no filter picked. */
export const UNGRADED = '#b6aed6';
const FILTER_COLOURS = ['#ffb27a', '#7fd6c2', '#f48fb1', '#b29bff', '#ffd166'];

/** A tone card's filter colour: the same card always gets the same colour. */
export function filterColour(label: string): string {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return FILTER_COLOURS[hash % FILTER_COLOURS.length];
}

/** `--grade-1` / `--grade-2` for the flow's root: none → ungraded, one → both, two → each. */
export function gradeOf(tones: readonly Pick<ToneCard, 'label'>[]): CSSProperties {
  const [a, b] = tones.map((t) => filterColour(t.label));
  const g1 = a ?? UNGRADED;
  return { '--grade-1': g1, '--grade-2': b ?? g1 } as CSSProperties;
}

/** What the tray says when a pick would go over a limit (keyed by the tray hook's results). */
export const LIMIT_HINTS = {
  limit_total: 'A card takes up to 6 frames.',
  limit_web: 'Up to 3 web frames per card.',
  limit: 'Up to 2 colour filters.',
} as const;
