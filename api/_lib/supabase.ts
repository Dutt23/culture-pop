/**
 * Server-only calls to Supabase (D64, docs/SUPABASE_PLAN.md). Plain `fetch` against the documented
 * Auth (GoTrue) and Data API (PostgREST) endpoints, so no Supabase token logic ever ships to the
 * browser and no SDK session storage or background refresh runs here: `session.ts` owns refresh.
 *
 * Never log what these calls send or return: they carry OTP codes, access and refresh tokens.
 */

export interface SupabaseConfig {
  url: string;
  /** Publishable key: identifies the project to Supabase Auth. */
  publishableKey: string;
  /** Secret key: bypasses RLS. Only used for `bff.*` functions, which take a verified user id. */
  secretKey: string;
  /** The app's own origin, for CSRF checks. */
  appOrigin: string;
}

export function supabaseConfig(): SupabaseConfig | undefined {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const appOrigin = process.env.APP_ORIGIN;
  const origin = /^https?:\/\/[^/]+$/;
  if (!url || !origin.test(url) || !publishableKey || !secretKey) return undefined;
  // Required: the CSRF check compares every change request's Origin with it.
  if (!appOrigin || !origin.test(appOrigin)) return undefined;
  return { url, publishableKey, secretKey, appOrigin };
}

/** What the session code needs from Supabase Auth's token response. */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  /** Seconds since epoch. */
  expires_at: number;
  user_id: string;
  email: string;
}

/**
 * `invalid`: Supabase answered and refused (wrong/expired code, revoked or reused refresh token).
 * `limited`: Supabase's own rate limit (429), e.g. a second code for one email within a minute.
 * `unavailable`: no clear answer (network, timeout, 5xx, 401/404 from a bad key or URL, anything
 * unexpected): never treat as a refusal, or one mistyped key would sign everybody out.
 */
export class SupabaseError extends Error {
  constructor(
    readonly kind: 'invalid' | 'limited' | 'unavailable',
    readonly status: number,
    /** Supabase Auth's `error_code` (e.g. `weak_password`, `same_password`), when it sent one. */
    readonly code?: string,
  ) {
    super(`Supabase ${kind} (${status})`);
    this.name = 'SupabaseError';
  }
}

const TIMEOUT_MS = 10_000;
/** Statuses Supabase Auth uses for "no" about the code or token itself. */
const REFUSALS = new Set([400, 403, 422]);

export interface Supabase {
  sendOtp(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<AuthTokens>;
  signInWithPassword(email: string, password: string): Promise<AuthTokens>;
  /** Sets a new password for the account the access token belongs to. */
  updatePassword(accessToken: string, password: string): Promise<void>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  /** Ends this Supabase session (its refresh token stops working). */
  logout(accessToken: string): Promise<void>;
  /** Calls a `bff` schema function with the secret key. */
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
}

function toTokens(body: unknown): AuthTokens {
  const b = body as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_at?: unknown;
    user?: { id?: unknown; email?: unknown };
  };
  if (
    typeof b?.access_token !== 'string' ||
    typeof b.refresh_token !== 'string' ||
    typeof b.expires_at !== 'number' ||
    typeof b.user?.id !== 'string' ||
    typeof b.user.email !== 'string'
  ) {
    throw new SupabaseError('unavailable', 502);
  }
  return {
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    expires_at: b.expires_at,
    user_id: b.user.id,
    email: b.user.email,
  };
}

export function createSupabase(config: SupabaseConfig, fetchImpl: typeof fetch = fetch): Supabase {
  async function call(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${config.url}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new SupabaseError('unavailable', 0);
    }
    if (response.status === 429) throw new SupabaseError('limited', 429);
    if (REFUSALS.has(response.status)) {
      let code: string | undefined;
      try {
        const body = (await response.json()) as { error_code?: unknown };
        code = typeof body.error_code === 'string' ? body.error_code.slice(0, 60) : undefined;
      } catch {
        code = undefined;
      }
      throw new SupabaseError('invalid', response.status, code);
    }
    if (!response.ok) throw new SupabaseError('unavailable', response.status);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  const authHeaders = { 'Content-Type': 'application/json', apikey: config.publishableKey };
  const post = (path: string, body: unknown, headers: Record<string, string> = authHeaders) =>
    call(path, { method: 'POST', headers, body: JSON.stringify(body) });

  return {
    async sendOtp(email) {
      await post('/auth/v1/otp', { email, create_user: true });
    },
    async verifyOtp(email, code) {
      return toTokens(await post('/auth/v1/verify', { type: 'email', email, token: code }));
    },
    async signInWithPassword(email, password) {
      return toTokens(await post('/auth/v1/token?grant_type=password', { email, password }));
    },
    async updatePassword(accessToken, password) {
      await call('/auth/v1/user', {
        method: 'PUT',
        headers: { ...authHeaders, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password }),
      });
    },
    async refresh(refreshToken) {
      return toTokens(
        await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: refreshToken }),
      );
    },
    async logout(accessToken) {
      await post(
        '/auth/v1/logout?scope=local',
        {},
        {
          ...authHeaders,
          Authorization: `Bearer ${accessToken}`,
        },
      );
    },
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      return (await post(`/rest/v1/rpc/${fn}`, args, {
        'Content-Type': 'application/json',
        'Content-Profile': 'bff',
        'Accept-Profile': 'bff',
        apikey: config.secretKey,
      })) as T;
    },
  };
}
