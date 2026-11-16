import type { Remote } from 'comlink';
import { firstValueFrom, toArray } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Source } from '../../domain/types';
import { makeReference } from '../../test/factories';
import {
  checkExplanation,
  checkRewrites,
  decideSpoiler,
  isGrounded,
  mergeResults,
  parseJson,
} from './check';
import {
  createLlmClient,
  detectSupport,
  pickVariant,
  RUN_TIMEOUT_MS,
  type LlmWorkerApi,
  type WorkerConnection,
} from './client';
import {
  buildEvidence,
  encodeEvidence,
  MAX_EVIDENCE_CHARS,
  parseStory,
  type EvidenceItem,
} from './evidence';
import { toInterpretation } from './interpretation';
import { explainJob } from './jobs';
import { MODEL_FAMILIES } from './models';

const NOW = '2026-11-16T12:00:00.000Z';

// The crash guard keeps its marker in localStorage; every test starts without one.
beforeEach(() => localStorage.clear());

function source(id: string, publisher: string, excerpt?: string): Source {
  return {
    id,
    url: `https://example.org/${encodeURIComponent(id)}`,
    title: 'Title',
    publisher,
    sourceType: 'other',
    retrievedAt: NOW,
    license: 'CC BY-SA 4.0',
    excerpt,
  };
}

const doomSources = [
  source('src:wd:Q1192921', 'Wikidata'),
  source(
    'src:enwiki:1',
    'Wikipedia',
    'Doctor Doom is a supervillain appearing in American comic books published by Marvel Comics.',
  ),
];
const doom = makeReference('wd:Q1192921', 'Doctor Doom', {
  editorialState: 'retrieved',
  kind: 'character',
  category: 'comics',
  creators: ['Jack Kirby', 'Stan Lee'],
  firstAppearance: 'Fantastic Four #5',
});

const evidence: EvidenceItem[] = [
  {
    id: 'E1',
    from: 'Wikidata',
    text: 'Created by Jack Kirby and Stan Lee.',
    sourceIds: ['src:wd:Q1'],
    plot: false,
  },
  {
    id: 'E2',
    from: 'Wikipedia',
    text: 'Doctor Doom is a supervillain appearing in American comic books published by Marvel Comics.',
    sourceIds: ['src:enwiki:1'],
    plot: false,
  },
  {
    id: 'E3',
    from: 'Wikipedia',
    text: 'Victor von Doom was disfigured in a lab accident and later became ruler of Latveria.',
    sourceIds: ['src:enwiki:1#Fictional_character_biography'],
    plot: true,
  },
];

describe('isGrounded', () => {
  const cited = evidence.map((e) => e.text).join(' ');

  it('accepts a plain paraphrase whose names and most words are in the evidence', () => {
    expect(isGrounded('Doctor Doom is a supervillain in Marvel comic books.', cited)).toBe(true);
    expect(isGrounded("Doom's creators were Jack Kirby and Stan Lee.", cited)).toBe(true);
  });

  it('rejects a name, number or quotation the evidence does not contain', () => {
    expect(isGrounded('Doctor Doom was created by Steve Ditko.', cited)).toBe(false);
    expect(isGrounded('Doctor Doom first appeared in 1962.', cited)).toBe(false);
    expect(isGrounded('Doom often says “Doom wins”.', cited)).toBe(false);
  });

  it('rejects an invented event, a reversed meaning, or a word that only matches inside another', () => {
    const doom =
      'Doctor Doom is a supervillain appearing in American comic books published by Marvel Comics. He is the ruler of Latveria.';
    expect(isGrounded('Doctor Doom dies.', doom)).toBe(false);
    expect(isGrounded('Doctor Doom was never a supervillain in Marvel Comics.', doom)).toBe(false);
    expect(isGrounded("Doctor Doom isn't a supervillain.", doom)).toBe(false);
    expect(isGrounded('He dies.', 'He studies science.')).toBe(false);
    expect(isGrounded('Doom has a son.', doom)).toBe(false);
    expect(isGrounded('Doctor Doom is the ruler of Latveria.', doom)).toBe(true);
  });

  it('rejects a sentence mostly made of words the evidence never uses', () => {
    expect(isGrounded('Doom is beloved, misunderstood, tragic and heroic overall.', cited)).toBe(
      false,
    );
  });
});

const cite = (text: string, ...ids: string[]) => ({ text, ids });

describe('checkExplanation', () => {
  it('keeps cited, grounded sentences per field and maps evidence IDs to real source IDs', () => {
    const result = checkExplanation(
      {
        meaning: [cite('Doctor Doom is a Marvel Comics supervillain.', 'E2')],
        context: [cite('Victor von Doom became ruler of Latveria after a lab accident.', 'E3')],
        spoiler: 'none',
        uncertainty: 'low',
      },
      evidence,
    );
    expect(result.meaning).toEqual([
      {
        text: 'Doctor Doom is a Marvel Comics supervillain.',
        evidenceIds: ['E2'],
        sourceIds: ['src:enwiki:1'],
        plot: false,
      },
    ]);
    expect(result.context[0]).toMatchObject({
      sourceIds: ['src:enwiki:1#Fictional_character_biography'],
      plot: true,
    });
    // The model said "none", but a kept sentence cites story text: plot always means major.
    expect(result.spoiler).toBe('major');
    expect(result.uncertainty).toBe('low');
  });

  it('drops sentences with no citation, an unknown ID, unsupported content or a repeat', () => {
    const result = checkExplanation(
      {
        meaning: [
          cite('Doctor Doom is a supervillain.'),
          cite('Doctor Doom is a supervillain.', 'E9'),
        ],
        context: [
          cite('Doctor Doom fights Iron Man.', 'E2'),
          cite('Doctor Doom is a supervillain.', 'E2'),
          cite('Doctor Doom is a supervillain.', 'E2'),
        ],
        spoiler: 'none',
        uncertainty: 'low',
      },
      evidence,
    );
    expect(result.meaning).toEqual([]);
    expect(result.context).toHaveLength(1);
    expect(result.dropped.map((d) => `${d.field}:${d.reason}`)).toEqual([
      'meaning:no_citation',
      'meaning:unknown_id',
      'context:ungrounded',
      'context:duplicate',
    ]);
  });

  it('drops an origin or date claim its evidence does not make', () => {
    const result = checkExplanation(
      {
        meaning: [cite('Doctor Doom is a supervillain.', 'E2')],
        context: [
          cite(
            'Doctor Doom originated as a supervillain in American comic books published by Marvel.',
            'E2',
          ),
        ],
        spoiler: 'none',
        uncertainty: 'low',
      },
      evidence,
    );
    expect(result.dropped).toEqual([
      {
        field: 'context',
        text: 'Doctor Doom originated as a supervillain in American comic books published by Marvel.',
        reason: 'unsupported_origin',
      },
    ]);
  });

  it('keeps an example only when it is copied word for word from what it cites', () => {
    const base = {
      meaning: [cite('Doctor Doom is a supervillain.', 'E2')],
      spoiler: 'none',
      uncertainty: 'low',
    };
    const quoted = checkExplanation(
      { ...base, example: { quote: 'ruler of Latveria', ids: ['E3'] } },
      evidence,
    );
    expect(quoted.example?.text).toBe('ruler of Latveria');
    const invented = checkExplanation(
      { ...base, example: { quote: 'Doom always wins', ids: ['E2'] } },
      evidence,
    );
    expect(invented.example).toBeUndefined();
    expect(invented.dropped).toEqual([
      { field: 'example', text: 'Doom always wins', reason: 'not_a_quote' },
    ]);
  });

  it('drops over-long sentences and anything past each field limit', () => {
    const ok = 'Doctor Doom is a supervillain.';
    const result = checkExplanation(
      {
        meaning: [
          cite(`${ok} ${'And a supervillain. '.repeat(20)}`, 'E2'),
          cite(ok, 'E2'),
          cite('Doom is in comic books.', 'E2'),
        ],
        spoiler: 'none',
        uncertainty: 'low',
      },
      evidence,
    );
    expect(result.dropped.map((d) => d.reason)).toEqual(['too_long', 'too_many']);
  });

  it('fails closed on invalid fields: unsure spoiler means major, unknown uncertainty means high', () => {
    const result = checkExplanation(
      {
        meaning: [cite('Doctor Doom is a supervillain.', 'E2'), 'oops'],
        context: 'not a list',
        spoiler: 'unsure',
        uncertainty: 'none',
      },
      evidence,
    );
    expect(result.meaning).toHaveLength(1);
    expect(result.dropped.map((d) => `${d.field}:${d.reason}`)).toEqual([
      'meaning:invalid',
      'context:invalid',
    ]);
    expect(result).toMatchObject({ spoiler: 'major', uncertainty: 'high' });
  });

  it('reads answers that carry the empty think block Qwen3 adds when thinking is off', () => {
    expect(parseJson('<think>\n\n</think>\n\n{"queries":["cash me outside"]}')).toEqual({
      queries: ['cash me outside'],
    });
  });

  it('treats malformed output as invalid, never as content', () => {
    expect(checkExplanation(parseJson('{"meaning": [ oops'), evidence)).toMatchObject({
      valid: false,
      meaning: [],
      spoiler: 'major',
    });
    expect(
      checkExplanation({ sentences: [cite('Doctor Doom is a supervillain.', 'E2')] }, evidence)
        .valid,
    ).toBe(false);
  });
});

describe('toInterpretation', () => {
  const wikipedia = source('src:enwiki:1', 'Wikipedia', 'Doctor Doom is a supervillain.');
  const story = source('src:enwiki:1#Fictional_character_biography', 'Wikipedia');
  const reference = makeReference('enwiki:1', 'Doctor Doom', {
    editorialState: 'retrieved',
    kind: 'character',
    category: 'comics',
  });
  const map = (output: unknown, sources = [wikipedia, story]) =>
    toInterpretation(checkExplanation(output, evidence), reference, sources, NOW);

  it('maps a fully grounded answer onto an interpretation that is model_suggested and supported', () => {
    const result = map({
      meaning: [cite('Doctor Doom is a Marvel Comics supervillain.', 'E2')],
      context: [cite('He appears in American comic books.', 'E2')],
      example: { quote: 'published by Marvel Comics', ids: ['E2'] },
      spoiler: 'none',
      uncertainty: 'medium',
    });
    expect(result).toEqual({
      uncertainty: 'medium',
      interpretation: {
        id: 'enwiki:1#model',
        referenceId: 'enwiki:1',
        label: 'In plain words (AI)',
        summary: 'Doctor Doom is a Marvel Comics supervillain.',
        context: 'He appears in American comic books.',
        usageExample: '“published by Marvel Comics”',
        spoiler: 'none',
        sourceIds: ['src:enwiki:1'],
        provenance: 'model_suggested',
        evidence: 'supported',
        selection: null,
        relation: 'related',
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
  });

  it('leaves out an invented example and an ungrounded context sentence', () => {
    const result = map({
      meaning: [cite('Doctor Doom is a supervillain.', 'E2')],
      context: [cite('Doctor Doom fights Iron Man.', 'E2')],
      example: { quote: 'Doom always wins', ids: ['E2'] },
      spoiler: 'none',
      uncertainty: 'low',
    });
    expect(result?.interpretation).toMatchObject({ context: '', usageExample: '' });
  });

  it('returns nothing when no meaning survives, so the curator text stays', () => {
    expect(
      map({
        meaning: [cite('Doctor Doom fights Iron Man.', 'E2')],
        spoiler: 'none',
        uncertainty: 'low',
      }),
    ).toBeUndefined();
    expect(
      map({
        meaning: [cite('Doctor Doom is a supervillain.', 'E7')],
        spoiler: 'none',
        uncertainty: 'low',
      }),
    ).toBeUndefined();
    expect(map(undefined)).toBeUndefined();
  });

  it('marks plot content major whatever the model said', () => {
    const result = map({
      meaning: [cite('Victor von Doom is the ruler of Latveria.', 'E3')],
      spoiler: 'none',
      uncertainty: 'low',
    });
    expect(result?.interpretation.spoiler).toBe('major');
  });

  it('is uncertain, never source_supported, when a cited source is not held', () => {
    const result = map(
      {
        meaning: [cite('Doctor Doom is a supervillain.', 'E2')],
        spoiler: 'none',
        uncertainty: 'low',
      },
      [story],
    );
    expect(result?.interpretation).toMatchObject({
      provenance: 'model_suggested',
      evidence: 'uncertain',
    });
  });
});

describe('decideSpoiler', () => {
  it('shows a line only when both framings say it is safe', () => {
    expect(decideSpoiler('Winter is coming.', { verdict: 'safe' }, { answer: 'no' })).toEqual({
      show: true,
      reason: 'both_safe',
    });
    expect(decideSpoiler('Winter is coming.', { verdict: 'safe' }, { answer: 'unsure' }).show).toBe(
      false,
    );
    expect(decideSpoiler('Winter is coming.', { verdict: 'unsure' }, { answer: 'no' }).show).toBe(
      false,
    );
    expect(decideSpoiler('Winter is coming.', undefined, { answer: 'no' }).show).toBe(false);
  });

  it('keeps lines with spoiler words hidden whatever the model says', () => {
    expect(decideSpoiler('No, I am your father.', { verdict: 'safe' }, { answer: 'no' })).toEqual({
      show: false,
      reason: 'hint_word',
    });
    expect(decideSpoiler('He dies at the end.', { verdict: 'safe' }, { answer: 'no' }).show).toBe(
      false,
    );
  });
});

describe('checkRewrites', () => {
  it('keeps at most three distinct short search strings that differ from the query', () => {
    expect(
      checkRewrites(
        {
          queries: [
            'Cash me outside',
            'catch me outside',
            'cash me outside',
            'cash me ousside how bow dah',
            'bhad bhabie',
            'extra',
          ],
        },
        'catch me outside',
      ),
    ).toEqual(['Cash me outside', 'cash me ousside how bow dah', 'bhad bhabie']);
  });

  it('drops answers, links and non-strings', () => {
    expect(
      checkRewrites(
        {
          queries: [
            'It is a meme from a 2016 Dr. Phil episode with Danielle Bregoli',
            'https://example.org',
            42,
            '',
          ],
        },
        'catch me outside',
      ),
    ).toEqual([]);
    expect(checkRewrites(undefined, 'x')).toEqual([]);
  });
});

describe('mergeResults', () => {
  it('keeps the original first, then takes turns, without repeats', () => {
    const ids = (...xs: string[]) => xs.map((id) => ({ id }));
    expect(mergeResults([ids('a', 'b', 'c'), ids('x', 'a'), ids('y')]).map((r) => r.id)).toEqual([
      'a',
      'x',
      'y',
      'b',
      'c',
    ]);
    expect(mergeResults([ids('a', 'b'), ids('c', 'd')], 3).map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });
});

describe('buildEvidence', () => {
  it('lists the curator facts, then the excerpts, with short IDs and their real sources', () => {
    const items = buildEvidence(doom, doomSources);
    expect(items.map((i) => [i.id, i.from, i.sourceIds])).toEqual([
      ['E1', 'Wikidata', ['src:wd:Q1192921']],
      ['E2', 'Wikidata', ['src:wd:Q1192921']],
      ['E3', 'Wikidata', ['src:wd:Q1192921']],
      ['E4', 'Wikipedia', ['src:enwiki:1']],
    ]);
    expect(items[0]?.text).toBe('“Doctor Doom” is a comics character.');
    expect(items.every((i) => !i.plot)).toBe(true);
  });

  it('leaves out curator facts whose source the app no longer holds', () => {
    const items = buildEvidence(doom, doomSources.slice(1));
    expect(items.map((i) => i.from)).toEqual(['Wikipedia']);
  });

  it('does not repeat a quote or dictionary excerpt as a fact', () => {
    const quote = makeReference('enwikiquote:5', 'Thor: Ragnarok', { editorialState: 'retrieved' });
    const items = buildEvidence(quote, [source('src:enwikiquote:5', 'Wikiquote', 'Point Break!')]);
    expect(items.map((i) => i.text)).toEqual(['Point Break!']);
  });

  it('stops adding evidence at the fixed input budget', () => {
    const paragraph = 'x'.repeat(600);
    const story = {
      source: source('src:enwiki:1#Fictional_character_biography', 'Wikipedia'),
      paragraphs: Array(10).fill(paragraph),
    };
    const items = buildEvidence(undefined, [], story);
    expect(items).toHaveLength(Math.floor(MAX_EVIDENCE_CHARS / paragraph.length));
  });

  it('marks story paragraphs as plot', () => {
    const story = {
      source: source('src:enwiki:1#Fictional_character_biography', 'Wikipedia'),
      paragraphs: ['A.', 'B.'],
    };
    expect(buildEvidence(undefined, [], story).map((i) => [i.id, i.plot])).toEqual([
      ['E1', true],
      ['E2', true],
    ]);
  });
});

describe('encodeEvidence', () => {
  it('shows the model only ID, publisher and text, as JSON or TOON', () => {
    const json = parseJson(encodeEvidence(evidence.slice(0, 1), 'json'));
    expect(json).toEqual({
      evidence: [{ id: 'E1', from: 'Wikidata', text: 'Created by Jack Kirby and Stan Lee.' }],
    });
    const toon = encodeEvidence(evidence.slice(0, 1), 'toon');
    expect(toon).toContain('evidence[1]');
    expect(toon).not.toContain('src:');
  });

  it('puts the evidence IDs into the schema so decoding cannot invent one', () => {
    const job = explainJob('Explain “Doctor Doom”.', evidence, 'json');
    expect(JSON.stringify(job.schema)).toContain('"enum":["E1","E2","E3"]');
  });
});

describe('parseStory', () => {
  const page = (extract: string) => ({
    query: {
      pages: [
        {
          pageid: 7,
          title: 'Doctor Doom',
          fullurl: 'https://en.wikipedia.org/wiki/Doctor_Doom',
          extract,
        },
      ],
    },
  });

  it('takes only the biography section, skipping subheadings, and cites it apart from the page', () => {
    const story = parseStory(
      page(
        'Lead text.\n\n== Publication history ==\nPublished.\n\n== Fictional character biography ==\n=== Origin ===\nVictor was born in Latveria.\n\nHe studied science.\n\n== Powers ==\nArmour.',
      ),
      NOW,
    );
    expect(story?.paragraphs).toEqual(['Victor was born in Latveria.', 'He studied science.']);
    expect(story?.source).toMatchObject({
      id: 'src:enwiki:7#Fictional_character_biography',
      url: 'https://en.wikipedia.org/wiki/Doctor_Doom#Fictional_character_biography',
      publisher: 'Wikipedia',
    });
  });

  it('links to whichever biography heading the page uses', () => {
    const story = parseStory(page('Lead.\n\n== Fictional biography ==\nShe fought crime.'), NOW);
    expect(story?.source.url).toBe('https://en.wikipedia.org/wiki/Doctor_Doom#Fictional_biography');
  });

  it('returns nothing for a page without a story section or a malformed response', () => {
    expect(parseStory(page('Lead.\n\n== Plot ==\nText.'), NOW)).toBeUndefined();
    expect(parseStory({ query: { pages: [{}] } }, NOW)).toBeUndefined();
  });
});

describe('detectSupport', () => {
  const limits = { maxBufferSize: 2 ** 31, maxStorageBufferBindingSize: 2 ** 30 };
  const adapter = (features: string[], overrides = {}) => ({
    features: new Set(features),
    limits: { ...limits, ...overrides },
    info: { vendor: 'qualcomm', architecture: 'adreno-7xx' },
  });

  it('reports no model without WebGPU, an adapter, enough memory or big enough GPU buffers', async () => {
    expect(await detectSupport({})).toEqual({ ok: false, reason: 'no_webgpu' });
    expect(await detectSupport({ gpu: { requestAdapter: async () => null } })).toEqual({
      ok: false,
      reason: 'no_adapter',
    });
    expect(
      await detectSupport({ gpu: { requestAdapter: () => Promise.reject(new Error('x')) } }),
    ).toEqual({ ok: false, reason: 'no_adapter' });
    expect(
      await detectSupport({ deviceMemory: 2, gpu: { requestAdapter: async () => adapter([]) } }),
    ).toEqual({ ok: false, reason: 'low_memory' });
    expect(
      await detectSupport({
        gpu: { requestAdapter: async () => adapter([], { maxStorageBufferBindingSize: 2 ** 26 }) },
      }),
    ).toEqual({ ok: false, reason: 'gpu_limits' });
  });

  it('sets the memory budget from device memory, assuming 4 GB when the browser does not say', async () => {
    const on = async (deviceMemory?: number) =>
      detectSupport({ deviceMemory, gpu: { requestAdapter: async () => adapter([]) } });
    expect(await on(8)).toMatchObject({ ok: true, memoryBudgetMB: 3276 });
    expect(await on(4)).toMatchObject({ ok: true, memoryBudgetMB: 1638 });
    expect(await on(undefined)).toMatchObject({ ok: true, memoryBudgetMB: 1638 });
  });

  it('picks q4f16 only with shader-f16, and nothing that exceeds the budget', async () => {
    const family = MODEL_FAMILIES[0]!;
    const withF16 = await detectSupport({
      deviceMemory: 8,
      gpu: { requestAdapter: async () => adapter(['shader-f16']) },
    });
    const without = await detectSupport({
      deviceMemory: 8,
      gpu: { requestAdapter: async () => adapter([]) },
    });
    const small = await detectSupport({
      deviceMemory: 4,
      gpu: { requestAdapter: async () => adapter([]) },
    });
    expect(withF16.ok && pickVariant(family, withF16)?.modelId).toBe(family.f16.modelId);
    expect(without.ok && pickVariant(family, without)?.modelId).toBe(family.f32.modelId);
    // q4f32 Qwen3 0.6B needs ~1925 MB: over a 4 GB device's 1638 MB budget.
    expect(small.ok && pickVariant(family, small)).toBeUndefined();
  });
});

describe('MODEL_FAMILIES', () => {
  it('pins every download to a commit and hashes the code and config it runs', () => {
    for (const variant of MODEL_FAMILIES.flatMap((f) => [f.f16, f.f32])) {
      expect(variant.record.model).toMatch(
        /^https:\/\/huggingface\.co\/mlc-ai\/[^/]+\/resolve\/[0-9a-f]{40}\/$/,
      );
      expect(variant.record.model_lib).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/mlc-ai\/binary-mlc-llm-libs\/[0-9a-f]{40}\//,
      );
      const integrity = variant.record.integrity;
      for (const sri of [
        integrity?.model_lib,
        integrity?.config,
        integrity?.tokenizer?.['tokenizer.json'],
      ]) {
        expect(sri).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
      }
      expect(integrity?.onFailure).toBe('error');
      expect(variant.record.required_features?.includes('shader-f16') ?? false).toBe(
        variant.needsShaderF16,
      );
      expect(variant.record.overrides?.context_window_size).toBe(3072);
    }
  });
});

/** A stand-in for the Comlink-wrapped worker: `api` methods are plain async functions. */
function fakeConnection(api: Partial<LlmWorkerApi>) {
  const crashListeners = new Set<(error: Error) => void>();
  const connection = {
    terminated: 0,
    api: api as unknown as Remote<LlmWorkerApi>,
    terminate() {
      connection.terminated++;
    },
    onCrash(listener: (error: Error) => void) {
      crashListeners.add(listener);
      return () => crashListeners.delete(listener);
    },
    crash: (error: Error) => crashListeners.forEach((l) => l(error)),
  };
  return connection;
}

const job = { system: 's', user: 'u', schema: {}, maxTokens: 10 };
const result = {
  text: '{"queries":[]}',
  promptTokens: 40,
  completionTokens: 5,
  firstTokenMs: 120,
  totalMs: 300,
  decodeTokensPerSecond: 20,
  finishReason: 'stop',
};

describe('createLlmClient', () => {
  const family = MODEL_FAMILIES[0]!;
  const variant = family.f16;
  const consent = { modelId: variant.modelId, bytes: variant.downloadBytes };
  const loads: LlmWorkerApi['load'] = async (_record, _thinking, onProgress) => {
    onProgress({ progress: 0.5, text: 'Fetching' });
    return { ms: 900, fromCache: false };
  };

  it('refuses to load without consent for that exact download, and starts no worker', async () => {
    let created = 0;
    const client = createLlmClient(() => {
      created++;
      return fakeConnection({}) as WorkerConnection;
    });
    await expect(
      firstValueFrom(client.load(family, variant, { ...consent, bytes: 1 })),
    ).rejects.toThrow('No consent');
    await expect(firstValueFrom(client.load(family, family.f32, consent))).rejects.toThrow(
      'No consent',
    );
    await expect(firstValueFrom(client.run(job))).rejects.toThrow('Model not ready');
    expect(created).toBe(0);
  });

  it('streams load progress, then runs jobs and returns their timings', async () => {
    const connection = fakeConnection({ load: loads, run: async () => result });
    const client = createLlmClient(() => connection);
    const events = await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    expect(events.map((e) => e.type)).toEqual(['progress', 'loaded']);
    expect(await firstValueFrom(client.run(job))).toEqual(result);
  });

  it('stays ready when a progress message arrives after loading finished', async () => {
    // Comlink sends progress on its own message channel, so it can land after the load result.
    let lateProgress: () => void = () => {};
    const connection = fakeConnection({
      load: async (_record, _thinking, onProgress) => {
        lateProgress = () => onProgress({ progress: 1, text: 'Finish loading' });
        return { ms: 900, fromCache: true };
      },
      run: async () => result,
    });
    const client = createLlmClient(() => connection);
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    lateProgress();
    expect(client.status().state).toBe('ready');
    expect(await firstValueFrom(client.run(job))).toEqual(result);
  });

  it('keeps one worker per model: loading again terminates the previous one', async () => {
    const connections = [fakeConnection({ load: loads }), fakeConnection({ load: loads })];
    let next = 0;
    const client = createLlmClient(() => connections[next++]!);
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    expect(connections.map((c) => c.terminated)).toEqual([1, 0]);
  });

  it('interrupts the generation when the caller unsubscribes', async () => {
    let interrupted = 0;
    const connection = fakeConnection({
      load: loads,
      run: () => new Promise(() => {}),
      interrupt: async () => {
        interrupted++;
      },
    });
    const client = createLlmClient(() => connection);
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    client.run(job).subscribe().unsubscribe();
    expect(interrupted).toBe(1);
    expect(connection.terminated).toBe(0);
  });

  it('terminates the worker on a failed run or a crash, and does not retry', async () => {
    let runs = 0;
    const failing = fakeConnection({
      load: loads,
      run: async () => {
        runs++;
        throw new RangeError('Array buffer allocation failed');
      },
    });
    const client = createLlmClient(() => failing);
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    await expect(firstValueFrom(client.run(job))).rejects.toThrow('allocation failed');
    expect(failing.terminated).toBe(1);
    await expect(firstValueFrom(client.run(job))).rejects.toThrow('Model not ready');
    expect(runs).toBe(1);

    const crashing = fakeConnection({ load: loads, run: () => new Promise(() => {}) });
    const second = createLlmClient(() => crashing);
    await firstValueFrom(second.load(family, variant, consent).pipe(toArray()));
    const pending = firstValueFrom(second.run(job));
    crashing.crash(new Error('Device lost'));
    await expect(pending).rejects.toThrow('Device lost');
    expect(crashing.terminated).toBe(1);
  });

  it('ends a call in flight when the worker is disposed, instead of leaving it hanging', async () => {
    const connection = fakeConnection({ load: () => new Promise(() => {}) });
    const client = createLlmClient(() => connection);
    const pending = firstValueFrom(client.load(family, variant, consent));
    client.dispose();
    await expect(pending).rejects.toThrow('unloaded');
  });

  it('cancels an unfinished download by terminating the worker', () => {
    const connection = fakeConnection({ load: () => new Promise(() => {}) });
    const client = createLlmClient(() => connection);
    client.load(family, variant, consent).subscribe().unsubscribe();
    expect(connection.terminated).toBe(1);
  });

  it('reports its status: off, loading, ready, then off again after the idle time', async () => {
    vi.useFakeTimers();
    try {
      let finishLoad: (r: { ms: number; fromCache: boolean }) => void = () => {};
      const connection = fakeConnection({
        load: (_record, _thinking, onProgress) => {
          onProgress({ progress: 0.4, text: 'Fetching' });
          return new Promise((resolve) => (finishLoad = resolve));
        },
        run: async () => result,
      });
      const client = createLlmClient(() => connection, 1000);
      const states: string[] = [];
      client.status$.subscribe((s) =>
        states.push(s.state === 'loading' ? `loading ${s.progress}` : s.state),
      );
      client.start(family, variant, consent);
      // A caller asking while it loads is told at once to skip, never made to wait.
      let skipped: unknown;
      client.run(job).subscribe({ error: (e: unknown) => (skipped = e) });
      expect(skipped).toBeInstanceOf(Error);
      finishLoad({ ms: 10, fromCache: true });
      for (let i = 0; i < 5; i++) await Promise.resolve();
      expect(client.status().state).toBe('ready');
      expect(await firstValueFrom(client.run(job))).toEqual(result);
      vi.advanceTimersByTime(1000);
      expect(states).toEqual(['off', 'loading 0', 'loading 0.4', 'ready', 'off']);
      expect(connection.terminated).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('becomes unavailable after a failed load, and start() does not try again', async () => {
    let connects = 0;
    const client = createLlmClient(() => {
      connects++;
      return fakeConnection({ load: () => Promise.reject(new Error('Out of memory')) });
    });
    client.start(family, variant, consent);
    await vi.waitFor(() =>
      expect(client.status()).toEqual({ state: 'unavailable', reason: 'Out of memory' }),
    );
    client.start(family, variant, consent);
    expect(connects).toBe(1);
  });

  it('gives up on a run that never answers and frees the worker', async () => {
    vi.useFakeTimers();
    try {
      const connection = fakeConnection({ load: loads, run: () => new Promise(() => {}) });
      const client = createLlmClient(() => connection);
      await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
      const pending = firstValueFrom(client.run(job));
      vi.advanceTimersByTime(RUN_TIMEOUT_MS);
      await expect(pending).rejects.toThrow('did not answer in time');
      expect(connection.terminated).toBe(1);
      expect(client.status().state).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes downloaded files in a short-lived worker and unloads the model', async () => {
    const removed: string[] = [];
    const connections = [
      fakeConnection({ load: loads }),
      fakeConnection({
        remove: async (record) => {
          removed.push(record.model_id);
        },
      }),
    ];
    let next = 0;
    const client = createLlmClient(() => connections[next++]!);
    await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
    await client.remove(variant);
    expect(removed).toEqual([variant.modelId]);
    expect(connections.map((c) => c.terminated)).toEqual([1, 1]);
    expect(client.status().state).toBe('off');
  });

  it('frees the worker after it has been idle', async () => {
    vi.useFakeTimers();
    try {
      const connection = fakeConnection({ load: loads, run: async () => result });
      const client = createLlmClient(() => connection, 1000);
      await firstValueFrom(client.load(family, variant, consent).pipe(toArray()));
      await firstValueFrom(client.run(job));
      vi.advanceTimersByTime(999);
      expect(connection.terminated).toBe(0);
      vi.advanceTimersByTime(1);
      expect(connection.terminated).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
