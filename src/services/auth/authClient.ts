import { AUTH_PATHS, CSRF_HEADER, isAuthError, type AuthError } from '../../../shared/auth.js';

/**
 * Talks to our own `/api/auth/*` (D64). The browser never sees a Supabase token: the server sets
 * an HttpOnly session cookie, and these calls only send what the reader typed. Every change carries
 * the CSRF header, which the server requires so other sites can't post here.
 */

export type AuthFailure = AuthError | 'offline' | 'unavailable';

export type AuthResult = { ok: true; email?: string } | { ok: false; error: AuthFailure };

export interface AccountSession {
  signedIn: boolean;
  email?: string;
  quota?: { available: number; reserved: number } | null;
}

export interface AuthClient {
  sendCode(email: string): Promise<AuthResult>;
  signInWithCode(email: string, code: string): Promise<AuthResult>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  setPassword(email: string, code: string, password: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  session(): Promise<AccountSession | undefined>;
}

/**
 * This device signed in before: only then does Settings ask the server who is signed in. Holds the
 * email in plain text on this device (no token); sign-out clears it.
 */
const HINT_KEY = 'pcd-account';

export function readAccountHint(): string | null {
  try {
    return localStorage.getItem(HINT_KEY);
  } catch {
    return null;
  }
}

function writeAccountHint(email: string | null): void {
  try {
    if (email) localStorage.setItem(HINT_KEY, email);
    else localStorage.removeItem(HINT_KEY);
  } catch {
    // Private mode or storage blocked: Settings just shows "Sign in".
  }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** The server's answer is checked, not trusted: anything odd reads as "couldn't tell". */
function readSession(body: unknown): AccountSession | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as { signedIn?: unknown; email?: unknown; quota?: unknown };
  if (b.signedIn === false) return { signedIn: false };
  if (b.signedIn !== true || typeof b.email !== 'string') return undefined;
  const q = b.quota as { available?: unknown; reserved?: unknown } | null | undefined;
  const quota =
    q && isCount(q.available) && isCount(q.reserved)
      ? { available: q.available, reserved: q.reserved }
      : null;
  return { signedIn: true, email: b.email, quota };
}

export function createAuthClient(fetchImpl: typeof fetch = (...a) => fetch(...a)): AuthClient {
  async function post(path: string, body: Record<string, string>): Promise<AuthResult> {
    let response: Response;
    try {
      response = await fetchImpl(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
    } catch {
      return { ok: false, error: navigator.onLine === false ? 'offline' : 'unavailable' };
    }
    const data = (await response.json().catch(() => ({}))) as { error?: unknown; email?: unknown };
    if (response.ok) {
      const email = typeof data.email === 'string' ? data.email : undefined;
      if (path === AUTH_PATHS.logout) writeAccountHint(null);
      else if (email) writeAccountHint(email);
      return { ok: true, email };
    }
    return { ok: false, error: isAuthError(data.error) ? data.error : 'unavailable' };
  }

  return {
    sendCode: (email) => post(AUTH_PATHS.otp, { email }),
    signInWithCode: (email, code) => post(AUTH_PATHS.verify, { email, code }),
    signInWithPassword: (email, password) => post(AUTH_PATHS.password, { email, password }),
    setPassword: (email, code, password) => post(AUTH_PATHS.setPassword, { email, code, password }),
    signOut: () => post(AUTH_PATHS.logout, {}),
    async session() {
      try {
        const response = await fetchImpl(AUTH_PATHS.session, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return undefined;
        const session = readSession(await response.json());
        if (session) writeAccountHint(session.signedIn ? (session.email ?? null) : null);
        return session;
      } catch {
        return undefined;
      }
    },
  };
}
