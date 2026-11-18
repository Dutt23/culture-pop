import { describe, expect, it } from 'vitest';
import type { EvidenceItem, ToneCard } from './cardTypes.js';
import type { ModelAnswer } from './cardPrompt.js';
import { checkAnswer } from './cardCheck.js';

const items: EvidenceItem[] = [
  {
    id: 'E1',
    role: 'meaning',
    from: 'wiki',
    title: 'Sholay',
    text: 'In Sholay, the villain Gabbar asks how many men there were. It is a famous scene.',
    source: 3,
  },
  {
    id: 'E2',
    role: 'usage',
    from: 'web',
    title: 'Sholay lines',
    text: 'People quote "Kitne aadmi the" when they want a headcount.',
    source: 5,
  },
];

const base: ModelAnswer = {
  main_use: 'quote',
  label: 'Kitne aadmi the',
  gist: 'A line from Sholay.',
  means: 'They want a headcount.',
  reply: 'Bas teen, Gabbar!',
  summary: [{ t: 'Gabbar asks how many men there were.', ids: ['E1'] }],
  context: [],
  example: null,
  spoiler: 'none',
  unclear: false,
  ignored: [],
};

const tones: ToneCard[] = [
  {
    label: 'Other',
    gist: 'Someone being a total legend today',
    means: 'They did great things',
    reply: 'You are a legend, friend',
    summary: 'A short note.',
  },
];

const run = (patch: Partial<ModelAnswer>, t: readonly ToneCard[] = []) =>
  checkAnswer({ ...base, ...patch }, items, 'kitne aadmi the', t);

function card(patch: Partial<ModelAnswer>, t: readonly ToneCard[] = []) {
  const r = run(patch, t);
  if (!r.card) throw new Error(`no card: ${r.reason}`);
  return r.card;
}

describe('checkAnswer', () => {
  it("refuses an answer that isn't a card", () => {
    expect(checkAnswer('hi', items, 's', [])).toEqual({ card: null, reason: 'unreadable' });
    expect(checkAnswer({ ...base, summary: 'x' }, items, 's', [])).toEqual({
      card: null,
      reason: 'unreadable',
    });
  });

  it('returns unclear when the model says so', () => {
    expect(run({ unclear: true })).toEqual({ card: null, reason: 'unclear' });
  });

  it('drops a sentence citing an unknown id', () => {
    const c = card({
      summary: [
        { t: 'Gabbar asks how many men there were.', ids: ['E9'] },
        { t: 'It is a famous scene.', ids: ['E1'] },
      ],
    });
    expect(c.summary.map((l) => l.text)).toEqual(['It is a famous scene.']);
  });

  it("drops a sentence whose name isn't in its cited items", () => {
    const c = card({
      summary: [
        { t: 'Amitabh asks how many men there were.', ids: ['E1'] },
        { t: 'Gabbar asks how many men there were.', ids: ['E1'] },
      ],
    });
    expect(c.summary).toHaveLength(1);
    expect(c.summary[0]?.text).toMatch(/^Gabbar/);
  });

  it('keeps at most 2 summary and 3 context lines', () => {
    const line = { t: 'It is a famous scene.', ids: ['E1'] };
    const c = card({
      summary: [line, line, line],
      context: [line, line, line, line],
    });
    expect(c.summary).toHaveLength(2);
    expect(c.context).toHaveLength(3);
  });

  it("drops an example that isn't copied word for word", () => {
    const c = card({ example: { t: 'Kitne aadmi the, boss?', ids: ['E2'] } });
    expect(c.example).toBeNull();
  });

  it('drops an example without the searched words', () => {
    const c = card({ example: { t: 'they want a headcount', ids: ['E2'] } });
    expect(c.example).toBeNull();
  });

  it('keeps an example copied word for word with the search', () => {
    const c = card({ example: { t: 'People quote “Kitne aadmi the” when', ids: ['E2'] } });
    expect(c.example).toEqual({ text: 'People quote “Kitne aadmi the” when', sources: [5] });
  });

  it('replaces a reply that copies the tone card', () => {
    expect(card({ reply: 'You are a legend, friend!' }, tones).reply).toBe('What do you mean?');
    expect(card({ means: 'Truly a total legend today' }, tones).means).toBe('Ask what they mean.');
  });

  it('replaces a generic reply', () => {
    expect(card({ reply: 'Nice one!' }).reply).toBe('What do you mean?');
  });

  it('does not treat a reply\'s first word or "Bas" as a name', () => {
    expect(card({ reply: 'Bas teen, Gabbar!' }).reply).toBe('Bas teen, Gabbar!');
    expect(card({ reply: 'Bas teen, Jai!' }).reply).toBe('What do you mean?');
  });

  it('falls back to the first kept summary line for a gist with a made-up name', () => {
    expect(card({ gist: 'Ramesh Sippy made it in 1975.' }).gist).toBe(
      'Gabbar asks how many men there were.',
    );
  });

  it('maps ids and ignored to source indices', () => {
    const r = run({
      summary: [{ t: 'Gabbar asks how many men there were.', ids: ['E1', 'E2'] }],
      ignored: [
        { id: 'E2', why: '  off topic  ' },
        { id: 'E7', why: 'unknown' },
      ],
    });
    expect(r.card?.summary[0]?.sources).toEqual([3, 5]);
    expect(r.card && 'notUsed' in r && r.notUsed).toEqual([{ source: 5, why: 'off topic' }]);
  });

  it('returns nothing_left when every summary line fails', () => {
    expect(run({ summary: [{ t: 'Gabbar asks.', ids: ['E9'] }] })).toEqual({
      card: null,
      reason: 'nothing_left',
    });
  });

  it('drops a line over 280 characters', () => {
    const long = `It is a famous scene ${'and '.repeat(80)}`;
    const c = card({
      summary: [
        { t: long, ids: ['E1'] },
        { t: 'It is a famous scene.', ids: ['E1'] },
      ],
    });
    expect(c.summary).toHaveLength(1);
  });
});
