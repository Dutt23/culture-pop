import { expect, test, type Locator, type Page } from '@playwright/test';
import { skipTours } from './returningReader';

test.beforeEach(({ page }) => skipTours(page));

function primaryNav(page: Page) {
  return page.getByRole('navigation', { name: 'Primary' });
}

/** Browse is a virtual list: scroll down until `target` is in the page. */
async function scrollUntilPresent(page: Page, target: Locator) {
  // A phone shows one card per row, so the list is long: a screen and a half per step, no backoff.
  await expect(async () => {
    if ((await target.count()) === 0) await page.mouse.wheel(0, 1200);
    await expect(target).not.toHaveCount(0, { timeout: 200 });
  }).toPass({ intervals: [0], timeout: 15_000 });
  await target.first().scrollIntoViewIfNeeded();
}

test('discover is the landing page and the layout never scrolls sideways', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Decode any reference' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('ambiguous search lists every meaning and keeps a shareable URL', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('searchbox', { name: 'Search references' }).fill('hakuna matata');
  await expect(page.getByText(/can mean 2 different things/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Hakuna matata \(Swahili phrase\)/ })).toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=hakuna/);

  await page.getByRole('link', { name: /Hakuna matata \(Swahili phrase\)/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Swahili phrase/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByText(/can mean 2 different things/)).toBeVisible();
});

test('a favourite persists across reload', async ({ page }) => {
  await page.goto('/references/doh-simpsons');
  const favourite = page.getByRole('button', { name: 'Favourite' });
  await expect(favourite).toHaveAttribute('aria-pressed', 'false');
  await favourite.click();
  await expect(favourite).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Favourite' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await primaryNav(page).getByRole('link', { name: 'Favourites' }).click();
  await expect(page.getByRole('link', { name: /D'oh! \(The Simpsons\)/ })).toBeVisible();
});

test('spoilers stay hidden until revealed', async ({ page }) => {
  await page.goto('/references/the-snap-avengers');
  await expect(page.getByText(/Spoiler ahead/)).toBeVisible();
  await expect(page.getByText(/turn to dust/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal spoiler' }).click();
  await expect(page.getByText(/turn to dust/)).toBeVisible();
});

test('reduced-motion setting removes movement', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Reduce' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  const distance = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--motion-lift').trim(),
  );
  expect(distance).toBe('0px');
});

test.describe('with a reduced-motion device preference', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the default "match device" setting respects it', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'system');
    const distance = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--motion-lift').trim(),
    );
    expect(distance).toBe('0px');
  });
});

test('keyboard users can skip to content and search', async ({ page }) => {
  await page.goto('/discover');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  // Skip link moves focus to <main>; the next stop is the search field.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('searchbox', { name: 'Search references' })).toBeFocused();
  await page.keyboard.type('bazinga');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=bazinga/);
  await expect(page.getByRole('link', { name: /Bazinga!/ })).toBeVisible();
});

test('searching makes no third-party requests', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      foreign.push(url);
    }
  });

  await page.goto('/search?q=let%20it%20go');
  await expect(page.getByText(/can mean 2 different things/)).toBeVisible();
  await page.goto('/search?q=nothing%20matches%20this');
  await expect(page.getByText(/Nothing in your library/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Search Wikipedia/ })).toHaveAttribute(
    'href',
    'https://en.wikipedia.org/w/index.php?search=nothing%20matches%20this',
  );
  expect(foreign).toEqual([]);
});

test('the production build enforces a strict CSP without violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(
        `Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });

  await page.goto('/discover');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /default-src 'self'.*script-src 'self'/,
  );
  // Exercise Motion inline styles, icons, spoiler reveal and settings writes.
  await page.goto('/references/the-snap-avengers');
  await page.getByRole('button', { name: 'Reveal spoiler' }).click();
  await expect(page.getByText(/turn to dust/)).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  expect(violations).toEqual([]);
});

test('the app shell works offline after the first load', async ({ page, context }) => {
  await page.goto('/discover');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Decode any reference' })).toBeVisible();
  await expect(page.getByText(/You're offline\. Everything saved/)).toBeVisible();

  await page.goto('/references/bazinga-big-bang-theory');
  await expect(page.getByRole('heading', { level: 1, name: /Bazinga!/ })).toBeVisible();
  await context.setOffline(false);
});

test('Discover browses by type and opens a reference page offline', async ({ page, context }) => {
  await page.goto('/discover');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/You're offline\. Everything saved/)).toBeVisible();
  const browse = page.getByRole('region', { name: 'Browse' });
  await browse.getByRole('radio', { name: 'By type' }).check();
  await expect(browse.getByText(/^You're offline\. Browse what's on this device/)).toBeVisible();

  const bazinga = browse.getByRole('link', { name: /Bazinga!/ });
  await scrollUntilPresent(page, bazinga);
  await bazinga.click();
  await expect(page.getByRole('heading', { level: 1, name: /Bazinga!/ })).toBeVisible();
  await context.setOffline(false);
});

test('Browse keeps only the cards near the screen in the page', async ({ page }) => {
  await page.goto('/discover');
  const browse = page.getByRole('region', { name: 'Browse' });
  const cards = browse.getByRole('link');
  await expect(cards.first()).toBeAttached();
  const firstCard = browse.locator(`a[href="${await cards.first().getAttribute('href')}"]`);

  // Scroll a screen at a time until the end of the page stays in view.
  await expect(async () => {
    await page.mouse.wheel(0, 2000);
    const atEnd = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
    );
    expect(atEnd).toBe(true);
  }).toPass({ timeout: 15_000 });

  await expect(firstCard).toHaveCount(0);
  await expect(cards.last()).toBeVisible();
});
