import { describe, expect, it } from 'vitest';
import { animationScope, cut, objective, plainText, searchContextKey } from './text.js';

describe('cut', () => {
  it('cuts by code points, never splitting an emoji', () => {
    expect(cut('😀'.repeat(5), 3)).toBe('😀😀…');
  });
});

describe('plainText', () => {
  it('drops images, keeps link words, strips tags and Markdown marks', () => {
    expect(plainText('![a](b) [x](y) <i>z</i> **w**')).toBe('x z w');
  });
});

describe('search context', () => {
  it('keeps animation scope explicit even for a ranking fragment', () => {
    const text = objective('biggest genocidal maniacs', 'question', ['anime', 'cartoons']);
    expect(text).toContain('fictional characters');
    expect(text).toContain('Exclude real historical figures');
    expect(animationScope(['Anime', 'cartoon', 'anime'])).toEqual(['anime', 'cartoons']);
    expect(animationScope(['music'])).toEqual([]);
  });

  it('canonicalizes tags while separating distinct modes and scopes', () => {
    expect(searchContextKey(true, ['Anime', 'cartoons'])).toBe(
      searchContextKey(true, ['cartoons', 'anime']),
    );
    expect(searchContextKey(true, ['anime'])).not.toBe(searchContextKey(true, ['cartoons']));
    expect(searchContextKey(true, ['anime'])).not.toBe(searchContextKey(false, ['anime']));
  });
});
