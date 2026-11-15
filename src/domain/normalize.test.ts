import { describe, expect, it } from 'vitest';
import { normalizePhrase, tokenize } from './normalize';

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
