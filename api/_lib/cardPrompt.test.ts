import { describe, expect, it } from 'vitest';
import {
  ANSWER_SCHEMA,
  PREFIX,
  PROMPT_VERSION,
  TOPIC_PREFIX,
  TOPIC_PROMPT_VERSION,
  requestText,
} from './cardPrompt.js';
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
  it('has an independent coherent topic prefix with multi-entry examples and strict ranking evidence', () => {
    expect(TOPIC_PROMPT_VERSION).not.toBe(PROMPT_VERSION);
    expect(TOPIC_PREFIX).toContain('Anime OR cartoons means the union');
    expect(TOPIC_PREFIX).toContain('one named supported character per summary entry');
    expect(TOPIC_PREFIX).toContain('comparative ordering is unsupported');
    expect(TOPIC_PREFIX).toContain('Example 3 answer:');
    expect(TOPIC_PREFIX).not.toContain('what it means when someone says it to them');
    expect(TOPIC_PREFIX).not.toContain('Closer (The Chainsmokers song)');
  });
  it('is identical on every call', () => {
    expect(again.PREFIX).toBe(PREFIX);
    expect(PROMPT_VERSION).toBe('card-draft-v8');
  });

  it('tells the model example cards steer tone, length and what to include, never facts', () => {
    expect(PREFIX).toContain(
      'Match their tone, length, and what kind of information they include and in what order: never their facts, words or phrases.',
    );
  });

  it('asks for creator, speaker, attitude and every use, but only when an item states them', () => {
    expect(PREFIX).toContain('# What to include');
    expect(PREFIX).toContain(
      'Who says it, and to whom (for example younger people to older ones).',
    );
    expect(PREFIX).toContain(
      'Only what an item states. If no item says it, leave it out, even if you know it: never guess a creator, an attitude or a use.',
    );
    // Context lines stay under cardCheck's 280-character cap.
    expect(PREFIX).toContain('each under 250 characters');
  });

  it('is over the 1,024-token cache minimum', () => {
    expect(PREFIX.length).toBeGreaterThanOrEqual(4200);
  });
});

describe('requestText', () => {
  it('keeps topic intent, retry choices and unverified context separate from evidence', () => {
    const text = requestText({
      search: 'villains',
      evidence,
      kind: 'ranking',
      userContext: 'My theory',
      retry: { preserveSources: [0] },
    });
    expect(text).toContain('kind: ranking');
    expect(text).toContain('unverified context; not evidence');
    expect(text).toContain('My theory');
    expect(text).toContain('requested_source_indices[1]: 0');
    expect(text).toContain('Never invent facts or a comparative rank');
    expect(PREFIX).not.toContain('requested_source_indices');
  });

  it('keeps custom style preferences in the dynamic suffix with evidence constraints', () => {
    const text = requestText({
      search: 'no cap',
      evidence,
      styleGuidance: { tone: 'Warm and funny', structure: 'Short bullets' },
    });
    expect(text).toContain('tone: Warm and funny');
    expect(text).toContain('structure: Short bullets');
    expect(text).toContain('Never use them as facts');
    expect(text.indexOf('style_guidance')).toBeGreaterThan(text.indexOf('evidence'));
    expect(PREFIX).not.toContain('style_guidance');
  });

  it('adds a strict fictional scope after dynamic evidence for animation tags', () => {
    const text = requestText({
      search: 'biggest genocidal maniacs',
      about: ['Anime', 'cartoon'],
      evidence,
    });
    expect(text).toContain('fictional characters, events and works in anime or cartoons');
    expect(text).toContain('Exclude real historical figures');
    expect(text).toContain('set unclear to true');
    expect(text.indexOf('scope_constraint')).toBeGreaterThan(text.indexOf('evidence'));
    expect(PREFIX).not.toContain('scope_constraint');
    expect(requestText({ search: 'no cap', about: ['slang'], evidence })).not.toContain(
      'scope_constraint',
    );
  });

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
        About something else. Tone and length and kind of information only.,L,G,M,R,S"
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

describe('TOPIC_PREFIX explains the subject, not the evidence', () => {
  it('forbids meta lines and asks for a shorter card when evidence is thin', () => {
    expect(TOPIC_PROMPT_VERSION).toBe('topic-card-v2');
    expect(TOPIC_PREFIX).toContain('# Explain the subject, never the evidence');
    expect(TOPIC_PREFIX).toContain('"The evidence identifies three series"');
    expect(TOPIC_PREFIX).toContain('When evidence is thin, write fewer and shorter lines instead.');
    expect(TOPIC_PREFIX).not.toContain('State missing comparison or coverage briefly.');
  });

  it('treats the opening premise as no spoiler and asks for dates exactly as written', () => {
    expect(TOPIC_PREFIX).toContain('The opening premise');
    expect(TOPIC_PREFIX).toContain('is not a spoiler');
    expect(TOPIC_PREFIX).toContain(
      'Copy dates, numbers and names exactly as the passage writes them',
    );
  });

  it('never shows the model a worked answer whose gist or takeaway talks about the evidence', () => {
    const answers = [...TOPIC_PREFIX.matchAll(/^Example \d+ answer:\n(.+)$/gm)].map(
      (m) => JSON.parse(m[1] ?? '{}') as { gist: string; means: string },
    );
    expect(answers).toHaveLength(4);
    for (const { gist, means } of answers) {
      expect(`${gist} ${means}`).not.toMatch(/\b(?:the|these) (?:evidence|sources?|passages?)\b/i);
    }
  });
});
