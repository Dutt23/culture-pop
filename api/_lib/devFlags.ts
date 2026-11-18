/**
 * Switches for running the backend on your own machine (docs/BACKEND_PLAN.md, "Run it locally").
 * Each is honoured only when set to "1" and never on a Vercel deployment: `VERCEL_ENV` is
 * `production` or `preview` there, and then every flag reads as off whatever the variable says.
 */
export type DevFlag =
  /** Canned results instead of Parallel: no key, no spending. */
  | 'WEB_SEARCH_FAKE'
  /** Access cookie without `Secure`, for a phone reaching the dev server over plain http. */
  | 'ACCESS_COOKIE_INSECURE_DEV'
  /** Canned card drafts instead of OpenAI and Cloudflare: no keys, nothing spent. */
  | 'CARD_DRAFT_FAKE';

export function devFlag(name: DevFlag): boolean {
  const deployment = process.env.VERCEL_ENV;
  if (deployment === 'production' || deployment === 'preview') return false;
  return process.env[name] === '1';
}
