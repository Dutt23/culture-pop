/**
 * Switches for running the backend on your own machine (docs/BACKEND_PLAN.md, "Run it locally").
 * Each is honoured only when set to "1" and only in explicit local development: `VERCEL_ENV` or
 * `NODE_ENV` must be `development` (`vercel dev` sets `VERCEL_ENV=development`). Anywhere else,
 * including a host that sets neither, every flag reads as off whatever the variable says.
 */
export type DevFlag =
  /** Canned results instead of Parallel: no key, no spending. */
  | 'WEB_SEARCH_FAKE'
  /** Access cookie without `Secure`, for a phone reaching the dev server over plain http. */
  | 'ACCESS_COOKIE_INSECURE_DEV'
  /** Canned card drafts instead of OpenAI and Cloudflare: no keys, nothing spent. */
  | 'CARD_DRAFT_FAKE';

export function devFlag(name: DevFlag): boolean {
  const local =
    process.env.VERCEL_ENV === 'development' ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'development');
  return local && process.env[name] === '1';
}
