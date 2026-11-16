import { describe, expect, it } from 'vitest';
import { normalizePhrase, stripDisambiguator, tokenize } from './normalize';

describe('normalizePhrase', () => {
  it.each([
    ['trims, lowercases and collapses whitespace', '  Hakuna \t  MATATA \n', 'hakuna matata'],
    ['treats curly and straight apostrophes the same', 'I’m', 'im'],
    ['drops straight apostrophes', "I'm", 'im'],
    ['splits hyphenated words', 'Spider-Man', 'spider man'],
    ['splits en/em dashes', 'before–after—later', 'before after later'],
    ['strips Latin accents', 'Pokémon', 'pokemon'],
    ['folds full-width characters (NFKC)', 'ＨＥＬＬＯ', 'hello'],
    ['folds ligatures (NFKC)', 'ﬁne', 'fine'],
    ['removes repeated punctuation', 'D’oh!!!???', 'doh'],
    ['removes curly double quotes', '“This is fine”', 'this is fine'],
    ['keeps digits', '3 Idiots', '3 idiots'],
    ['returns empty for punctuation only', '?!...', ''],
  ])('%s', (_name, input, expected) => {
    expect(normalizePhrase(input)).toBe(expected);
  });

  it('preserves Devanagari vowel signs', () => {
    expect(normalizePhrase('सब ठीक है')).toBe('सब ठीक है');
  });

  it('is idempotent', () => {
    const once = normalizePhrase('  “I’m the King-of the World!” ');
    expect(normalizePhrase(once)).toBe(once);
  });
});

describe('tokenize', () => {
  it('returns no tokens for an empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('splits on single spaces', () => {
    expect(tokenize('let it go')).toEqual(['let', 'it', 'go']);
  });
});

describe('stripDisambiguator', () => {
  it.each([
    ['Point Break (2015 film)', 'Point Break'],
    ['Break Point (2021 TV series)', 'Break Point'],
    ['Chernobyl (miniseries)', 'Chernobyl'],
    ['Taarak Mehta Ka Ooltah Chashmah (TV serial)', 'Taarak Mehta Ka Ooltah Chashmah'],
    ['The Office (American sitcom)', 'The Office'],
    ['Days of Our Lives (soap opera)', 'Days of Our Lives'],
    ['Planet Earth (docuseries)', 'Planet Earth'],
  ])('drops the bracket of %s', (title, plain) => {
    expect(stripDisambiguator(title)).toBe(plain);
  });

  it('keeps a bracket that belongs to the title', () => {
    expect(stripDisambiguator('Rocky (Part 2)')).toBe('Rocky (Part 2)');
  });
});
