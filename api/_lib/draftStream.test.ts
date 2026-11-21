// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { withDraftStream } from './draftStream.js';

const request = (signal?: AbortSignal) =>
  new Request('https://app.test/api/draft-card', {
    method: 'POST',
    body: JSON.stringify({ search: 'test' }),
    headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
    signal,
  });

describe('withDraftStream', () => {
  it('preserves normal JSON response behavior', async () => {
    const response = Response.json({ error: 'signed_out' }, { status: 401 });
    const handler = vi.fn(async () => response);
    expect(await withDraftStream(handler)(new Request('https://app.test'))).toBe(response);
  });

  it('starts before completion then delivers the original JSON result', async () => {
    let finish!: (response: Response) => void;
    const handle = withDraftStream(async (forwarded) => {
      expect(await forwarded.json()).toEqual({ search: 'test' });
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const response = await handle(request());
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      'event: started\ndata: {}\n\n',
    );
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish(Response.json({ card: { label: 'Line\nwith newline' } }));
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      'event: result\ndata: {"card":{"label":"Line\\nwith newline"}}\n\n',
    );
    expect((await reader.read()).done).toBe(true);
  });

  it('preserves HTTP status and body in terminal error events', async () => {
    const response = await withDraftStream(async () =>
      Response.json({ error: 'signed_out' }, { status: 401 }),
    )(request());
    expect(await response.text()).toContain(
      'event: error\ndata: {"status":401,"body":{"error":"signed_out"}}\n\n',
    );
  });

  it('aborts the forwarded request when reader cancels', async () => {
    let signal!: AbortSignal;
    const response = await withDraftStream(async (forwarded) => {
      signal = forwarded.signal;
      return new Promise<Response>((resolve) =>
        forwarded.signal.addEventListener('abort', () => resolve(Response.json({})), {
          once: true,
        }),
      );
    })(request());
    await response.body!.cancel();
    expect(signal.aborted).toBe(true);
  });

  it('closes stream and aborts work when request signal aborts', async () => {
    const abort = new AbortController();
    let signal!: AbortSignal;
    const response = await withDraftStream(async (forwarded) => {
      signal = forwarded.signal;
      return new Promise<Response>((resolve) =>
        forwarded.signal.addEventListener('abort', () => resolve(Response.json({})), {
          once: true,
        }),
      );
    })(request(abort.signal));
    abort.abort();
    expect(signal.aborted).toBe(true);
    expect(await response.text()).toBe('event: started\ndata: {}\n\n');
  });
});
