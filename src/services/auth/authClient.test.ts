import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthClient, readAccountHint } from './authClient';

function respond(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

afterEach(() => {
  localStorage.clear();
});

describe('createAuthClient', () => {
  it('posts to our own API with the anti-forgery header and same-origin cookies', async () => {
    const fetchImpl = respond(200, { signedIn: true, email: 'r@e.test' });
    await createAuthClient(fetchImpl).signInWithPassword('r@e.test', 'pw');
    const [url, init] = fetchImpl.mock.calls[0] ?? [undefined, undefined];
    expect(url).toBe('/api/auth/password');
    expect(new Headers(init?.headers).get('X-PCD-Request')).toBe('1');
    expect(init?.credentials).toBe('same-origin');
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'r@e.test', password: 'pw' });
  });

  it('passes on the errors it knows and calls anything else "unavailable"', async () => {
    expect(
      await createAuthClient(respond(401, { error: 'wrong_code' })).signInWithCode('a@b.c', '1'),
    ).toEqual({
      ok: false,
      error: 'wrong_code',
    });
    expect(
      await createAuthClient(respond(503, { error: 'not_configured' })).sendCode('a@b.c'),
    ).toEqual({
      ok: false,
      error: 'unavailable',
    });
    const broken = vi.fn<typeof fetch>(async () => {
      throw new TypeError('network');
    });
    expect((await createAuthClient(broken).sendCode('a@b.c')).ok).toBe(false);
  });

  it('remembers on this device that it signed in, and forgets on sign-out', async () => {
    await createAuthClient(respond(200, { signedIn: true, email: 'r@e.test' })).signInWithCode(
      'r@e.test',
      '1',
    );
    expect(readAccountHint()).toBe('r@e.test');
    await createAuthClient(respond(200, { signedIn: false })).signOut();
    expect(readAccountHint()).toBeNull();
  });

  it('treats an odd session answer as "couldn\'t tell" and keeps the hint', async () => {
    localStorage.setItem('pcd-account', 'r@e.test');
    for (const body of [null, { signedIn: 'yes' }, { signedIn: true }, [1]]) {
      expect(await createAuthClient(respond(200, body)).session()).toBeUndefined();
    }
    expect(readAccountHint()).toBe('r@e.test');
  });

  it('drops a malformed balance but keeps who is signed in', async () => {
    const body = { signedIn: true, email: 'r@e.test', quota: { available: -1, reserved: 'x' } };
    expect(await createAuthClient(respond(200, body)).session()).toEqual({
      signedIn: true,
      email: 'r@e.test',
      quota: null,
      widerWeb: null,
    });
  });

  it('forgets the hint when the server says nobody is signed in', async () => {
    localStorage.setItem('pcd-account', 'r@e.test');
    expect(await createAuthClient(respond(200, { signedIn: false })).session()).toEqual({
      signedIn: false,
    });
    expect(readAccountHint()).toBeNull();
  });
});
