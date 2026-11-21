import type { Page } from '@playwright/test';

/**
 * Start as a reader who has already seen the mascot tours and used today's peeks over the search bar
 * (both have their own tests).
 */
export async function skipTours(page: Page) {
  await page.addInitScript(() => {
    for (const id of ['search', 'packs', 'pack']) localStorage.setItem(`pcd:tour-seen:${id}`, '1');
    const now = new Date();
    const day = [now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0'));
    localStorage.setItem('pcd:peeks', `${now.getFullYear()}-${day.join('-')}:3`);
  });
}

/**
 * Start as a signed-in reader (the app needs an account, D66). The preview server has no `/api`, so
 * the session check is answered here; no real credentials. The `pcd-account` hint is what a device
 * that signed in holds, and keeps the offline tests signed in when the check can't reach anything.
 */
export async function signIn(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: { signedIn: true, email: 'reader@example.test', quota: null, widerWeb: true },
      headers: { 'Cache-Control': 'private, no-store' },
    }),
  );
  await page.addInitScript(() => localStorage.setItem('pcd-account', 'reader@example.test'));
}

/** A returning, signed-in reader: what the mocked suite starts as. */
export async function returningReader(page: Page) {
  await skipTours(page);
  await signIn(page);
}

/**
 * Undo `signIn` for one test: the server answers "nobody signed in" and the device has no hint.
 * Routes added later win, and this init script runs after the one that set the hint.
 */
export async function asSignedOutVisitor(page: Page) {
  await page.addInitScript(() => localStorage.removeItem('pcd-account'));
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { signedIn: false } }));
}
