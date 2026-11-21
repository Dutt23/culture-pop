import { devFlag } from './devFlags.js';

/** Cookie helpers for the session cookie (`session.ts`). */

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

/**
 * HttpOnly, SameSite=Strict, Path=/api (only our functions need it; page loads never send it), and
 * Secure always, except with the local-only `ACCESS_COOKIE_INSECURE_DEV=1` (`devFlags.ts`) for a
 * phone reaching the dev server over plain http on Wi-Fi. Never relaxed on a Vercel deployment.
 */
export function cookieFlags(): string {
  const secure = devFlag('ACCESS_COOKIE_INSECURE_DEV') ? '' : ' Secure;';
  return `HttpOnly;${secure} SameSite=Strict; Path=/api`;
}
