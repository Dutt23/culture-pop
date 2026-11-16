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

// Wikipedia-style disambiguators only: a year or a kind of work, e.g. "(2015 film)", "(TV series)".
// Brackets that belong to the title, like "(Part 2)", are kept.
const DISAMBIGUATOR =
  /\s*\([^)]*\b(?:\d{4}|film|series|show|programme|program|song|single|album|band|novel|book|play|musical|game|character|meme|phrase|soundtrack|episode|franchise|comics|manga|anime|miniseries|serial|sitcom|soap opera|telenovela|docuseries)\b[^)]*\)$/i;

/** "Point Break (2015 film)" → "Point Break": drops a trailing Wikipedia disambiguator for display. */
export function stripDisambiguator(title: string): string {
  return title.replace(DISAMBIGUATOR, '');
}
