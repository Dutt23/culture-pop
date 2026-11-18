/**
 * Text helpers shared by the server functions: query and tag validation, code-point cutting,
 * markup stripping and the search objective. Moved unchanged from `api/web-search.ts`.
 */

const MIN_QUERY = 2;
export const MAX_QUERY = 200;
/** Search tags sent as a hint (docs/SEARCH_TAGS_PLAN.md); the same caps as the app's. */
const MAX_ABOUT = 5;
const MIN_TAG = 2;
const MAX_TAG = 30;
// Marks (\p{M}) keep Indic tags whole: "बॉलीवुड" has vowel signs. At least one letter or number,
// so "&&" or "--" (nothing once normalized) is refused.
const TAG_TEXT = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} &'-]+$/u;
const CONTROL_CHARS = /\p{Cc}/u;

/** What to look for: what the words mean, an answer from fiction, or videos of it. */
export type SearchKind = 'meaning' | 'question' | 'videos';

/** Up to five tags, each 2–30 letters, numbers, spaces, `&`, `'` or `-`; anything else is dropped. */
export function validAbout(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().replace(/\s+/g, ' '))
    .filter((tag) => {
      const length = Array.from(tag).length;
      return length >= MIN_TAG && length <= MAX_TAG && TAG_TEXT.test(tag);
    })
    .slice(0, MAX_ABOUT);
}

/** Trimmed, single-spaced query, or undefined when it breaks the length or character rules. */
export function validQuery(raw: string | null): string | undefined {
  if (raw === null || CONTROL_CHARS.test(raw)) return undefined;
  const q = raw.trim().replace(/\s+/g, ' ');
  return q.length >= MIN_QUERY && q.length <= MAX_QUERY ? q : undefined;
}

/** Cuts by code points, so an emoji is never split into a broken half. */
export function cut(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** Text only: images dropped, links reduced to their words, HTML tags and Markdown marks removed. */
export function plainText(markup: string): string {
  return markup
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What we ask Parallel for: the meaning and origin, so its excerpts explain rather than just mention.
 * A question leans to fiction, myths and pop culture (D50) unless the reader unticked "Stories &
 * myths", in which case the app sends `question: false`: left to itself, Parallel answers "who
 * committed the worst genocides" with real-world history.
 * `q` is already validated (≤200 characters, no control characters).
 */
export function objective(
  q: string,
  kind: SearchKind = 'meaning',
  about: readonly string[] = [],
): string {
  // A hint only: the search text itself never changes with tags.
  const hint = about.length > 0 ? ` Prefer results about ${about.join(', ')}.` : '';
  return baseObjective(q, kind) + hint;
}

function baseObjective(q: string, kind: SearchKind): string {
  if (kind === 'videos') {
    return `Find YouTube videos for "${q}": the official music video, live performances, trailers, clips or explainers. Prefer official channels.`;
  }
  if (kind === 'question') {
    return `Answer "${q}" about fiction, myths and pop culture: characters, events and works in films, TV, anime, books, comics, games, myths, legends and folklore — not real-world history or news. Name the characters and works.`;
  }
  return `Explain "${q}": what it means or refers to in pop culture or internet culture (films, TV, comics, games, music, memes, slang), and where it comes from.`;
}

