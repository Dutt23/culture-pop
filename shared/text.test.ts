import { describe, expect, it } from 'vitest';
import { cut, plainText } from './text.js';

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
