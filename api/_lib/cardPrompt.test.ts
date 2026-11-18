import { describe, expect, it } from 'vitest';
import { ANSWER_SCHEMA, PREFIX, PROMPT_VERSION, requestText } from './cardPrompt.js';
import * as again from './cardPrompt.js';

const evidence = [
  {
    id: 'E1',
    role: 'meaning' as const,
    from: 'wiktionary',
    title: 'no cap',
    text: 'Slang: no lie.',
    source: 0,
  },
  {
    id: 'E2',
    role: 'usage' as const,
    from: 'reddit.com',
    title: 'no cap',
    text: 'Best pizza ever, no cap.',
    source: 1,
  },
];

describe('PREFIX', () => {
  it('is identical on every call', () => {
    expect(again.PREFIX).toBe(PREFIX);
    expect(PROMPT_VERSION).toBe('card-draft-v6');
  });

  it('is over the 1,024-token cache minimum', () => {
    expect(PREFIX.length).toBeGreaterThanOrEqual(4200);
  });
});

describe('requestText', () => {
  it('puts search, about, evidence, then tone examples, in TOON', () => {
    const tones = [{ label: 'L', gist: 'G', means: 'M', reply: 'R', summary: 'S' }];
    const text = requestText({ search: 'no cap', about: ['slang'], evidence, tones });
    expect(text.indexOf('search')).toBeLessThan(text.indexOf('about'));
    expect(text.indexOf('about')).toBeLessThan(text.indexOf('evidence'));
    expect(text.indexOf('evidence')).toBeLessThan(text.indexOf('tone_examples'));
    expect(text).toMatchInlineSnapshot(`
      "search: no cap
      about[1]: slang
      evidence[2]{id,role,from,title,text}:
        E1,meaning,wiktionary,no cap,"Slang: no lie."
        E2,usage,reddit.com,no cap,"Best pizza ever, no cap."
      tone_examples[1]{note,label,gist,means,reply,summary}:
        About something else. Tone and length only.,L,G,M,R,S"
    `);
  });

  it('leaves out about and tone examples when there are none, and never sends source', () => {
    const text = requestText({ search: 'no cap', about: [], evidence, tones: [] });
    expect(text).not.toContain('about');
    expect(text).not.toContain('tone_examples');
    expect(text).not.toContain('source');
  });
});

interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  anyOf?: Schema[];
}

function strictProblems(node: Schema, path: string): string[] {
  const out: string[] = [];
  if (node.type === 'object') {
    const keys = Object.keys(node.properties ?? {});
    if (node.additionalProperties !== false) out.push(`${path}: additionalProperties`);
    if ([...(node.required ?? [])].sort().join() !== [...keys].sort().join()) {
      out.push(`${path}: required`);
    }
    for (const k of keys) out.push(...strictProblems(node.properties![k], `${path}.${k}`));
  }
  if (node.items) out.push(...strictProblems(node.items, `${path}[]`));
  for (const a of node.anyOf ?? []) out.push(...strictProblems(a, `${path}|`));
  return out;
}

describe('ANSWER_SCHEMA', () => {
  it('lists every property as required and allows nothing extra', () => {
    expect(strictProblems(ANSWER_SCHEMA as Schema, 'root')).toEqual([]);
    const keys = Object.keys(ANSWER_SCHEMA.properties);
    expect(keys[keys.length - 1]).toBe('ignored');
    expect(ANSWER_SCHEMA.required[ANSWER_SCHEMA.required.length - 1]).toBe('ignored');
    expect(ANSWER_SCHEMA.required).toContain('ignored');
  });
});
