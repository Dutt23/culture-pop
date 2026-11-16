/** Shared by the API functions. Files under `api/_lib/` are helpers, not routes (Vercel skips `_`). */

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Browsers say where a request came from; anything but our own pages is refused. */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get('Sec-Fetch-Site');
  return site !== null && site !== 'same-origin';
}

export class TooLargeError extends Error {
  constructor() {
    super('Body too large');
    this.name = 'TooLargeError';
  }
}

/** Reads a body as text, refusing it as soon as it passes `maxBytes` (declared length first). */
export async function readCapped(message: Request | Response, maxBytes: number): Promise<string> {
  const declared = Number(message.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new TooLargeError();
  if (!message.body) return '';
  const reader = message.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new TooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
