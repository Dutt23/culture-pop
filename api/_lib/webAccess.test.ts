// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from './session';
import type { Supabase, SupabaseConfig } from './supabase';
import { checkWebAccess } from './webAccess';

const ORIGIN = 'https://app.example.test';
const USER = '11111111-1111-4111-8111-111111111111';
const CONFIG: SupabaseConfig = {
  url: 'https://proj.supabase.test',
  publishableKey: 'sb_publishable_test',
  secretKey: 'sb_secret_test',
  appOrigin: ORIGIN,
};
const TOKENS = JSON.stringify({
  access_token: 'a',
  refresh_token: 'r',
  expires_at: Date.now() / 1000 + 3600,
  user_id: USER,
  email: 'r@e.test',
});

/** A signed-in session; `allowed` and `credit` are what the two checks answer. */
function fake(allowed: unknown, credit: unknown | Error) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    if (fn === 'load_session') {
      return [{ session_id: 's1', user_id: USER, tokens: TOKENS, token_version: 1 }];
    }
    if (fn === 'can_search_wider_web') return allowed;
    if (fn === 'take_web_credit') {
      if (credit instanceof Error) throw credit;
      return args.p_user === USER ? credit : 'user_cap';
    }
    throw new Error(`unexpected ${fn}`);
  });
  return { rpc } as unknown as Supabase & { rpc: typeof rpc };
}

function request(headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/web-search`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Sec-Fetch-Site': 'same-origin',
      'X-PCD-Request': '1',
      Cookie: `${SESSION_COOKIE}=${'h'.repeat(43)}`,
      ...headers,
    },
  });
}

const check = (
  supabase: Supabase,
  req = request(),
  usage: 'web_search' | 'card_draft' = 'web_search',
) => checkWebAccess(req, usage, { config: CONFIG, supabase });

describe('checkWebAccess', () => {
  it('lets a signed-in, allowed person with credit left through, spending one credit', async () => {
    const supabase = fake(true, 'ok');
    expect(await check(supabase, request(), 'card_draft')).toBe('ok');
    expect(supabase.rpc).toHaveBeenCalledWith('take_web_credit', {
      p_user: USER,
      p_kind: 'card_draft',
    });
  });

  it.each(['user_cap', 'global_cap'])('says daily_cap when the %s is reached', async (cap) => {
    expect(await check(fake(true, cap))).toBe('daily_cap');
  });

  it('spends nothing for someone without the permission', async () => {
    const supabase = fake(false, 'ok');
    expect(await check(supabase)).toBe('not_allowed');
    expect(supabase.rpc).not.toHaveBeenCalledWith('take_web_credit', expect.anything());
  });

  it.each([
    ['another site', { 'Sec-Fetch-Site': 'cross-site' }],
    ['another origin', { Origin: 'https://evil.example' }],
    ['no app header', { 'X-PCD-Request': '' }],
  ])('refuses a request from %s before looking at the session', async (_name, headers) => {
    const supabase = fake(true, 'ok');
    expect(await check(supabase, request(headers))).toBe('cross_site');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the count gets no clear answer', async () => {
    expect(await check(fake(true, new Error('down')))).toBe('unavailable');
    expect(await check(fake(true, 'something else'))).toBe('unavailable');
  });

  it('is closed when sign-in is not set up', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    expect(await checkWebAccess(request(), 'web_search')).toBe('not_configured');
    vi.unstubAllEnvs();
  });
});
