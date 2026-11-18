export { normalizePhrase, tokenize } from '../../shared/grounding.js';

// Wikipedia-style disambiguators only: a year or a kind of work, e.g. "(2015 film)", "(TV series)".
// Brackets that belong to the title, like "(Part 2)", are kept.
const DISAMBIGUATOR =
  /\s*\([^)]*\b(?:\d{4}|film|series|show|programme|program|song|single|album|band|novel|book|play|musical|game|character|meme|phrase|soundtrack|episode|franchise|comics|manga|anime|miniseries|serial|sitcom|soap opera|telenovela|docuseries)\b[^)]*\)$/i;

/** "Point Break (2015 film)" → "Point Break": drops a trailing Wikipedia disambiguator for display. */
export function stripDisambiguator(title: string): string {
  return title.replace(DISAMBIGUATOR, '');
}
