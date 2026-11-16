import { doubleMetaphone } from 'double-metaphone';
import { normalizePhrase, tokenize } from './normalize';

/**
 * Search history (D37): a two-tier list kept only on this device. Every function here is pure and
 * takes `now` (epoch ms), so the rules are testable without clocks or storage.
 *
 * - Recent: new searches, least recently used evicted first.
 * - Frequent: searches that came back, ranked by a decayed frequency score; when full, the weakest
 *   is demoted to Recent rather than deleted.
 */
export type HistoryTier = 'recent' | 'frequent';

export interface SearchSpelling {
  /** As typed (trimmed, single spaces). */
  text: string;
  count: number;
  lastUsedAt: number;
}

export interface HistoryEntry {
  id: string;
  tier: HistoryTier;
  /** The spelling used most (ties go to the latest). This is what chips show. */
  label: string;
  spellings: SearchSpelling[];
  /** References opened from this search (kept for later use; never a reason to merge entries). */
  referenceIds: string[];
  count: number;
  /** Distinct days (UTC) with a counted search. */
  days: number;
  lastDay: number;
  lastSearchedAt: number;
  /**
   * Time-invariant frecency: log(Σ e^(λ·tᵢ)) over counted searches, t in days. The decayed weight at
   * time T is e^(score − λ·T), so ordering by `score` is ordering by weight at any T, and an index
   * on it gives top-k and the next eviction without recomputing anything.
   */
  score: number;
}

export interface HistorySearch {
  text: string;
  /** Set when the user opened a result from this search. */
  referenceId?: string;
}

export interface HistoryLimits {
  recent: number;
  frequent: number;
}

export interface HistoryChanges {
  put: HistoryEntry[];
  remove: string[];
}

const HISTORY_LIMITS: Readonly<HistoryLimits> = { recent: 50, frequent: 150 };

const DAY_MS = 24 * 60 * 60 * 1000;
export const HISTORY_TTL_MS = 90 * DAY_MS;
// A 30-day half-life: by the 90-day expiry an untouched search weighs 1/8 of a fresh one.
const DECAY_PER_DAY = Math.LN2 / 30;
// Submit then open, or Enter pressed twice, is one search, not two.
const REPEAT_WINDOW_MS = 30 * 60 * 1000;
// Two searches on different days show a habit; on one day it takes three (two is often a retype).
const SAME_DAY_PROMOTION = 3;

const NO_CHANGES: HistoryChanges = { put: [], remove: [] };

export function isExpired(entry: HistoryEntry, now: number): boolean {
  return now - entry.lastSearchedAt > HISTORY_TTL_MS;
}

/** Records one search (form submit, or a result opened) and returns the rows to write and delete. */
export function recordSearch(
  entries: readonly HistoryEntry[],
  search: HistorySearch,
  now: number,
  limits: HistoryLimits = HISTORY_LIMITS,
): HistoryChanges {
  const text = search.text.trim().replace(/\s+/g, ' ');
  const normalized = normalizePhrase(text);
  if (!normalized) return NO_CHANGES;

  const expired = entries.filter((e) => isExpired(e, now));
  const live = entries.filter((e) => !isExpired(e, now));
  const byText =
    live.find((e) => e.spellings.some((s) => normalizePhrase(s.text) === normalized)) ??
    live.find((e) => e.spellings.some((s) => soundsAlike(normalizePhrase(s.text), normalized)));
  // Opening the same result never merges different searches on its own: "red pill" and "the matrix"
  // can both open The Matrix, and one phrase can mean different things in different contexts.
  const { referenceId } = search;
  const touched = promote(
    byText
      ? addSearch(byText, text, referenceId, now)
      : newEntry(text, normalized, referenceId, now),
  );

  const others = live.filter((e) => e.id !== touched.id);
  const { kept, evicted } = enforceLimits([...others, touched], limits);
  const unchanged = new Set(live);
  return {
    put: kept.filter((e) => !unchanged.has(e)),
    remove: [...expired.map((e) => e.id), ...evicted],
  };
}

/**
 * Merge rule (b), on normalized text: same Double Metaphone key with up to 2 typed edits
 * ("cash me outside" ~ "catch me outside"), or keys 1 edit apart with 1 typed edit
 * ("point breakz" ~ "point break"). Word order counts ("break point" stays apart), digits must
 * match (metaphone ignores them: "rocky 2" vs "rocky 3"), and only Latin text is compared.
 */
export function soundsAlike(a: string, b: string): boolean {
  if (a === b) return true;
  if (!LATIN.test(a) || !LATIN.test(b)) return false;
  if (tokenize(a).length !== tokenize(b).length) return false;
  if (a.replace(/\D/g, '') !== b.replace(/\D/g, '')) return false;
  const typed = editDistance(a, b);
  // Short words can't take as many edits: "cat" and "hat" are different searches.
  if (typed > Math.max(a.length, b.length) / 4) return false;
  const [primaryA, secondaryA] = phoneticKeys(a);
  const [primaryB, secondaryB] = phoneticKeys(b);
  const keys = Math.min(editDistance(primaryA, primaryB), editDistance(secondaryA, secondaryB));
  return keys === 0 ? typed <= 2 : keys <= 1 && typed <= 1;
}

const LATIN = /^[a-z0-9 ]+$/;

function phoneticKeys(normalized: string): [string, string] {
  const codes = tokenize(normalized).map((word) => doubleMetaphone(word));
  return [codes.map((c) => c[0]).join(' '), codes.map((c) => c[1]).join(' ')];
}

/** Levenshtein distance; inputs are short search phrases. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length];
}

function dayOf(now: number): number {
  return Math.floor(now / DAY_MS);
}

/** log(e^a + e^b) without overflow: scores are around λ·(days since 1970), far beyond e^709. */
function logAddExp(a: number, b: number): number {
  const high = Math.max(a, b);
  return high + Math.log1p(Math.exp(Math.min(a, b) - high));
}

function timeTerm(now: number): number {
  return (DECAY_PER_DAY * now) / DAY_MS;
}

function bestSpelling(spellings: readonly SearchSpelling[]): string {
  return spellings.reduce((best, s) =>
    s.count > best.count || (s.count === best.count && s.lastUsedAt > best.lastUsedAt) ? s : best,
  ).text;
}

function withSpelling(
  spellings: readonly SearchSpelling[],
  text: string,
  now: number,
): SearchSpelling[] {
  return spellings.some((s) => s.text === text)
    ? spellings.map((s) => (s.text === text ? { ...s, count: s.count + 1, lastUsedAt: now } : s))
    : [...spellings, { text, count: 1, lastUsedAt: now }];
}

function newEntry(
  text: string,
  normalized: string,
  referenceId: string | undefined,
  now: number,
): HistoryEntry {
  return {
    id: normalized,
    tier: 'recent',
    label: text,
    spellings: [{ text, count: 1, lastUsedAt: now }],
    referenceIds: referenceId ? [referenceId] : [],
    count: 1,
    days: 1,
    lastDay: dayOf(now),
    lastSearchedAt: now,
    score: timeTerm(now),
  };
}

function addSearch(
  entry: HistoryEntry,
  text: string,
  referenceId: string | undefined,
  now: number,
): HistoryEntry {
  const spellings = withSpelling(entry.spellings, text, now);
  const referenceIds =
    referenceId && !entry.referenceIds.includes(referenceId)
      ? [...entry.referenceIds, referenceId]
      : entry.referenceIds;
  const label = bestSpelling(spellings);
  const touched = { ...entry, spellings, label, referenceIds, lastSearchedAt: now };
  if (now - entry.lastSearchedAt < REPEAT_WINDOW_MS) return touched;
  const day = dayOf(now);
  return {
    ...touched,
    count: entry.count + 1,
    days: entry.days + (day === entry.lastDay ? 0 : 1),
    lastDay: day,
    score: logAddExp(entry.score, timeTerm(now)),
  };
}

function promote(entry: HistoryEntry): HistoryEntry {
  const earned = entry.days >= 2 || entry.count >= SAME_DAY_PROMOTION;
  return entry.tier === 'recent' && earned ? { ...entry, tier: 'frequent' } : entry;
}

/** Frequent overflow is demoted (lowest score first); Recent overflow is deleted (oldest first). */
function enforceLimits(
  entries: readonly HistoryEntry[],
  limits: HistoryLimits,
): { kept: HistoryEntry[]; evicted: string[] } {
  const frequent = entries.filter((e) => e.tier === 'frequent').sort((a, b) => b.score - a.score);
  const demoted = frequent.slice(limits.frequent).map((e) => ({ ...e, tier: 'recent' as const }));
  const recent = [...entries.filter((e) => e.tier === 'recent'), ...demoted].sort(
    (a, b) => b.lastSearchedAt - a.lastSearchedAt,
  );
  return {
    kept: [...frequent.slice(0, limits.frequent), ...recent.slice(0, limits.recent)],
    evicted: recent.slice(limits.recent).map((e) => e.id),
  };
}
