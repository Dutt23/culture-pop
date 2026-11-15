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
