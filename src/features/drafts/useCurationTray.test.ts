import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../../api/_lib/cardTypes.js';
import type { Interpretation, Reference } from '../../domain/types';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import type { WebResult } from '../../services/retrieval/webSearch';
import { type Frame, framesFrom } from './frames';
import { useCurationTray } from './useCurationTray';

const candidate = (id: string, publisher = 'Wikipedia', excerpt?: string) =>
  ({
    id,
    title: `Doctor Doom ${id}`,
    sources: [{ url: `https://en.wikipedia.org/wiki/${id}`, publisher, excerpt }],
  }) as unknown as RetrievedCandidate;
const web = (n: number | string, url = `https://www.site${n}.com/doom`) =>
  ({ title: `Doctor Doom ${n}`, url, snippet: `Doctor Doom snippet ${n}` }) as WebResult;
const app = { id: 'r1', title: 'Doctor Doom' } as Reference;
const interp = { label: 'doom', summary: 'Doom sum', context: 'Doom ctx' } as Interpretation;

const frames = (o: Partial<Parameters<typeof framesFrom>[0]>) =>
  framesFrom({ candidates: [], webResults: [], appCards: [], ...o });

describe('framesFrom', () => {
  it('maps the three kinds and skips unknown publishers', () => {
    const out = frames({
      candidates: [
        candidate('a', 'Wikipedia', 'Exc'),
        {
          ...candidate('b', 'Other'),
          sources: [{ url: 'https://example.com/b', publisher: 'Other' }],
        } as unknown as RetrievedCandidate,
      ],
      webResults: [web(1)],
      appCards: [{ reference: app, interpretation: interp, own: true }],
    });
    expect(out.map((f) => [f.kind, f.from, f.line])).toEqual([
      ['wiki', 'wikipedia', 'Exc'],
      ['web', 'site1.com', 'Doctor Doom snippet 1'],
      ['app', 'your card', 'Doom sum'],
    ]);
    expect(out[2].text).toBe('Doom sum Doom ctx');
  });

  it('collapses the same URL from two places into one frame', () => {
    const out = frames({
      candidates: [candidate('a')],
      webResults: [web('x', 'https://en.wikipedia.org/wiki/a'), web(2)],
    });
    expect(out.map((f) => f.kind)).toEqual(['wiki', 'web']);
  });
});

describe('useCurationTray', () => {
  const pick = (hook: { result: { current: ReturnType<typeof useCurationTray> } }, f: Frame) => {
    let r = '';
    act(() => {
      r = hook.result.current.toggleFrame(f);
    });
    return r;
  };
  const start = () => renderHook(() => useCurationTray('doctor doom'));

  it('refuses a 7th frame and a 4th web frame', () => {
    const hook = start();
    const webs = frames({ webResults: [1, 2, 3, 4].map((n) => web(n)) });
    expect(webs.slice(0, 3).map((f) => pick(hook, f))).toEqual(['added', 'added', 'added']);
    expect(pick(hook, webs[3])).toBe('limit_web');
    const wikis = frames({ candidates: ['a', 'b', 'c', 'd'].map((i) => candidate(i)) });
    wikis.slice(0, 3).forEach((f) => pick(hook, f));
    expect(hook.result.current.picked).toHaveLength(LIMITS.sources);
    expect(pick(hook, wikis[3])).toBe('limit_total');
    expect(pick(hook, webs[0])).toBe('removed');
  });

  it('refuses a 3rd tone card', () => {
    const hook = start();
    const out: string[] = [];
    ['a', 'b', 'c'].forEach((l) =>
      act(() => {
        out.push(
          hook.result.current.toggleTone({
            label: l,
            gist: l,
            means: '',
            reply: '',
            summary: l,
          }),
        );
      }),
    );
    expect(out).toEqual(['added', 'added', 'limit']);
  });

  it('flags an off-topic frame and blocks Make until kept or removed', () => {
    const hook = start();
    const [good] = frames({ webResults: [web(1)] });
    const off: Frame = {
      ...good,
      key: 'https://x.com/',
      url: 'https://x.com/',
      title: 'Cats',
      line: 'cats',
      text: 'cats',
    };
    expect(hook.result.current.canMake).toBe(false);
    pick(hook, good);
    pick(hook, off);
    expect(hook.result.current.flags[off.key]).toBe('off_topic');
    expect(hook.result.current.canMake).toBe(false);
    act(() => hook.result.current.keepFlagged(off.key));
    expect(hook.result.current.canMake).toBe(true);
    pick(hook, off);
    pick(hook, off);
    expect(hook.result.current.canMake).toBe(false);
    pick(hook, off);
    expect(hook.result.current.canMake).toBe(true);
  });

  it('builds a request body within the limits', () => {
    const hook = start();
    const long = 'doom '.repeat(400);
    const [w] = frames({ webResults: [{ ...web(1), snippet: long } as WebResult] });
    const [c] = frames({ candidates: [candidate('a', 'Wikipedia', long)] });
    pick(hook, w);
    pick(hook, c);
    expect(hook.result.current.body()).not.toHaveProperty('about');
    const body = hook.result.current.body(['x']);
    expect(body.about).toEqual(['x']);
    expect(body).not.toHaveProperty('tones');
    expect(body.sources[0]).toMatchObject({ kind: 'web', url: w.url });
    expect(body.sources[1]).not.toHaveProperty('url');
    body.sources.forEach((s) => expect(s.text!.length).toBeLessThanOrEqual(LIMITS.itemChars));
  });
});
