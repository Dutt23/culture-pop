import { expect, test, type Page } from '@playwright/test';
import { skipTours } from './returningReader';

/**
 * Live: real sign-in against the Supabase test project, through our own `/api/auth/*`.
 * Needs E2E_USER_EMAIL and E2E_USER_PASSWORD (a test user made by hand in Supabase) plus the
 * server's SUPABASE_* and APP_ORIGIN. Run with `npm run test:e2e:live`.
 */

const EMAIL = process.env.E2E_USER_EMAIL ?? '';
const PASSWORD = process.env.E2E_USER_PASSWORD ?? '';
/** What a Supabase access or refresh token looks like (a JWT starts "eyJ"). */
const TOKEN_LIKE = /eyJ[\w-]{10,}\.|access_token|refresh_token/;

// Only `npm run test:e2e:live` runs this file (the normal suite leaves it out), so missing details are
// a setup mistake to say out loud, not a reason to pass quietly.
if (!EMAIL || !PASSWORD) {
  throw new Error(
    'Live sign-in test needs E2E_USER_EMAIL and E2E_USER_PASSWORD in .env (see .env.example).',
  );
}

test.beforeEach(({ page }) => skipTours(page));

const mascot = (page: Page) => page.getByRole('img', { name: /mascot/i });
const passwordBox = (page: Page) => page.locator('#sign-in-password');

async function fillAndSubmit(page: Page, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await passwordBox(page).fill(password);
  return Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/password')),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]).then(([response]) => response);
}

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === 'pcd_session');
}

/** Everything page scripts can read: cookies, localStorage and sessionStorage. */
async function scriptVisibleStorage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const dump = (s: Storage) =>
      Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i) ?? '')}`);
    return [document.cookie, ...dump(localStorage), ...dump(sessionStorage)].join('\n');
  });
}

test('a wrong password is refused and no session is made', async ({ page }) => {
  await page.goto('/sign-in');
  const response = await fillAndSubmit(page, `${PASSWORD}-wrong`);
  expect(response.status()).toBe(401);
  await expect(page.getByRole('alert')).toHaveText("That email and password don't match.");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await sessionCookie(page)).toBeUndefined();
});

test('signs in with a password, keeps tokens off the page, and signs out', async ({ page }) => {
  await page.goto('/sign-in');

  // The mascot: eyes follow the email; hands over its eyes for the password; peeks when shown.
  await expect(mascot(page)).toHaveAttribute('data-pose', 'rest');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await expect(mascot(page)).not.toHaveAttribute('data-gaze', 'none');
  await passwordBox(page).click();
  await expect(mascot(page)).toHaveAttribute('data-pose', /cover|peek-right/);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(mascot(page)).toHaveAttribute('data-pose', 'peek-left');
  await expect(passwordBox(page)).toHaveAttribute('type', 'text');

  const response = await fillAndSubmit(page, PASSWORD);
  expect(response.status()).toBe(200);
  expect(await response.text()).not.toMatch(TOKEN_LIKE);
  expect(response.headers()['cache-control']).toBe('private, no-store');

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('p', { hasText: 'Signed in as' })).toContainText(EMAIL.toLowerCase());

  // The cookie: HttpOnly, Secure, SameSite=Strict, only sent to /api.
  const cookie = await sessionCookie(page);
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/api' });

  // Nothing token-like where page scripts can read it; the only account trace is the email hint.
  const visible = await scriptVisibleStorage(page);
  expect(visible).not.toContain('pcd_session');
  expect(visible).not.toMatch(TOKEN_LIKE);
  expect(visible).not.toContain(cookie?.value ?? '<none>');

  // The server agrees, and its answer carries no token either.
  const session = await page.request.get('/api/auth/session');
  const sessionText = await session.text();
  expect(JSON.parse(sessionText)).toMatchObject({ signedIn: true, email: EMAIL.toLowerCase() });
  expect(sessionText).not.toMatch(TOKEN_LIKE);

  // A request from another site is refused even with the cookie.
  const forged = await page.request.post('/api/auth/logout', {
    headers: {
      Origin: 'https://evil.example',
      'Sec-Fetch-Site': 'cross-site',
      'X-PCD-Request': '1',
    },
  });
  expect(forged.status()).toBe(403);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(await sessionCookie(page)).toBeUndefined();
  const after = await page.request.get('/api/auth/session');
  expect(await after.json()).toEqual({ signedIn: false });
});
