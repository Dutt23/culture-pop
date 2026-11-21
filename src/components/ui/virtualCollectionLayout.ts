/**
 * Lists this short are drawn whole, exactly as before D69 (every reader today): only longer ones
 * draw just the rows near the screen.
 */
export const DRAW_ALL_UP_TO = 200;

/** Items per row: as many of `minPx` as fit with their gaps, at least one. */
export function columnsFor(width: number, minPx: number, gap: number): number {
  if (minPx <= 0 || width <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (minPx + gap)));
}
