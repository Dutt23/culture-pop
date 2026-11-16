import type { Category, ReferenceKind } from '../../domain/types';

interface Classification {
  category: Category;
  kind: ReferenceKind;
}

/**
 * Wikidata classes the app understands, most specific first: an animated series is also a
 * television series, so it must be checked before TV. The SPARQL query matches `P31/P279*`
 * against exactly these IDs.
 */
const CLASS_PRIORITY: readonly [string, Classification][] = [
  ['Q581714', { category: 'cartoon', kind: 'work' }], // animated series
  ['Q202866', { category: 'cartoon', kind: 'work' }], // animated film
  ['Q2927074', { category: 'meme', kind: 'meme' }], // internet meme
  ['Q11424', { category: 'film', kind: 'work' }], // film
  ['Q5398426', { category: 'tv', kind: 'work' }], // television series
  ['Q15416', { category: 'tv', kind: 'work' }], // television program
  // Covers comic book series, graphic novels, comic strips and manga (checked 2026-11-15).
  ['Q1004', { category: 'comics', kind: 'work' }], // comic
  ['Q7889', { category: 'games', kind: 'work' }], // video game (Minecraft, Pac-Man)
  ['Q7058673', { category: 'games', kind: 'work' }], // video game series (The Legend of Zelda)
  ['Q7366', { category: 'music', kind: 'work' }], // song
  ['Q105543609', { category: 'music', kind: 'work' }], // musical work/composition
  ['Q2708515', { category: 'catchphrase', kind: 'quote' }], // catchphrase
  ['Q206287', { category: 'catchphrase', kind: 'quote' }], // quotation
  ['Q1114461', { category: 'comics', kind: 'character' }], // comics character (e.g. Doctor Doom)
  ['Q1569167', { category: 'games', kind: 'character' }], // video game character (Mario)
  ['Q95074', { category: 'other', kind: 'character' }], // fictional character
  ['Q187931', { category: 'saying', kind: 'phrase' }], // phrase
  ['Q8102', { category: 'saying', kind: 'phrase' }], // slang
];

/** Series (not films): the only things TVmaze lists. */
export const SERIES_CLASSES: ReadonlySet<string> = new Set(['Q581714', 'Q5398426', 'Q15416']);

/** List articles and disambiguation pages are navigation, not references. */
export const EXCLUDED_CLASSES: ReadonlySet<string> = new Set([
  'Q13406463', // Wikimedia list article
  'Q4167410', // Wikimedia disambiguation page
]);

export const QUERIED_CLASSES: readonly string[] = [
  ...CLASS_PRIORITY.map(([qid]) => qid),
  ...EXCLUDED_CLASSES,
];

const UNKNOWN: Classification = { category: 'other', kind: 'other' };

export function classify(classes: ReadonlySet<string>): Classification {
  return CLASS_PRIORITY.find(([qid]) => classes.has(qid))?.[1] ?? UNKNOWN;
}
