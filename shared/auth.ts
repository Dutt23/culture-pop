/**
 * Sign-in rules shared by the app (`src/features/account`, `src/services/auth`) and the server
 * (`api/_lib/authHandlers.ts`, `api/_lib/session.ts`), so both sides check the same things.
 */

/** Sign-in API paths. One function serves them all (`api/auth/[action].ts`). */
export const AUTH_PATHS = {
  otp: '/api/auth/otp',
  verify: '/api/auth/verify',
  password: '/api/auth/password',
  setPassword: '/api/auth/set-password',
  logout: '/api/auth/logout',
  session: '/api/auth/session',
} as const;

/** Every cookie-authenticated change must carry this header with the value `1` (CSRF guard). */
export const CSRF_HEADER = 'X-PCD-Request';

/** Matches "Email OTP length: 6" in Supabase (docs/SUPABASE_SETUP.md); change both together. */
export const CODE_LENGTH = 6;
export const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

export const MIN_PASSWORD = 10;
/** Supabase hashes passwords with bcrypt, which ignores anything past 72 bytes. */
export const MAX_PASSWORD_BYTES = 72;

/** The error codes `/api/auth/*` can answer with, besides "unavailable". */
export const AUTH_ERRORS = [
  'wrong_code',
  'wrong_password',
  'weak_password',
  'same_password',
  'too_many_attempts',
  'bad_request',
] as const;
export type AuthError = (typeof AUTH_ERRORS)[number];

export function isAuthError(value: unknown): value is AuthError {
  return typeof value === 'string' && (AUTH_ERRORS as readonly string[]).includes(value);
}
