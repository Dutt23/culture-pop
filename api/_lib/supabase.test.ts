// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSupabase, SupabaseError } from './supabase';

const CONFIG = {
  url: 'https://proj.supabase.test',
  publishableKey: 'sb_publishable_test',
  secretKey: 'sb_secret_test',
  appOrigin: 'https://app.example.test',
};
const TOKEN_BODY = {
  access_token: 'a',
  refresh_token: 'r',
  expires_at: 1_900_000_000,
  user: { id: 'u1', email: 'x@y.test' },
};

function withResponse(response: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn<typeof fetch>(async () => response());
  return { fetchImpl, supabase: createSupabase(CONFIG, fetchImpl) };
}

const headersOf = (init: RequestInit | undefined) => new Headers(init?.headers);

describe('createSupabase', () => {
  it('calls bff functions with the secret key and the bff schema', async () => {
    const { fetchImpl, supabase } = withResponse(() => Response.json([{ ok: 1 }]));
    expect(await supabase.rpc('load_session', { p_handle_digest: '\\x00' })).toEqual([{ ok: 1 }]);
    const [url, init] = fetchImpl.mock.calls[0] ?? [undefined, undefined];
    expect(url).toBe('https://proj.supabase.test/rest/v1/rpc/load_session');
    expect(headersOf(init).get('apikey')).toBe('sb_secret_test');
    expect(headersOf(init).get('Content-Profile')).toBe('bff');
    expect(headersOf(init).get('Authorization')).toBeNull();
  });

  it('never sends the secret key to Auth', async () => {
    const { fetchImpl, supabase } = withResponse(() => Response.json(TOKEN_BODY));
    await supabase.sendOtp('x@y.test');
    await supabase.verifyOtp('x@y.test', '123456');
    await supabase.refresh('r');
    await supabase.logout('a');
    await supabase.signInWithPassword('x@y.test', 'pw');
    await supabase.updatePassword('a', 'new pw');
    for (const [, init] of fetchImpl.mock.calls) {
      expect(headersOf(init).get('apikey')).toBe('sb_publishable_test');
      expect(JSON.stringify(init)).not.toContain('sb_secret_test');
    }
    expect(headersOf(fetchImpl.mock.calls[3]?.[1]).get('Authorization')).toBe('Bearer a');
    expect(fetchImpl.mock.calls[4]?.[0]).toBe(
      'https://proj.supabase.test/auth/v1/token?grant_type=password',
    );
    expect(fetchImpl.mock.calls[5]?.[0]).toBe('https://proj.supabase.test/auth/v1/user');
    expect(fetchImpl.mock.calls[5]?.[1]?.method).toBe('PUT');
    expect(headersOf(fetchImpl.mock.calls[5]?.[1]).get('Authorization')).toBe('Bearer a');
  });

  it('turns a token response into the stored shape', async () => {
    const { supabase } = withResponse(() => Response.json(TOKEN_BODY));
    expect(await supabase.verifyOtp('x@y.test', '123456')).toEqual({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 1_900_000_000,
      user_id: 'u1',
      email: 'x@y.test',
    });
  });

  it.each([
    ['a refusal', () => new Response('{}', { status: 400 }), 'invalid'],
    ['a server error', () => new Response('{}', { status: 502 }), 'unavailable'],
    ['rate limiting', () => new Response('{}', { status: 429 }), 'limited'],
    ['a bad or revoked API key', () => new Response('{}', { status: 401 }), 'unavailable'],
    ['a malformed token response', () => Response.json({ access_token: 'a' }), 'unavailable'],
    [
      'a network failure',
      () => {
        throw new TypeError('fetch failed');
      },
      'unavailable',
    ],
  ] as const)('classifies %s', async (_name, response, kind) => {
    const { supabase } = withResponse(response);
    const error = await supabase.refresh('r').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SupabaseError);
    expect((error as SupabaseError).kind).toBe(kind);
  });
});
