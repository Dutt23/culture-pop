import { describe, expect, it } from 'vitest';
import type { ReferenceKind } from '../../domain/types';
import {
  communitySearchLinks,
  isWeakHit,
  looksLikePhrase,
  looksLikeQuestion,
  questionSubject,
  suggestCommunityLinks,
} from './community';
import type { RetrievedCandidate } from './types';

function candidate(kind: ReferenceKind): RetrievedCandidate {
  return {
    id: `x:${kind}`,
    title: kind,
    kind,
    category: 'other',
    classifying: false,
    role: kind === 'work' ? 'work' : 'topic',
    sources: [],
    externalLinks: [],
  };
}

describe('community fallback', () => {
  it('treats three or more words, or a slang word, as a phrase', () => {
    expect(looksLikePhrase('catch me outside')).toBe(true);
    expect(looksLikePhrase('OK boomer')).toBe(true);
    expect(looksLikePhrase('the matrix')).toBe(false);
    expect(looksLikePhrase('swat kats')).toBe(false);
  });

  it('suggests the community sites when online search found nothing', () => {
    expect(suggestCommunityLinks('the matrix', [])).toBe(true);
  });

  it('suggests them when a phrase only found works, people or other pages', () => {
    const found = [candidate('work'), candidate('other')];
    expect(suggestCommunityLinks('catch me outside', found)).toBe(true);
    expect(suggestCommunityLinks('the matrix', found)).toBe(false);
  });

  it('stays quiet once something explains the phrase', () => {
    for (const kind of ['phrase', 'quote', 'meme'] as const) {
      expect(suggestCommunityLinks('catch me outside', [candidate('work'), candidate(kind)])).toBe(
        false,
      );
    }
  });

  it('links to Know Your Meme, Urban Dictionary and Reddit from the shared templates', () => {
    expect(communitySearchLinks('cash me outside')).toEqual([
      { site: 'Know Your Meme', href: 'https://knowyourmeme.com/search?q=cash%20me%20outside' },
      {
        site: 'Urban Dictionary',
        href: 'https://www.urbandictionary.com/define.php?term=cash%20me%20outside',
      },
      { site: 'Reddit', href: 'https://www.reddit.com/search/?q=cash%20me%20outside' },
    ]);
  });
});

describe('question-style queries', () => {
  it.each([
    ['why are ferrari fans depressed', 'ferrari fans depressed'],
    ['why are bmw drivers assholes', 'bmw drivers assholes'],
    ['Why do cats purr?', 'cats purr'],
    ['who is babu bhaiya', 'babu bhaiya'],
    ['how does the beef work', 'beef work'],
    ['ferrari fans depressed?', 'ferrari fans depressed'],
  ])('%s is about "%s"', (query, subject) => {
    expect(questionSubject(query)).toBe(subject);
    expect(looksLikeQuestion(query)).toBe(true);
  });

  it.each([
    ["what's up doc", 'a quote, and the apostrophe makes it not a leading "what"'],
    ['what is the matrix', 'a lookup: one meaningful word is left'],
    ['where is the beef', 'a quote: one meaningful word is left'],
    ['how you doin', 'a catchphrase addressed to someone'],
    ['can you play wonderwall', 'a request addressed to someone'],
    ['are you ready for your kiss now explodey', 'a quote addressed to someone'],
    ['catch me outside', 'no question word'],
    ['why', 'nothing left'],
    ['', 'empty'],
  ])('%s is not question-style (%s)', (query) => {
    expect(questionSubject(query)).toBeUndefined();
    expect(looksLikeQuestion(query)).toBe(false);
  });

  const page = (title: string, overrides: Partial<RetrievedCandidate> = {}): RetrievedCandidate => ({
    ...candidate('other'),
    id: `wd:${title}`,
    title,
    ...overrides,
  });
  const question = 'why are ferrari fans depressed';

  it('calls a related page weak when it shares no meaningful word with the question', () => {
    expect(isWeakHit(question, page('Pink Floyd'))).toBe(true);
    expect(isWeakHit(question, page('Lando Norris'))).toBe(true);
    // Sharing only a filler word ("are") does not count.
    expect(isWeakHit(question, page('Are You Experienced'))).toBe(true);
  });

  it('keeps a page that shares a word, and anything that is a work or explains a phrase', () => {
    expect(isWeakHit(question, page('Scuderia Ferrari'))).toBe(false);
    expect(isWeakHit(question, page('Pink Floyd', { role: 'work', kind: 'work' }))).toBe(false);
    expect(isWeakHit(question, page('Pink Floyd', { kind: 'meme' }))).toBe(false);
    expect(isWeakHit(question, page('Pink Floyd', { kind: 'phrase', role: 'definition' }))).toBe(false);
  });

  it('suggests the community sites first unless something online explains the question', () => {
    expect(suggestCommunityLinks(question, [page('Pink Floyd'), page('Scuderia Ferrari')])).toBe(true);
    expect(suggestCommunityLinks(question, [page('Ferrari fans', { kind: 'meme' })])).toBe(false);
    expect(suggestCommunityLinks(question, [page('x', { role: 'definition', kind: 'phrase' })])).toBe(
      false,
    );
  });

  it('leaves other queries exactly as they were', () => {
    expect(suggestCommunityLinks('the matrix', [page('The Matrix', { role: 'work', kind: 'work' })])).toBe(
      false,
    );
  });
});
