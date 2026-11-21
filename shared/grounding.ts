/**
 * Grounding check shared by the phone AI and the server: a sentence is accepted only when its
 * names, numbers and most of its words appear in the evidence it cites. Moved unchanged from
 * `src/services/llm/check.ts`, `src/domain/normalize.ts` and `src/services/retrieval/validate.ts`.
 * Imports nothing from `src/`.
 */

// Latin combining diacritics only; Indic vowel signs (also \p{M}) must survive.
const LATIN_DIACRITICS = /[̀-ͯ]/g;
const APOSTROPHES = /['‘’ʼ`´]/g;
const DASHES = /[-‐-―−]/g;
const NON_SEMANTIC = /[^\p{L}\p{N}\p{M}\s]/gu;
const WHITESPACE = /\s+/g;

/** Matching key for titles, aliases and queries. Display text is never replaced by this. */
export function normalizePhrase(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(LATIN_DIACRITICS, '')
    .normalize('NFC')
    .replace(APOSTROPHES, '')
    .replace(DASHES, ' ')
    .replace(NON_SEMANTIC, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

export function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(' ') : [];
}

/** True when `text` contains the query as a whole phrase, ignoring case, accents and punctuation. */
export function containsPhrase(text: string, query: string): boolean {
  const phrase = normalizePhrase(query);
  return phrase.length > 0 && ` ${normalizePhrase(text)} `.includes(` ${phrase} `);
}

/** Function words and sentence openers: neither a name nor content. */
export const COMMON_WORDS: ReadonlySet<string> = new Set(
  (
    'a an the and or but nor so yet for of to in on at by with from into onto over under about ' +
    'after before during while when where what which who whom whose why how than then there here ' +
    'this that these those it its he she him her his hers they them their theirs we us our you your ' +
    'i me my is are was were be been being am has have had do does did will would can could should ' +
    'may might must shall also as if not no only very just more most many much some any each both ' +
    'all other such own same too later eventually however according known called one ones'
  ).split(' '),
);

/** Share of a longer sentence's other content words that must appear (by stem) in the cited evidence. */
export const MIN_SHARED_WORDS = 0.6;
/**
 * Below this many content words, every one must appear: "Doctor Doom dies." has only one.
 * Was 5: claims of 3-4 words then failed on a single reworded verb ("tries" vs "try") that a
 * longer line could carry, dropping supported entries (docs/eval/passage-selection-2026-11-19.md).
 */
const SHORT_SENTENCE_WORDS = 3;
const STEM_CHARS = 5;
const MIN_CONTENT_CHARS = 3;
const POSSESSIVE = /['’]s\b/g;
/** Words that reverse a meaning; a sentence may use one only if its evidence does. */
const NEGATIONS = new Set(
  (
    'not no never nor without cannot isnt arent wasnt werent dont doesnt didnt cant couldnt ' +
    'wont wouldnt shouldnt hasnt havent hadnt aint'
  ).split(' '),
);

function wordsOf(text: string): string[] {
  return tokenize(normalizePhrase(text.replace(POSSESSIVE, '')));
}

/**
 * True when every name (a capitalised word that isn't a common word), number, negation and quoted
 * span in the sentence appears in `cited`, and its other content words do too: all of them in a
 * short sentence, at least `MIN_SHARED_WORDS` in a longer one, matched by the start of a word
 * ("dies" doesn't match "studies"). Strict on purpose: a paraphrase that drops a sentence is a
 * smaller loss than a made-up name, death or reversed meaning that is shown.
 */
export function isGrounded(sentence: string, cited: string, minShared = MIN_SHARED_WORDS): boolean {
  const evidence = ` ${wordsOf(cited).join(' ')} `;
  const hasWord = (word: string) => evidence.includes(` ${word} `);
  // Drop apostrophes as normalizePhrase does for the evidence, so "D'oh" is checked as "doh", not "d".
  const plain = sentence.replace(POSSESSIVE, '').replace(APOSTROPHES, '');
  const tokens = plain.match(/[\p{L}\p{N}]+/gu) ?? [];
  const names = new Set(
    tokens
      .filter((t) => /\p{N}/u.test(t) || (/^\p{Lu}/u.test(t) && !COMMON_WORDS.has(t.toLowerCase())))
      .map(normalizePhrase),
  );
  const words = wordsOf(sentence);
  if (![...names, ...words.filter((w) => NEGATIONS.has(w))].every(hasWord)) return false;
  const quoted = [...sentence.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1] ?? '');
  if (!quoted.every((q) => !normalizePhrase(q) || containsPhrase(cited, q))) return false;
  const content = words.filter(
    (w) => w.length >= MIN_CONTENT_CHARS && !COMMON_WORDS.has(w) && !names.has(w),
  );
  if (content.length === 0) return true;
  const shared = content.filter((w) => evidence.includes(` ${w.slice(0, STEM_CHARS)}`)).length;
  return content.length < SHORT_SENTENCE_WORDS
    ? shared === content.length
    : shared / content.length >= minShared;
}
