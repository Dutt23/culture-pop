/** The mascot peeks over the search bar on the first few searches of a day, then leaves you be. */
export const PEEKS_PER_DAY = 3;

/** One key holding `<local date>:<peeks used>`, so old days never pile up. */
export const PEEK_KEY = 'pcd:peeks';

function today(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Spends one of today's peeks. Blocked storage or a garbled count means no peek, rather than one
 * on every search.
 */
export function takePeek(now: Date = new Date()): boolean {
  try {
    const day = today(now);
    const [savedDay, savedUsed] = (localStorage.getItem(PEEK_KEY) ?? '').split(':');
    const used = savedDay === day ? Number(savedUsed) : 0;
    if (!Number.isFinite(used) || used >= PEEKS_PER_DAY) return false;
    localStorage.setItem(PEEK_KEY, `${day}:${used + 1}`);
    return true;
  } catch {
    return false;
  }
}
