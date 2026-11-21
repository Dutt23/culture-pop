/**
 * Counts attempts per key in a fixed one-minute window.
 * shortcut: per server instance, so parallel instances each allow their own quota; Supabase Auth's
 * own rate limits and the Vercel Firewall are the shared brakes. Upgrade to a database counter if
 * abuse gets past them.
 */
const MAX_KEYS = 10_000;

export function createRateLimit(
  maxPerWindow: number,
  windowMs: number,
  now: () => number = Date.now,
): (key: string) => boolean {
  let windowStart = 0;
  const counts = new Map<string, number>();
  return function allow(key) {
    if (now() - windowStart >= windowMs) {
      windowStart = now();
      counts.clear();
    }
    // Full: refuse new keys until the window ends, rather than wiping everyone's count.
    if (!counts.has(key) && counts.size >= MAX_KEYS) return false;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return count <= maxPerWindow;
  };
}
