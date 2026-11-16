import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

const FIXTURES = resolve('src/services/retrieval/fixtures');
const WIKIMEDIA_HOSTS = [
  'en.wikipedia.org',
  'query.wikidata.org',
  'en.wiktionary.org',
  'en.wikiquote.org',
];
const PROVIDER_HOSTS = [...WIKIMEDIA_HOSTS, 'api.tvmaze.com'];

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8'));
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'api-user-agent',
};

/** Serves recorded responses; `fail` aborts that host like a dropped connection. */
async function mockWikimedia(page: Page, fail: string[] = []) {
  const bodies: Record<string, unknown> = {
    'en.wikipedia.org': fixture('wikipedia-the-matrix.json'),
    'query.wikidata.org': fixture('wikidata-the-matrix.json'),
    'en.wiktionary.org': fixture('wiktionary-missing.json'),
    'en.wikiquote.org': { batchcomplete: true, query: { search: [] } },
    'api.tvmaze.com': [],
  };
  for (const host of PROVIDER_HOSTS) {
    await page.route(`https://${host}/**`, (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      if (fail.includes(host)) return route.abort('failed');
      return route.fulfill({ json: bodies[host], headers: CORS_HEADERS });
    });
  }
}

// page.route cannot see requests that a service worker handles, so keep it out of these tests.
test.use({ serviceWorkers: 'block' });

test('online search asks first, contacts only the listed providers, and cites its sources', async ({
  page,
  baseURL,
}) => {
  await mockWikimedia(page);
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const external: { host: string; userAgent: string | undefined }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin && request.method() === 'GET') {
      external.push({ host: url.hostname, userAgent: request.headers()['api-user-agent'] });
    }
  });
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      cspViolations.push(message.text());
    }
  });

  await page.goto('/search?q=the%20matrix');
  await expect(page.getByRole('heading', { name: 'Search online?' })).toBeVisible();
  expect(external).toEqual([]);

  await page.getByRole('button', { name: 'Search online' }).click();
  const film = page.getByRole('link').filter({ hasText: 'The Matrix' }).filter({ hasText: '1999' });
  await expect(film.first()).toBeVisible();

  // Wikidata follows Wikipedia's answer, so it can still be on its way when the card first shows.
  // Films only: TVmaze is asked only about series Wikidata identified, so it isn't contacted here.
  await expect.poll(() => new Set(external.map((r) => r.host))).toEqual(new Set(WIKIMEDIA_HOSTS));
  for (const request of external) {
    // Wikimedia asks for Api-User-Agent; TVmaze must get no custom header (its preflight is a 405).
    if (WIKIMEDIA_HOSTS.includes(request.host)) {
      expect(request.userAgent).toMatch(/^PopCultureDecoder\//);
    } else {
      expect(request.userAgent).toBeUndefined();
    }
  }

  await film.first().click();
  await expect(page.getByRole('heading', { name: 'Explained from sources' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Wikipedia: The Matrix/ })).toHaveAttribute(
    'href',
    'https://en.wikipedia.org/wiki/The_Matrix',
  );
  expect(cspViolations).toEqual([]);
});

test('a provider outage is named while other results still show', async ({ page }) => {
  await mockWikimedia(page, ['en.wiktionary.org']);
  await page.goto('/search?q=the%20matrix');
  await page.getByRole('button', { name: 'Search online' }).click();
  await expect(page.getByText("Wiktionary couldn't be reached.")).toBeVisible();
  // Target the card by its stable ID: other cards' excerpts can mention this title too.
  await expect(page.locator('a[href="/references/wd%3AQ207536"]')).toBeVisible();
});
