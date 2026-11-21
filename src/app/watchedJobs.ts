/**
 * Card jobs the reader is watching right now inside Make a card: that card appears in front of
 * them, so the "card is ready" pop-up (CardReadyToast) stays quiet for it.
 */
const watched = new Set<string>();

/** Marks a job as watched; call the returned function when the reader stops watching it. */
export function watchJob(id: string): () => void {
  watched.add(id);
  return () => {
    watched.delete(id);
  };
}

export const isWatched = (id: string): boolean => watched.has(id);
