type Handler = (request: Request) => Promise<Response>;

/** Streams lifecycle events while the existing JSON handler owns validation and drafting. */
export function withDraftStream(handler: Handler): Handler {
  return async (request) => {
    const acceptsStream = request.headers
      .get('Accept')
      ?.split(',')
      .some((value) => /^text\/event-stream(?:\s*;|\s*$)/i.test(value.trim()));
    if (!acceptsStream) return handler(request);

    const abort = new AbortController();
    let closeStream = () => {};
    const stop = () => {
      abort.abort();
      closeStream();
    };
    request.signal.addEventListener('abort', stop, { once: true });
    if (request.signal.aborted) stop();
    const forwarded = new Request(request, { signal: abort.signal });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        closeStream = () => controller.close();
        if (abort.signal.aborted) {
          controller.close();
          request.signal.removeEventListener('abort', stop);
          return;
        }
        const send = (event: string, data: unknown) => {
          if (!abort.signal.aborted) {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          }
        };
        send('started', {});
        void (async () => {
          try {
            const response = await handler(forwarded);
            const body: unknown = await response.json();
            if (response.ok) send('result', body);
            else send('error', { status: response.status, body });
          } catch {
            send('error', { status: 500, body: { error: 'provider_failed' } });
          } finally {
            request.signal.removeEventListener('abort', stop);
            if (!abort.signal.aborted) controller.close();
          }
        })();
      },
      cancel() {
        closeStream = () => {};
        request.signal.removeEventListener('abort', stop);
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  };
}
