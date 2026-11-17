/** The pack a card was last opened from, kept per tab so a refresh keeps its spoiler ceiling. */
export const OPEN_PACK_KEY = 'culture-pop:open-pack';

/** Remembers the pack a card is opened from; a card opened from anywhere else forgets it. */
export function rememberOpenPack(packId: string | undefined): void {
  try {
    if (packId) sessionStorage.setItem(OPEN_PACK_KEY, packId);
    else sessionStorage.removeItem(OPEN_PACK_KEY);
  } catch {
    // Storage blocked: the router state still carries the pack for this visit.
  }
}

export function readOpenPack(): string | null {
  try {
    return sessionStorage.getItem(OPEN_PACK_KEY);
  } catch {
    return null;
  }
}
