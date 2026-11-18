import { describe, expect, it, vi } from 'vitest';
import {
  ProviderError,
  cloudflareProvider,
  draftWithFallback,
  openAiProvider,
  providersFromEnv,
  type DraftProvider,
} from './cardProviders.js';
import { PROMPT_VERSION } from './cardPrompt.js';

const input = { prefix: 'PREFIX', user: 'USER', schema: { type: 'object' } };
const signal = new AbortController().signal;
const answer = { label: 'x' };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const openAiOk = (text = JSON.stringify(answer)) =>
  reply({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  });
const mock = (...responses: Response[]) => {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
};
const openAi = (fetchFn: ReturnType<typeof vi.fn>) =>
  openAiProvider({ fetch: fetchFn as unknown as typeof fetch, apiKey: 'sk-secret' });
const cloudflare = (fetchFn: ReturnType<typeof vi.fn>) =>
  cloudflareProvider({
    fetch: fetchFn as unknown as typeof fetch,
    accountId: 'acct-1',
    token: 'cf-secret',
  });
const kindOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => 'no error',
    (e: unknown) => (e instanceof ProviderError ? e.kind : 'other'),
  );

describe('openAiProvider', () => {
  it('sends the OpenAI request with store false, no thinking, the cache breakpoint and the prompt version as cache key', async () => {
    const fetchFn = mock(openAiOk());
    await expect(openAi(fetchFn).draft(input, signal)).resolves.toEqual(answer);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBe(signal);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'gpt-6-luna',
      store: false,
      reasoning: { effort: 'none' },
      temperature: 0.2,
      max_output_tokens: 800,
      prompt_cache_options: { mode: 'explicit', ttl: '30m' },
      prompt_cache_key: PROMPT_VERSION,
      text: { format: { type: 'json_schema', name: 'card', schema: input.schema, strict: true } },
    });
    expect(body.input[0]).toEqual({
      role: 'developer',
      content: [
        { type: 'input_text', text: 'PREFIX', prompt_cache_breakpoint: { mode: 'explicit' } },
      ],
    });
    expect(body.input[1]).toEqual({
      role: 'user',
      content: [{ type: 'input_text', text: 'USER' }],
    });
  });

  it('reads output_text across output items', async () => {
    const fetchFn = mock(
      reply({
        status: 'completed',
        output: [
          { type: 'reasoning', content: [] },
          { type: 'message', content: [{ type: 'output_text', text: '{"label":' }] },
          { type: 'message', content: [{ type: 'output_text', text: '"x"}' }] },
        ],
      }),
    );
    await expect(openAi(fetchFn).draft(input, signal)).resolves.toEqual(answer);
  });

  it('maps 402 to out_of_credit and 429 to rate_limited', async () => {
    expect(await kindOf(openAi(mock(reply({}, 402))).draft(input, signal))).toBe('out_of_credit');
    expect(await kindOf(openAi(mock(reply({}, 429))).draft(input, signal))).toBe('rate_limited');
    expect(await kindOf(openAi(mock(reply({}, 500))).draft(input, signal))).toBe('failed');
  });

  it('treats an incomplete answer, a refusal or unparsable text as a format error', async () => {
    const incomplete = reply({
      status: 'incomplete',
      output: [{ content: [{ type: 'output_text', text: '{"label":"x"}' }] }],
    });
    const refusal = reply({
      status: 'completed',
      output: [{ content: [{ type: 'refusal', refusal: 'no' }] }],
    });
    expect(await kindOf(openAi(mock(incomplete)).draft(input, signal))).toBe('format');
    expect(await kindOf(openAi(mock(refusal)).draft(input, signal))).toBe('format');
    expect(await kindOf(openAi(mock(openAiOk('not json'))).draft(input, signal))).toBe('format');
  });

  it('reports a network error as failed', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('down'));
    expect(await kindOf(openAi(fetchFn).draft(input, signal))).toBe('failed');
  });
});

describe('cloudflareProvider', () => {
  it("reads Cloudflare's response field and its chat-shaped answer", async () => {
    const asObject = mock(reply({ success: true, result: { response: answer } }));
    await expect(cloudflare(asObject).draft(input, signal)).resolves.toEqual(answer);
    const [url, init] = asObject.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      max_tokens: 800,
      response_format: { type: 'json_schema', json_schema: input.schema },
      messages: [
        { role: 'system', content: 'PREFIX' },
        { role: 'user', content: 'USER' },
      ],
    });
    const asString = mock(reply({ success: true, result: { response: JSON.stringify(answer) } }));
    await expect(cloudflare(asString).draft(input, signal)).resolves.toEqual(answer);
    const chat = mock(
      reply({
        success: true,
        result: { choices: [{ message: { content: JSON.stringify(answer) } }] },
      }),
    );
    await expect(cloudflare(chat).draft(input, signal)).resolves.toEqual(answer);
  });

  it('maps failures to the right kind', async () => {
    const failure = (status: number, message: string) =>
      reply({ success: false, errors: [{ message }] }, status);
    const kind = (r: Response) => kindOf(cloudflare(mock(r)).draft(input, signal));
    expect(await kind(failure(429, 'you have used up your daily free allocation of neurons'))).toBe(
      'out_of_credit',
    );
    expect(await kind(failure(429, 'Too many requests'))).toBe('rate_limited');
    expect(await kind(failure(400, "JSON Mode couldn't be met"))).toBe('format');
    expect(await kind(failure(500, 'boom'))).toBe('failed');
    expect(await kind(reply({ success: true, result: { response: 'not json' } }))).toBe('format');
  });
});

const stub = (name: DraftProvider['name'], draft: DraftProvider['draft']): DraftProvider => ({
  name,
  draft,
});

describe('draftWithFallback', () => {
  it('falls back to Cloudflare when OpenAI is out of credit', async () => {
    const openAiFetch = mock(reply({}, 402));
    const cfFetch = mock(reply({ success: true, result: { response: answer } }));
    await expect(
      draftWithFallback([openAi(openAiFetch), cloudflare(cfFetch)], input, signal),
    ).resolves.toEqual({ answer, provider: 'cloudflare' });
  });

  it('throws the last error when every provider fails', async () => {
    const first = stub('openai', () => Promise.reject(new ProviderError('rate_limited', 'a')));
    const second = stub('cloudflare', () => Promise.reject(new ProviderError('format', 'b')));
    expect(await kindOf(draftWithFallback([first, second], input, signal))).toBe('format');
  });

  it('throws failed for an empty list', async () => {
    expect(await kindOf(draftWithFallback([], input, signal))).toBe('failed');
  });

  it('does not try the next provider after an abort', async () => {
    const controller = new AbortController();
    const second = vi.fn();
    const first = stub('openai', () => {
      controller.abort();
      return Promise.reject(new ProviderError('failed', 'aborted'));
    });
    const kind = await kindOf(
      draftWithFallback([first, stub('cloudflare', second)], input, controller.signal),
    );
    expect(kind).toBe('failed');
    expect(second).not.toHaveBeenCalled();
  });
});

describe('providersFromEnv', () => {
  const doFetch = vi.fn() as unknown as typeof fetch;
  const names = (env: NodeJS.ProcessEnv) => providersFromEnv(env, doFetch).map((p) => p.name);

  it('skips a provider whose keys are missing', () => {
    expect(names({})).toEqual([]);
    expect(names({ OPENAI_API_KEY: 'k' })).toEqual(['openai']);
    expect(names({ CLOUDFLARE_ACCOUNT_ID: 'a' })).toEqual([]);
    expect(names({ CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' })).toEqual([
      'cloudflare',
    ]);
    expect(
      names({ OPENAI_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' }),
    ).toEqual(['openai', 'cloudflare']);
  });

  it('uses only the fake with CARD_DRAFT_FAKE', async () => {
    vi.stubEnv('CARD_DRAFT_FAKE', '1');
    vi.stubEnv('VERCEL_ENV', '');
    try {
      const providers = providersFromEnv({ OPENAI_API_KEY: 'k' }, doFetch);
      expect(providers.map((p) => p.name)).toEqual(['fake']);
      const made = (await providers[0]!.draft(input, signal)) as { summary: { ids: string[] }[] };
      expect(made.summary[0]!.ids).toEqual(['E1']);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('secrets', () => {
  it('never sends the key in the body or URL', async () => {
    const openAiFetch = mock(openAiOk());
    const cfFetch = mock(reply({ success: true, result: { response: answer } }));
    await openAi(openAiFetch).draft(input, signal);
    await cloudflare(cfFetch).draft(input, signal);
    for (const [fetchFn, secret] of [
      [openAiFetch, 'sk-secret'],
      [cfFetch, 'cf-secret'],
    ] as const) {
      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).not.toContain(secret);
      expect(init.body as string).not.toContain(secret);
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${secret}`);
    }
  });
});
