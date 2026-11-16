/**
 * Picks which text of a web result to show, without AI: the sentence that best answers the search,
 * then the rest of its excerpt. Input is already plain text (`plainText` in `web-search.ts`).
 */

/** Question and filler words (3+ letters; shorter words are skipped anyway). */
const STOPWORDS = new Set(
  (
    'the and are why what who how does did was were for with this that from when where which ' +
    'have about there mean means meaning you your his her they them its'
  ).split(' '),
);
/** Words that signal a sentence explains something rather than merely mentions it. */
const EXPLAINS =
  /\b(means?|refers? to|reference to|originat\w*|comes? from|coined|slang|meme|joke\w*|nickname\w*)\b/i;
const EXPLAINS_BONUS = 2;
/**
 * Words are compared by their first 5 letters on both sides, so "depressed" finds "depressing" but
 * "red" doesn't find "reddit".
 */
const STEM = 5;

/** Lower-case words with accents removed, so "pokemon" finds "Pokémon". */
const words = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

function stems(query: string): string[] {
  const kept = words(query).filter((word) => word.length >= 3 && !STOPWORDS.has(word));
  return [...new Set(kept.map((word) => word.slice(0, STEM)))];
}

function score(sentence: string, queryStems: readonly string[]): number {
  const have = new Set(words(sentence).map((word) => word.slice(0, STEM)));
  const hits = queryStems.filter((stem) => have.has(stem));
  if (hits.length === 0) return 0;
  return hits.length + (EXPLAINS.test(sentence) ? EXPLAINS_BONUS : 0);
}

/**
 * From the best-scoring sentence (earliest on a tie) to the end of its excerpt; the first non-empty
 * excerpt whole when no sentence mentions any word of the search.
 */
export function bestSnippet(excerpts: readonly string[], query: string): string {
  const queryStems = stems(query);
  let best = { score: 0, text: excerpts.find(Boolean) ?? '' };
  for (const excerpt of excerpts) {
    const sentences = excerpt.split(/(?<=[.!?])\s+/);
    for (const [index, sentence] of sentences.entries()) {
      const value = score(sentence, queryStems);
      if (value > best.score) best = { score: value, text: sentences.slice(index).join(' ') };
    }
  }
  return best.text;
}

const TRACKING = /^utm_/i;

/**
 * Same page whatever the mobile or old-site host, trailing slash, #fragment or utm_ tags; other
 * query parameters stay, since they often name the page (`watch?v=…`).
 */
export function pageKey(url: URL): string {
  const host = url.hostname.replace(/^(www|m|old)\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  const params = [...url.searchParams].filter(([name]) => !TRACKING.test(name));
  const search = new URLSearchParams(params).toString();
  return `${host}${path}${search ? `?${search}` : ''}`;
}
