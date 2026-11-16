import { describe, expect, it } from 'vitest';
import { isMiss, planRewrite, shorterPhrase } from './rewrite';
import type { RetrievedCandidate } from './types';

function candidate(
  id: string,
  title: string,
  overrides: Partial<RetrievedCandidate> = {},
): RetrievedCandidate {
  return {
    id,
    title,
    kind: 'other',
    category: 'other',
    classifying: false,
    role: 'topic',
    sources: [],
    externalLinks: [],
    ...overrides,
  };
}

const page = (title: string) => candidate(`wd:${title}`, title);
const entry = candidate('enwiktionary:x', 'x', { kind: 'phrase', role: 'definition' });

describe('isMiss', () => {
  it('is a miss when nothing is named by the query', () => {
    expect(
      isMiss('babu bhaiya paisa hi paisa hoga', [page('Hemlata'), page('Bewafa (song)')]),
    ).toBe(true);
    expect(isMiss('anything', [])).toBe(true);
  });

  it('is not a miss when a title equals or contains the query, disambiguator aside', () => {
    expect(isMiss('hera pheri', [page('Hera Pheri (2000 film)')])).toBe(false);
    expect(isMiss('point break', [page('The Point Break Cup')])).toBe(false);
  });

  it('keeps word order: the same words reordered are still a miss', () => {
    expect(isMiss('point break', [page('Break Point')])).toBe(true);
  });

  it('is not a miss when there is a dictionary entry, which is looked up by the exact query', () => {
    expect(isMiss('gigachad', [page('Chad (slang)'), entry])).toBe(false);
  });

  it('is never a miss for an empty query', () => {
    expect(isMiss('', [])).toBe(false);
  });
});

describe('shorterPhrase', () => {
  it('takes the first two words of a query of four or more words', () => {
    expect(shorterPhrase('Babu Bhaiya paisa hi paisa hoga')).toBe('babu bhaiya');
    expect(shorterPhrase('red blue green pink', 3)).toBe('red blue green');
  });

  it('leaves a short query alone', () => {
    expect(shorterPhrase('mogambo khush hua')).toBeUndefined();
  });

  it('skips leading question and filler words before cutting', () => {
    expect(shorterPhrase('why are ferrari fans depressed')).toBe('ferrari fans');
    expect(shorterPhrase('who is babu bhaiya')).toBe('babu bhaiya');
    expect(shorterPhrase('So what is the babu bhaiya line')).toBe('babu bhaiya');
  });

  it('does not run when fewer than two meaningful words remain', () => {
    expect(shorterPhrase('what is the matrix')).toBeUndefined();
    expect(shorterPhrase('where is the beef')).toBeUndefined();
    expect(shorterPhrase('who is the a an so')).toBeUndefined();
  });

  it('only skips words at the start, not inside the query', () => {
    expect(shorterPhrase('babu bhaiya is the best')).toBe('babu bhaiya');
  });
});

describe('planRewrite', () => {
  const missed = [page('Hemlata')];
  const base = { query: 'babu bhaiya paisa hi paisa hoga', candidates: missed };

  it('plans nothing when the plain search did not miss', () => {
    expect(
      planRewrite({
        ...base,
        candidates: [page('Babu bhaiya paisa hi paisa hoga')],
        suggestion: 'x y',
      }),
    ).toBeUndefined();
  });

  it('prefers Wikipedia suggestion when it differs from the query', () => {
    expect(planRewrite({ ...base, suggestion: 'babu bhaiya paisa hi paisa hona' })).toEqual({
      kind: 'suggestion',
      text: 'babu bhaiya paisa hi paisa hona',
    });
  });

  it('ignores a suggestion that is the query itself, then cuts a long query', () => {
    expect(planRewrite({ ...base, suggestion: 'Babu Bhaiya paisa hi paisa hoga' })).toEqual({
      kind: 'shorter_phrase',
      text: 'babu bhaiya',
    });
  });

  it('plans at most one fallback and honours the order and the allowed kinds', () => {
    const both = { ...base, suggestion: 'something else' };
    expect(planRewrite(both, { order: ['shorter_phrase', 'suggestion'] })?.kind).toBe(
      'shorter_phrase',
    );
    expect(planRewrite(both, { order: [] })).toBeUndefined();
    // A short query has nothing to cut, so only the suggestion can apply.
    expect(
      planRewrite({ query: 'bilkul ricks', candidates: [] }, { order: ['shorter_phrase'] }),
    ).toBeUndefined();
  });
});
