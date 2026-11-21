import { expect, test, type Page } from '@playwright/test';
import { returningReader } from './returningReader';

/**
 * How the sign-in guard (D66) follows the account: signed in already, signed out mid-use, in
 * another tab, and on Back. The preview server has no /api, so one shared switch answers the
 * session check.
 */

test.use({ serviceWorkers: 'block' });

interface Account {
  signedIn: boolean;
}

/** Answers the session check from `account`, and signing out flips it. Routes added later win. */
async function mockAccount(page: Page, account: Account) {
  await returningReader(page);
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: account.signedIn
        ? { signedIn: true, email: 'reader@example.test', quota: null, widerWeb: true }
        : { signedIn: false },
    }),
  );
  await page.route('**/api/auth/logout', (route) => {
    account.signedIn = false;
    return route.fulfill({ json: {} });
  });
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

/** Through the tab bar, so the app stays one page and Back is the app's own history. */
async function signOutInSettings(page: Page) {
  const tabs = page.getByRole('navigation', { name: 'Primary' });
  await tabs.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

test('someone signed in skips the sign-in page', async ({ page }) => {
  await mockAccount(page, { signedIn: true });
  await page.goto('/sign-in?next=%2Ffavourites');
  await expect(page).toHaveURL(/\/favourites$/);
  await expect(heading(page, 'Favourites')).toBeVisible();

  await page.goto('/sign-in');
  await expect(page).toHaveURL(/\/discover$/);
  await expect(heading(page, 'Decode any reference')).toBeVisible();
});

test('a sign-in that ends mid-use sends the reader to sign in, then back', async ({ page }) => {
  const account = { signedIn: true };
  await mockAccount(page, account);
  await page.route('**/api/web-search', (route) => {
    account.signedIn = false;
    return route.fulfill({ status: 401, json: { error: 'signed_out' } });
  });

  await page.goto('/search?q=zorbo%20quibble');
  await page.getByRole('button', { name: 'Search the wider web' }).click();
  await page
    .getByRole('region', { name: 'Search the wider web?' })
    .getByRole('button', { name: 'Search the wider web' })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsearch%3Fq%3Dzorbo/);
  await expect(heading(page, 'Sign in')).toBeVisible();
});

test('signing out in one tab signs the other tabs out too', async ({ page, context }) => {
  const account = { signedIn: true };
  await mockAccount(page, account);
  await page.goto('/discover');
  const other = await context.newPage();
  await mockAccount(other, account);
  await other.goto('/favourites');
  await expect(heading(other, 'Favourites')).toBeVisible();

  await signOutInSettings(page);
  await expect(other).toHaveURL(/\/sign-in\?next=%2Ffavourites$/);
  await expect(heading(other, 'Sign in')).toBeVisible();
});

test('after signing out, Back does not show the pages from before', async ({ page }) => {
  await mockAccount(page, { signedIn: true });
  await page.goto('/favourites');
  await expect(heading(page, 'Favourites')).toBeVisible();

  await signOutInSettings(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ffavourites$/);
  await expect(heading(page, 'Favourites')).toHaveCount(0);
});

test('the account tray slides out from the top bar, closes, and signs out', async ({ page }) => {
  await mockAccount(page, { signedIn: true });
  await page.goto('/packs');
  const account = page.getByRole('button', { name: 'Your account, reader@example.test' });

  await account.click();
  const tray = page.getByRole('dialog', { name: 'Your account' });
  await expect(tray).toBeVisible();
  await expect(tray.getByText('On', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tray).toHaveCount(0);
  await expect(account).toBeFocused();

  await account.click();
  await page.goBack();
  await expect(tray).toHaveCount(0);
  await expect(page).toHaveURL(/\/packs$/);

  await account.click();
  await tray.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('button', { name: /^Your account/ })).toHaveCount(0);
});

/** A long email wraps over several lines: the tray's middle has to scroll on a small screen. */
const LONG_EMAIL = `${'a-very-long-name.'.repeat(6)}reader@example.test`;

for (const [name, size] of [
  ['a small phone', { width: 320, height: 568 }],
  ['a phone on its side', { width: 568, height: 320 }],
] as const) {
  test(`the account tray scrolls its middle and keeps Sign out on ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockAccount(page, { signedIn: true });
    await page.addInitScript((email) => localStorage.setItem('pcd-account', email), LONG_EMAIL);
    await page.goto('/discover');
    await page.getByRole('button', { name: /^Your account/ }).click();
    const tray = page.getByRole('dialog', { name: 'Your account' });
    await expect(tray).toBeVisible();
    // Once it has slid in, it fills the phone's screen.
    await expect.poll(async () => (await tray.boundingBox())?.x).toBe(0);
    expect((await tray.boundingBox())?.width).toBe(size.width);

    const signOut = tray.getByRole('button', { name: 'Sign out' });
    await expect(signOut).toBeInViewport();
    // Tab reaches the last link, which scrolls into view; Sign out is still on screen.
    const activity = tray.getByRole('link', { name: 'Activity' });
    await activity.focus();
    await expect(activity).toBeInViewport();
    await expect(signOut).toBeInViewport();
  });
}
