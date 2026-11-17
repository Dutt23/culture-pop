import { accessConfig, accessCookie, issueToken, safeEqual } from './_lib/access.js';
import { isCrossSite, json, readCapped, sleep } from './_lib/http.js';

/** POST `{ code }`: on the right access code, sets the signed cookie `/api/web-search` checks. */

const MAX_BODY_BYTES = 1024;
const MAX_CODE_LENGTH = 200;
/** Slows guessing; the Firewall rule on this path is the main brake (docs/BACKEND_PLAN.md §6). */
const WRONG_CODE_DELAY_MS = 1000;
/** Attempts allowed per visitor per minute before that visitor gets 429 until the minute is over. */
const MAX_WRONG_PER_MINUTE = 10;
const MINUTE_MS = 60_000;

export interface UnlockOptions {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Who is asking. Vercel sets `x-real-ip` itself; without it (tests, local) everyone is one visitor. */
function visitor(request: Request): string {
  return request.headers.get('x-real-ip') ?? 'unknown';
}

async function readCode(request: Request): Promise<string | undefined> {
  try {
    const body: unknown = JSON.parse(await readCapped(request, MAX_BODY_BYTES));
    const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : 0;
    return typeof code === 'string' && code.length > 0 && code.length <= MAX_CODE_LENGTH
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

export function createUnlockHandler(
  options: UnlockOptions = {},
): (request: Request) => Promise<Response> {
  const now = options.now ?? Date.now;
  const wait = options.sleep ?? sleep;
  // shortcut: per-instance memory, so parallel instances each allow their own 10; the Firewall rule
  // is the shared limit. Upgrade to a shared store if the code is ever guessed at scale.
  // Per visitor, so one guesser can't lock everyone else out; cleared every minute.
  let windowStart = 0;
  const attempts = new Map<string, number>();

  // Never logs: neither the code nor the cookie.
  return async function unlock(request) {
    if (isCrossSite(request)) return json(403, { error: 'cross_site' });
    const config = accessConfig();
    if (!config) return json(503, { error: 'not_configured' });
    if (now() - windowStart >= MINUTE_MS) {
      windowStart = now();
      attempts.clear();
    }
    const who = visitor(request);
    const tried = attempts.get(who) ?? 0;
    if (tried >= MAX_WRONG_PER_MINUTE) return json(429, { error: 'too_many_attempts' });
    // Counted before the code is even read, so a burst of guesses sent at once can't all slip past
    // the check; the right code gives its attempt back.
    attempts.set(who, tried + 1);
    const code = await readCode(request);
    if (code === undefined) return json(400, { error: 'bad_request' });
    if (!safeEqual(code, config.code)) {
      await wait(WRONG_CODE_DELAY_MS);
      return json(401, { error: 'wrong_code' });
    }
    attempts.set(who, Math.max(0, (attempts.get(who) ?? 1) - 1));
    return json(200, { ok: true }, { 'Set-Cookie': accessCookie(issueToken(config, now())) });
  };
}

export const POST = createUnlockHandler();
