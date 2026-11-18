import { describe, expect, it } from 'vitest';
import { curateEvidence, flagSources, roleOf } from './cardCurate.js';
import type { DraftSourceInput } from './cardTypes.js';

const item = (from: string, text: string, source = 0) => ({
  from,
  title: 'ok boomer',
  text,
  source,
});

describe('roleOf', () => {
  it('maps app cards and sites to roles', () => {
    expect(roleOf('app card', 'app')).toBe('meaning');
    expect(roleOf('your card', 'app')).toBe('usage');
    expect(roleOf('wiktionary', 'wiki')).toBe('meaning');
    expect(roleOf('wikipedia', 'wiki')).toBe('origin');
    expect(roleOf('wikidata', 'wiki')).toBe('origin');
    expect(roleOf('example.com', 'web')).toBe('usage');
  });
});

describe('curateEvidence', () => {
  it('drops a page in another script for a Latin search', () => {
    const { items, dropped } = curateEvidence(
      [
        item(
          'example.com',
          '这是一个关于好的网络用语的很长的页面内容，完全使用中文书写，没有任何拉丁字母出现在这里。ok',
        ),
      ],
      'ok boomer',
    );
    expect(items).toHaveLength(0);
    expect(dropped[0].why).toBe('different language');
  });

  it('drops an item that mentions none of the search words', () => {
    const { items, dropped } = curateEvidence(
      [
        {
          from: 'example.com',
          title: 'stonks',
          text: 'Stonks are a meme about investing, shown with a cartoon man in a suit.',
          source: 0,
        },
      ],
      'ok boomer',
    );
    expect(items).toHaveLength(0);
    expect(dropped[0].why).toBe('mentions none of the search words');
  });

  it('keeps a second source before a second item from the same source', () => {
    const { items } = curateEvidence(
      [
        item(
          'wiktionary',
          'ok boomer: a dismissive phrase used by younger people to answer older ones.',
          0,
        ),
        item(
          'wiktionary',
          'ok boomer, as a retort, mocks attitudes seen as outdated or closed to change.',
          1,
        ),
        item(
          'merriam-webster.com',
          'The ok boomer retort entered dictionaries after going viral during 2019.',
          2,
        ),
      ],
      'ok boomer',
    );
    expect(items.map((i) => i.from)).toEqual(['wiktionary', 'merriam-webster.com']);
  });

  it('caps and orders meaning, origin, usage', () => {
    const many = (from: string, label: string, ids: number[]) =>
      ids.map((n) =>
        item(
          from,
          `ok boomer ${label} note number ${n} with unique words w${n}a w${n}b w${n}c w${n}d`,
          n,
        ),
      );
    const { items } = curateEvidence(
      [
        ...many('example.com', 'usage', [31, 32, 33, 34]),
        ...many('wikipedia', 'origin', [21, 22, 23]),
        ...many('wiktionary', 'meaning', [11, 12, 13]),
      ],
      'ok boomer',
    );
    expect(items.map((i) => i.role)).toEqual([
      'meaning',
      'meaning',
      'origin',
      'origin',
      'usage',
      'usage',
      'usage',
    ]);
    expect(items.map((i) => i.id)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
  });
});

describe('flagSources', () => {
  it('marks off-topic, other-language and duplicate sources and leaves good ones null', () => {
    const good: DraftSourceInput = {
      kind: 'wiki',
      from: 'wiktionary',
      title: 'ok boomer',
      text: 'A dismissive phrase used by younger people to answer older ones.',
    };
    const sources: DraftSourceInput[] = [
      good,
      {
        kind: 'web',
        from: 'a.cn',
        title: '中文',
        text: '这是一个很长的中文页面内容，没有任何拉丁字母出现在这里，只有汉字。',
        url: 'https://a.cn',
      },
      {
        kind: 'web',
        from: 'b.com',
        title: 'stonks',
        text: 'Stonks are a meme about investing, with a cartoon man in a suit.',
        url: 'https://b.com',
      },
      { ...good },
    ];
    expect(flagSources(sources, 'ok boomer')).toEqual([
      null,
      'other_language',
      'off_topic',
      'duplicate',
    ]);
  });
});
