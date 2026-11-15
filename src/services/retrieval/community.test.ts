import { describe, expect, it } from 'vitest';
import type { ReferenceKind } from '../../domain/types';
import { communitySearchLinks, looksLikePhrase, suggestCommunityLinks } from './community';
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
