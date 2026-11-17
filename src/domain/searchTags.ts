import type { BrowsableCategory } from './discovery';
import { CATEGORIES, CATEGORY_PLURAL_LABEL } from './labels';
import { normalizePhrase } from './normalize';
import type { RankedMatch } from './ranking';
import type { Category, PresentIn } from './types';

/**
 * Search tags and the taste lean (docs/SEARCH_TAGS_PLAN.md). Tags lift matching results and never
 * hide the rest; taste only breaks ties between equally good library matches. Pure and on-device.
 */

/** A tag the reader typed, kept on this device; `on` says whether it lifts results now. */
export interface CustomTag {
  text: string;
  on: boolean;
}

export interface SearchTagState {
  /** Type tags that are on, in canonical order. */
  types: BrowsableCategory[];
  /** Saved custom tags, oldest first. */
  custom: CustomTag[];
}

export const NO_TAGS: SearchTagState = { types: [], custom: [] };

/** One built-in tag per browsable category, in canonical order. */
export const TYPE_TAGS: readonly BrowsableCategory[] = CATEGORIES;

export const MAX_CUSTOM_TAGS = 8;
export const MIN_TAG_CHARS = 2;
export const MAX_TAG_CHARS = 30;
/** At most this many tags go to the wider web as a hint; the server checks the same caps. */
export const MAX_HINT_TAGS = 5;
// Marks (\p{M}) keep Indic tags whole: "बॉलीवुड" has vowel signs. At least one letter or number,
// so "&&" or "--" (nothing once normalized) is refused.
const TAG_TEXT = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} &'-]+$/u;

/** Trimmed, single-spaced tag text, or undefined when it breaks the length or character rules. */
export function cleanTag(text: string): string | undefined {
  const tag = text.trim().replace(/\s+/g, ' ');
  const length = Array.from(tag).length;
  const fits = length >= MIN_TAG_CHARS && length <= MAX_TAG_CHARS;
  return fits && TAG_TEXT.test(tag) ? tag : undefined;
}

const sameTag = (a: string, b: string) => normalizePhrase(a) === normalizePhrase(b);

export type AddTagResult =
  { ok: true; state: SearchTagState } | { ok: false; reason: 'invalid' | 'duplicate' | 'full' };

/** Adds a custom tag, switched on. A tag naming a type ("anime") turns that type on instead. */
export function addCustomTag(state: SearchTagState, text: string): AddTagResult {
  const tag = cleanTag(text);
  if (!tag) return { ok: false, reason: 'invalid' };
  const type = TYPE_TAGS.find((c) => sameTag(CATEGORY_PLURAL_LABEL[c], tag) || sameTag(c, tag));
  if (type) {
    return state.types.includes(type)
      ? { ok: false, reason: 'duplicate' }
      : { ok: true, state: toggleType(state, type) };
  }
  if (state.custom.some((c) => sameTag(c.text, tag))) return { ok: false, reason: 'duplicate' };
  if (state.custom.length >= MAX_CUSTOM_TAGS) return { ok: false, reason: 'full' };
  return { ok: true, state: { ...state, custom: [...state.custom, { text: tag, on: true }] } };
}

export function removeCustomTag(state: SearchTagState, text: string): SearchTagState {
  return { ...state, custom: state.custom.filter((c) => c.text !== text) };
}

export function toggleType(state: SearchTagState, type: BrowsableCategory): SearchTagState {
  const on = new Set(state.types);
  if (on.has(type)) on.delete(type);
  else on.add(type);
  return { ...state, types: TYPE_TAGS.filter((c) => on.has(c)) };
}

export function toggleCustomTag(state: SearchTagState, text: string): SearchTagState {
  return {
    ...state,
    custom: state.custom.map((c) => (c.text === text ? { ...c, on: !c.on } : c)),
  };
}

/** Stored tags are untrusted: anything malformed is dropped, and the caps apply again. */
export function parseSearchTags(raw: string | undefined): SearchTagState {
  if (raw === undefined) return NO_TAGS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_TAGS;
  }
  if (typeof value !== 'object' || value === null) return NO_TAGS;
  const { types, custom } = value as { types?: unknown; custom?: unknown };
  const on = new Set(Array.isArray(types) ? types : []);
  const tags = (Array.isArray(custom) ? custom : []).reduce<CustomTag[]>((kept, item: unknown) => {
    if (typeof item !== 'object' || item === null) return kept;
    const { text, on: isOn } = item as { text?: unknown; on?: unknown };
    const tag = typeof text === 'string' ? cleanTag(text) : undefined;
    if (!tag || kept.length >= MAX_CUSTOM_TAGS || kept.some((c) => sameTag(c.text, tag))) {
      return kept;
    }
    return [...kept, { text: tag, on: isOn === true }];
  }, []);
  return { types: TYPE_TAGS.filter((c) => on.has(c)), custom: tags };
}

export const serializeSearchTags = (state: SearchTagState): string => JSON.stringify(state);

export const hasActiveTags = (state: SearchTagState): boolean =>
  state.types.length > 0 || state.custom.some((c) => c.on);

/** What a result offers for matching: its category and the words it is known by. */
export interface Taggable {
  category: Category;
  title: string;
  creators?: readonly string[];
  presentIn?: readonly PresentIn[];
  inspiredBy?: readonly PresentIn[];
  /** Library tags ("disney", "anime"). */
  tags?: readonly string[];
  origin?: string;
}

/**
 * True when the result is one of the "on" types, or mentions an "on" custom tag as whole words in
 * its title, creators, "From:" works, library tags, origin or `extraText` (its first source
 * sentence). A custom tag never maps to a category, so it misses pages that don't say it.
 */
export function matchesTags(item: Taggable, state: SearchTagState, extraText = ''): boolean {
  if (item.category !== 'other' && state.types.includes(item.category)) return true;
  const words = state.custom.filter((c) => c.on).map((c) => normalizePhrase(c.text));
  if (words.length === 0) return false;
  // Each field on its own, so a two-word tag never matches across the end of one and the next.
  const fields = [
    item.title,
    ...(item.creators ?? []),
    ...(item.presentIn ?? []).map((w) => w.label),
    ...(item.inspiredBy ?? []).map((w) => w.label),
    ...(item.tags ?? []),
    item.origin ?? '',
    extraText,
  ].map((field) => ` ${normalizePhrase(field)} `);
  return words.some((word) => word !== '' && fields.some((field) => field.includes(` ${word} `)));
}

/**
 * Likely answers first, then tagged results, then the rest, each in the order given. A new list;
 * nothing is removed.
 */
export function liftTagged<T>(
  items: readonly T[],
  isTagged: (item: T) => boolean,
  isAnswer: (item: T) => boolean,
): T[] {
  const answers = items.filter(isAnswer);
  const rest = items.filter((item) => !isAnswer(item));
  return [...answers, ...rest.filter(isTagged), ...rest.filter((item) => !isTagged(item))];
}

/** The words sent to the wider web as a hint: type names, then custom tags, at most five. */
export function aboutHint(state: SearchTagState): string[] {
  const types = state.types.map((c) => {
    const label = CATEGORY_PLURAL_LABEL[c];
    return label === label.toUpperCase() ? label : label.toLowerCase();
  });
  const custom = state.custom.filter((c) => c.on).map((c) => c.text);
  return [...types, ...custom].slice(0, MAX_HINT_TAGS);
}

/** The lean needs this many favourites or opened references in one category… */
export const MIN_TASTE_SIGNALS = 3;

/**
 * The one category the reader's favourites and opened results lean to: the most common one, once
 * it has at least three of them and at least half of all. "Other" never counts. Ties mean no lean.
 */
export function tasteLean(categories: readonly Category[]): BrowsableCategory | undefined {
  const counted = categories.filter((c): c is BrowsableCategory => c !== 'other');
  const counts = new Map<BrowsableCategory, number>();
  for (const c of counted) counts.set(c, (counts.get(c) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || (second && second[1] === top[1])) return undefined;
  return top[1] >= MIN_TASTE_SIGNALS && top[1] * 2 >= counted.length ? top[0] : undefined;
}

/**
 * Taste as a tie-breaker: within each run of equally good library matches (the same match kind),
 * the leaned-to category comes first; otherwise the order is unchanged. A new list.
 */
export function leanByTaste(
  matches: readonly RankedMatch[],
  lean: BrowsableCategory | undefined,
): RankedMatch[] {
  if (!lean) return [...matches];
  const runs = matches.reduce<RankedMatch[][]>((groups, match) => {
    const last = groups.at(-1);
    if (last && last[0]?.kind === match.kind) return [...groups.slice(0, -1), [...last, match]];
    return [...groups, [match]];
  }, []);
  return runs.flatMap((run) => [
    ...run.filter((m) => m.reference.category === lean),
    ...run.filter((m) => m.reference.category !== lean),
  ]);
}

/** True when two orderings of the same results differ, so the page can say why. */
export const orderChanged = <T>(before: readonly T[], after: readonly T[]): boolean =>
  before.some((item, index) => after[index] !== item);

/** "Anime ranked a little higher because of your favourites and what you've opened." */
export function tasteNote(lean: BrowsableCategory, usesHistory: boolean): string {
  const label = CATEGORY_PLURAL_LABEL[lean];
  const from = usesHistory ? "your favourites and what you've opened" : 'your favourites';
  return `${label} ranked a little higher because of ${from}.`;
}
