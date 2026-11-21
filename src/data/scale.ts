/**
 * EXPERIMENTAL (D69): the large-library mode. Above these sizes the app switches to paths no reader
 * uses yet (library ranked in a web worker, indexed reads instead of whole-table reads). Measured
 * on a slowed laptop, not yet used by real readers. Set to false to keep every reader on the
 * small-library paths, which is exactly the behaviour before D69.
 */
export const LARGE_LIBRARY_MODE = true;

/**
 * Libraries up to this many cards are handled exactly as before D69 (every reader today): read
 * whole and ranked on the main thread. Bigger ones are read by index and ranked in the search
 * worker (measured: 3.6 s per key at 10,000 cards on a 4× slower processor before D69).
 */
export const WORKER_FROM_CARDS = 1000;

/** Favourites up to this many are read whole, as before D69; beyond, only the ones on screen. */
export const ALL_FAVOURITES_UP_TO = 1000;

/**
 * Filed cards (pack member rows) up to this many are read whole for the Packs list, as before.
 * Beyond, the list reads only packs and per-pack counts; every member row, filed card and alias is
 * read only while the reader searches (measured: Packs frozen 0.4 s at 10,000 filed cards and
 * 2.9 s at 100,000 on a 4× slower processor before this).
 */
export const ALL_PACK_MEMBERS_UP_TO = 1000;

/** Whether a table of this size uses the experimental large-library paths. */
export function isLarge(size: number, limit: number): boolean {
  return LARGE_LIBRARY_MODE && size > limit;
}

const KEY = 'pcd:sizes';
type Table = 'references' | 'favourites' | 'packMembers';

function stored(): Partial<Record<Table, number>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<Table, number>>;
  } catch {
    return {};
  }
}

/**
 * Whether this table was big last time it was counted. A read can then go straight to the right
 * path in one round trip, counting alongside instead of first: a small library pays nothing extra
 * (D69). Unknown (first run, private mode) counts as small, which is the cheap guess for new readers.
 */
export function wasLarge(table: Table, limit: number): boolean {
  return isLarge(stored()[table] ?? 0, limit);
}

/** Notes a fresh count for next time. */
export function rememberSize(table: Table, size: number): void {
  try {
    const sizes = stored();
    if (sizes[table] === size) return;
    localStorage.setItem(KEY, JSON.stringify({ ...sizes, [table]: size }));
  } catch {
    // Storage off: every read simply guesses "small", as on a first run.
  }
}
