import { PROMPT_VERSION, type ModelAnswer } from './cardPrompt.js';
import { devFlag } from './devFlags.js';
import { readCapped } from './http.js';

/**
 * The AI calls behind a card draft: OpenAI first, Cloudflare Workers AI as the fallback, and a fake
 * for local dev. Each provider returns the parsed JSON answer, unchecked; the caller validates it.
 * Keys travel only in the Authorization header, and nothing here logs. The caller owns the abort
 * signal (timeout and the reader leaving).
 */

export type ProviderErrorKind = 'out_of_credit' | 'rate_limited' | 'failed' | 'format';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface DraftInput {
  prefix: string;
  user: string;
  schema: object;
}

export interface DraftProvider {
  name: 'openai' | 'cloudflare' | 'fake';
  draft(input: DraftInput, signal: AbortSignal): Promise<unknown>;
}

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = 'gpt-6-luna';
const CLOUDFLARE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_OUTPUT_TOKENS = 800;
const MAX_UPSTREAM_BYTES = 256 * 1024;
const OUT_OF_CREDIT = /neurons|allocation|daily/i;
const JSON_MODE = /json/i;

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null;

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('format', `${what} was not JSON`);
  }
}

/** POSTs JSON and returns the response; a network error or abort becomes `failed`. */
async function post(
  doFetch: typeof fetch,
  url: string,
  token: string,
  body: object,
  signal: AbortSignal,
): Promise<Response> {
  try {
    return await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
      redirect: 'error',
    });
  } catch {
    throw new ProviderError('failed', 'request failed');
  }
}

/** The answer text: every `output_text` part, joined. A refusal or a cut-off answer is a format error. */
function openAiText(body: unknown): string {
  if (!isObj(body) || body.status === 'incomplete') throw new ProviderError('format', 'incomplete');
  const parts = (Array.isArray(body.output) ? body.output : []).flatMap((item: unknown) =>
    isObj(item) && Array.isArray(item.content) ? (item.content as unknown[]) : [],
  );
  if (parts.some((part) => isObj(part) && part.type === 'refusal')) {
    throw new ProviderError('format', 'refused');
  }
  return parts
    .map((part) => (isObj(part) && part.type === 'output_text' ? String(part.text ?? '') : ''))
    .join('');
}

export function openAiProvider(deps: { fetch: typeof fetch; apiKey: string }): DraftProvider {
  return {
    name: 'openai',
    async draft({ prefix, user, schema }, signal) {
      const response = await post(
        deps.fetch,
        OPENAI_URL,
        deps.apiKey,
        {
          model: OPENAI_MODEL,
          store: false,
          reasoning: { effort: 'none' },
          temperature: 0.2,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          prompt_cache_options: { mode: 'explicit', ttl: '30m' },
          prompt_cache_key: PROMPT_VERSION,
          text: { format: { type: 'json_schema', name: 'card', schema, strict: true } },
          input: [
            {
              role: 'developer',
              content: [
                {
                  type: 'input_text',
                  text: prefix,
                  prompt_cache_breakpoint: { mode: 'explicit' },
                },
              ],
            },
            { role: 'user', content: [{ type: 'input_text', text: user }] },
          ],
        },
        signal,
      );
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        if (response.status === 402) throw new ProviderError('out_of_credit', 'out of credit');
        if (response.status === 429) throw new ProviderError('rate_limited', 'rate limited');
        throw new ProviderError('failed', `status ${response.status}`);
      }
      let body: unknown;
      try {
        body = JSON.parse(await readCapped(response, MAX_UPSTREAM_BYTES));
      } catch {
        throw new ProviderError('format', 'unreadable response');
      }
      return parseJson(openAiText(body), 'answer');
    },
  };
}

/** Cloudflare's reported errors, as one string (empty when none). */
function cloudflareMessages(body: unknown): string {
  if (!isObj(body) || !Array.isArray(body.errors)) return '';
  return body.errors.map((e: unknown) => (isObj(e) ? String(e.message ?? '') : '')).join('; ');
}

function cloudflareFailure(status: number, messages: string): ProviderError {
  if (OUT_OF_CREDIT.test(messages)) return new ProviderError('out_of_credit', 'allowance used up');
  if (status === 429) return new ProviderError('rate_limited', 'rate limited');
  if (JSON_MODE.test(messages)) return new ProviderError('format', 'JSON mode failed');
  return new ProviderError('failed', `status ${status}`);
}

export function cloudflareProvider(deps: {
  fetch: typeof fetch;
  accountId: string;
  token: string;
}): DraftProvider {
  return {
    name: 'cloudflare',
    async draft({ prefix, user, schema }, signal) {
      const account = encodeURIComponent(deps.accountId);
      const response = await post(
        deps.fetch,
        `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CLOUDFLARE_MODEL}`,
        deps.token,
        {
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_schema', json_schema: schema },
          messages: [
            { role: 'system', content: prefix },
            { role: 'user', content: user },
          ],
        },
        signal,
      );
      let body: unknown;
      try {
        body = JSON.parse(await readCapped(response, MAX_UPSTREAM_BYTES));
      } catch {
        if (!response.ok) throw cloudflareFailure(response.status, '');
        throw new ProviderError('format', 'unreadable response');
      }
      if (!response.ok || (isObj(body) && body.success === false)) {
        throw cloudflareFailure(response.status, cloudflareMessages(body));
      }
      const result = isObj(body) && isObj(body.result) ? body.result : {};
      const choices = Array.isArray(result.choices) ? (result.choices as unknown[]) : [];
      const message = isObj(choices[0]) && isObj(choices[0].message) ? choices[0].message : {};
      const raw = result.response ?? message.content;
      if (isObj(raw)) return raw;
      if (typeof raw === 'string') return parseJson(raw, 'answer');
      throw new ProviderError('format', 'no answer');
    },
  };
}

const FAKE_ANSWER: ModelAnswer = {
  main_use: 'A test use.',
  label: 'A test card',
  gist: 'A short test gist.',
  means: 'A short test meaning.',
  reply: 'A short test reply.',
  summary: [{ t: 'Local test card: no AI was called.', ids: ['E1'] }],
  context: [],
  example: null,
  spoiler: 'none',
  unclear: false,
  ignored: [],
};

export function fakeProvider(): DraftProvider {
  return { name: 'fake', draft: () => Promise.resolve(structuredClone(FAKE_ANSWER)) };
}

export function providersFromEnv(env: NodeJS.ProcessEnv, doFetch: typeof fetch): DraftProvider[] {
  if (devFlag('CARD_DRAFT_FAKE')) return [fakeProvider()];
  const providers: DraftProvider[] = [];
  if (env.OPENAI_API_KEY) {
    providers.push(openAiProvider({ fetch: doFetch, apiKey: env.OPENAI_API_KEY }));
  }
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    providers.push(
      cloudflareProvider({
        fetch: doFetch,
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        token: env.CLOUDFLARE_API_TOKEN,
      }),
    );
  }
  return providers;
}

/** Tries each provider in order; any `ProviderError` moves on, and the last one is thrown if all fail. */
export async function draftWithFallback(
  providers: readonly DraftProvider[],
  input: DraftInput,
  signal: AbortSignal,
): Promise<{ answer: unknown; provider: DraftProvider['name'] }> {
  let last = new ProviderError('failed', 'no provider configured');
  for (const provider of providers) {
    // An abort while trying one provider must not start the next.
    if (signal.aborted) throw new ProviderError('failed', 'aborted');
    try {
      return { answer: await provider.draft(input, signal), provider: provider.name };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      last = error;
    }
  }
  throw last;
}
