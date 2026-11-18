import { expect, test, type Route } from '@playwright/test';
import { skipTours } from './returningReader';

// The preview server has no /api, so both functions are answered here in the shapes the real ones
// use. CARD_DRAFT_FAKE and WEB_SEARCH_FAKE only work on a local `vercel dev` server, which is why
// this spec mocks with page.route.
test.use({ serviceWorkers: 'block' });
test.beforeEach(({ page }) => skipTours(page));

const SEARCH = 'zorbo quibble';
const WEB_RESULTS = [
  {
    url: 'https://example.com/zorbo-1',
    title: 'Zorbo quibble explained',
    snippet: 'A zorbo quibble is a playful argument about nothing much.',
  },
  {
    url: 'https://example.org/zorbo-2',
    title: 'What a zorbo quibble means',
    snippet: 'People start a zorbo quibble to tease a friend.',
  },
];
const DRAFT = {
  card: {
    label: 'A playful argument',
    gist: 'A friendly squabble about nothing.',
    means: 'They are teasing you.',
    reply: 'Fine, you win.',
    summary: [{ text: 'A zorbo quibble is a playful argument.', sources: [0] }],
    context: [{ text: 'Used to tease a friend.', sources: [1] }],
    example: null,
    spoiler: 'none',
  },
  notUsed: [],
  provider: 'fake',
  promptVersion: 'card-draft-v7',
};

const json = (route: Route, body: unknown) => route.fulfill({ json: body });

test('search, pick two frames and a filter, make a card, keep it, find it in Your cards', async ({
  page,
}) => {
  await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
  let draftBody: { sources?: unknown[]; tones?: unknown[] } = {};
  await page.route('**/api/draft-card', (route) => {
    draftBody = route.request().postDataJSON();
    return json(route, DRAFT);
  });

  // A favourite is the tone card the filter is made from.
  await page.goto('/search');
  await page.getByRole('searchbox', { name: 'Search references' }).fill('hakuna matata');
  await page.getByRole('link', { name: /Hakuna matata \(Swahili phrase\)/ }).click();
  await page.getByRole('button', { name: 'Favourite' }).click();
  await expect(page.getByRole('button', { name: 'Favourite' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.goto(`/search?q=${encodeURIComponent(SEARCH)}`);
  await page.getByRole('button', { name: 'Search the wider web' }).click();
  await page
    .getByRole('region', { name: 'Search the wider web?' })
    .getByRole('button', { name: 'Search the wider web' })
    .click();
  await page.getByRole('button', { name: 'Make a card from these' }).click();

  await page.getByRole('button', { name: /Zorbo quibble explained/ }).click();
  await page.getByRole('button', { name: /What a zorbo quibble means/ }).click();
  await page.getByRole('button', { name: 'Hakuna matata (Swahili phrase)', exact: true }).click();
  await page.getByRole('button', { name: 'Review 2 frames' }).click();

  const check = page.getByRole('region', { name: 'Splice check' });
  await expect(check).toBeVisible();
  await page.getByRole('button', { name: 'Make a card' }).click();

  await expect(page.getByText('AI draft · check the sources')).toBeVisible();
  await expect(page.getByRole('article', { name: DRAFT.card.label })).toBeVisible();
  expect(draftBody.sources).toHaveLength(2);
  expect(draftBody.tones).toHaveLength(1);

  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByText('Kept on this device.')).toBeVisible();

  await page.goto('/favourites');
  await expect(page.getByRole('heading', { name: 'Your cards' })).toBeVisible();
  await page.getByRole('button', { name: DRAFT.card.label }).click();
  await expect(page.getByText('AI draft · check the sources')).toBeVisible();
});
