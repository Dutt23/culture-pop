import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_USER_AGENT,
  browserHttpDependencies,
  createGetJson,
  MAX_RESPONSE_BYTES,
  type HttpDependencies,
} from './http';
import { RetrievalError } from './types';

const URL_ = 'https://en.wikipedia.org/w/api.php?action=query';

function json(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function deps(overrides: Partial<HttpDependencies> = {}): HttpDependencies {
  return {
    fetch: vi.fn<typeof fetch>(),
    sleep: vi.fn(() => Promise.resolve()),
    isOnline: () => true,
    ...overrides,
  };
}

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RetrievalError) return error.failure;
    throw error;
  }
  throw new Error('Expected a RetrievalError');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createGetJson', () => {
  it('returns parsed JSON and identifies the app without cookies or referrer', async () => {
    const d = deps({ fetch: vi.fn<typeof fetch>().mockResolvedValue(json(200, { ok: 1 })) });
    await expect(createGetJson(d)(URL_)).resolves.toEqual({ ok: 1 });
    const [, init] = vi.mocked(d.fetch).mock.calls[0];
    expect(init?.headers).toMatchObject({ 'Api-User-Agent': API_USER_AGENT });
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('retries a 429, waiting as long as Retry-After asks', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(429, {}, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    const d = deps({ fetch: fetchMock });
    await expect(createGetJson(d)(URL_)).resolves.toEqual({ ok: 1 });
    expect(d.sleep).toHaveBeenCalledWith(2000, undefined);
  });

  it('caps a hostile Retry-After so the UI cannot stall', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(503, {}, { 'Retry-After': '3600' }))
      .mockResolvedValueOnce(json(200, {}));
    const d = deps({ fetch: fetchMock });
    await createGetJson(d)(URL_);
    expect(d.sleep).toHaveBeenCalledWith(10_000, undefined);
  });

  it('gives up after the retry budget with rate_limited', async () => {
    const d = deps({ fetch: vi.fn<typeof fetch>().mockImplementation(async () => json(429)) });
    expect(await failureOf(createGetJson({ ...d, retries: 2 })(URL_))).toBe('rate_limited');
    expect(d.fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    [403, 'blocked'],
    [404, 'http_error'],
  ])('does not retry HTTP %i (%s)', async (status, failure) => {
    const d = deps({ fetch: vi.fn<typeof fetch>().mockResolvedValue(json(status)) });
    expect(await failureOf(createGetJson(d)(URL_))).toBe(failure);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports invalid JSON as bad_response', async () => {
    const d = deps({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 })),
    });
    expect(await failureOf(createGetJson(d)(URL_))).toBe('bad_response');
  });

  it('never calls the network while offline', async () => {
    const d = deps({ isOnline: () => false });
    expect(await failureOf(createGetJson(d)(URL_))).toBe('offline');
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('reports a failed connection (DNS, CORS, dropped) as network', async () => {
    const d = deps({
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    expect(await failureOf(createGetJson(d)(URL_))).toBe('network');
  });

  it('stops when the caller cancels', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = createGetJson(deps({ fetch: fetchMock }))(URL_, controller.signal);
    controller.abort();
    expect(await failureOf(pending)).toBe('aborted');
  });

  it('times out a request that never answers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = failureOf(createGetJson(deps({ fetch: fetchMock, timeoutMs: 1000 }))(URL_));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe('timeout');
  });

  it('times out a response whose body never finishes', async () => {
    vi.useFakeTimers();
    const pending = failureOf(
      createGetJson(deps({ fetch: vi.fn<typeof fetch>(stalledBody), timeoutMs: 1000 }))(URL_),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe('timeout');
  });

  it('stops reading the body when the caller cancels', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = failureOf(
      createGetJson(deps({ fetch: vi.fn<typeof fetch>(stalledBody) }))(URL_, controller.signal),
    );
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await pending).toBe('aborted');
  });

  it('refuses hosts outside the allowlist before calling the network', async () => {
    const d = deps();
    for (const url of [
      'https://evil.example/w/api.php',
      'http://en.wikipedia.org/w/api.php',
      'https://en.wikipedia.org.evil.example/x',
      'not a url',
    ]) {
      expect(await failureOf(createGetJson(d)(url))).toBe('blocked');
    }
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('sends Api-User-Agent to Wikimedia only, so other hosts need no CORS preflight', async () => {
    const d = deps({ fetch: vi.fn<typeof fetch>().mockImplementation(async () => json(200, {})) });
    const getJson = createGetJson(d);
    await getJson('https://api.tvmaze.com/search/shows?q=x');
    await getJson(URL_);
    const [tvmaze, wikipedia] = vi.mocked(d.fetch).mock.calls.map(([, init]) => init?.headers);
    expect(tvmaze).toEqual({ Accept: 'application/json' });
    expect(wikipedia).toEqual({ Accept: 'application/json', 'Api-User-Agent': API_USER_AGENT });
  });

  it('never follows redirects', async () => {
    const d = deps({ fetch: vi.fn<typeof fetch>().mockResolvedValue(json(200, {})) });
    await createGetJson(d)(URL_);
    expect(vi.mocked(d.fetch).mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });

  it('refuses a response that declares an oversized body', async () => {
    const big = new Response('{}', {
      status: 200,
      headers: { 'Content-Length': String(MAX_RESPONSE_BYTES + 1) },
    });
    const d = deps({ fetch: vi.fn<typeof fetch>().mockResolvedValue(big) });
    expect(await failureOf(createGetJson(d)(URL_))).toBe('bad_response');
  });

  it('stops reading a streamed body once it passes the cap', async () => {
    const chunk = new Uint8Array(400_000).fill(32);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const d = deps({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { status: 200 })),
    });
    expect(await failureOf(createGetJson(d)(URL_))).toBe('bad_response');
    expect(sent).toBeLessThanOrEqual(4);
  });
});

describe('browserHttpDependencies.sleep', () => {
  it('rejects at once when the signal is already aborted', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    const pending = failureOf(browserHttpDependencies.sleep(5000, controller.signal));
    expect(vi.getTimerCount()).toBe(0);
    expect(await pending).toBe('aborted');
  });
});

/** A 200 whose body only settles when the request is aborted, like a stalled stream. */
async function stalledBody(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const body = new Promise<never>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: null,
    text: () => body,
    json: () => body,
  } as unknown as Response;
}
