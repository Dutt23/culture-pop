import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { devFlag } from './devFlags.js';

/**
 * Access code for the wider-web search (D45, docs/BACKEND_PLAN.md §6). `/api/unlock` checks the code
 * and sets a signed, HttpOnly cookie; `/api/web-search` checks the cookie. The rest of the app is
 * public. Swap this file to change how access works; the functions only call `checkAccess`.
 */

export const COOKIE_NAME = 'pcd_access';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** Refuse to run with a weak setup rather than open by default. */
const MIN_CODE_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;

export interface AccessConfig {
  code: string;
  secret: string;
}

export type AccessResult = 'ok' | 'locked' | 'not_configured';

export function accessConfig(): AccessConfig | undefined {
  const code = process.env.ACCESS_CODE;
  const secret = process.env.ACCESS_COOKIE_SECRET;
  if (!code || code.length < MIN_CODE_LENGTH) return undefined;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return undefined;
  return { code, secret };
}

function sha256(text: string): Buffer {
  return createHash('sha256').update(text).digest();
}

/** Constant time: both sides are hashed to the same length before comparing. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function hmac(secret: string, text: string): string {
  return createHmac('sha256', secret).update(text).digest('base64url');
}

/**
 * Changes whenever ACCESS_CODE changes, so a new code signs everyone out. Keyed with the secret, so
 * the cookie never carries a plain hash someone could test guesses of the code against.
 */
function codeVersion(config: AccessConfig): string {
  return hmac(config.secret, `code-version:${config.code}`).slice(0, 16);
}

export function issueToken(config: AccessConfig, nowMs: number): string {
  const expires = Math.floor(nowMs / 1000) + MAX_AGE_SECONDS;
  const payload = `${expires}.${codeVersion(config)}`;
  return `${payload}.${hmac(config.secret, payload)}`;
}

export function verifyToken(token: string, config: AccessConfig, nowMs: number): boolean {
  const [expires, version, signature, ...rest] = token.split('.');
  if (rest.length > 0 || !expires || !version || !signature) return false;
  if (!/^\d{1,12}$/.test(expires) || Number(expires) * 1000 <= nowMs) return false;
  const versionOk = safeEqual(version, codeVersion(config));
  const signatureOk = safeEqual(signature, hmac(config.secret, `${expires}.${version}`));
  return versionOk && signatureOk;
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

export function checkAccess(request: Request, nowMs: number): AccessResult {
  const config = accessConfig();
  if (!config) return 'not_configured';
  const token = readCookie(request, COOKIE_NAME);
  return token && verifyToken(token, config, nowMs) ? 'ok' : 'locked';
}

/**
 * `Secure` always, except with the local-only `ACCESS_COOKIE_INSECURE_DEV=1` (`devFlags.ts`), for a
 * phone reaching the dev server over plain http on Wi-Fi. Never relaxed on a Vercel deployment.
 */
function cookieFlags(): string {
  const secure = devFlag('ACCESS_COOKIE_INSECURE_DEV') ? '' : ' Secure;';
  return `HttpOnly;${secure} SameSite=Strict; Path=/api`;
}

export function accessCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; ${cookieFlags()}; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearedAccessCookie(): string {
  return `${COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}
