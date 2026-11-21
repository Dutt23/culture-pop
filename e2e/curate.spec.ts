import { expect, test, type Route } from '@playwright/test';
import { returningReader } from './returningReader';

// The preview server has no /api, so both functions are answered here in the shapes the real ones
// use. CARD_DRAFT_FAKE and WEB_SEARCH_FAKE only work on a local `vercel dev` server, which is why
// this spec mocks with page.route.
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await returningReader(page);
  // Signed in, with wider web search turned on (D65): the card flow checks this before picking.
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: { signedIn: true, email: 'reader@example.test', quota: null, widerWeb: true },
    }),
  );
});

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
  // Wait for the card page: the search list behind it has titled hearts of its own.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hakuna matata (Swahili phrase)' }),
  ).toBeVisible();
  const favourite = page.getByRole('button', { name: 'Favourite', exact: true });
  await favourite.click();
  await expect(favourite).toHaveAttribute('aria-pressed', 'true');

  await page.goto(`/search?q=${encodeURIComponent(SEARCH)}`);
  // Signed in with the wider web on: it runs by itself on the miss (D65).
  // The entry sits above the results; the flow opens over the page as a dialog.
  const entry = page.getByRole('button', { name: 'Make a card from these' });
  await entry.click();
  const flow = page.getByRole('dialog', { name: `Make a card from “${SEARCH}”` });
  await expect(flow).toBeVisible();

  // A frame's name includes its snippet; the result's heart button ("Save link …") doesn't.
  await flow.getByRole('button', { name: WEB_RESULTS[0].snippet }).click();
  await flow.getByRole('button', { name: WEB_RESULTS[1].snippet }).click();
  await flow.getByRole('button', { name: 'Review 2 frames' }).click();
  await flow.getByRole('button', { name: 'Hakuna matata (Swahili phrase)', exact: true }).click();
  await flow.getByRole('button', { name: 'Review sources and style' }).click();

  const check = flow.getByRole('region', { name: 'Splice check' });
  await expect(check).toBeVisible();
  await flow.getByRole('button', { name: 'Make a card' }).click();

  await expect(flow.getByText('AI draft · check the sources')).toBeVisible();
  await expect(flow.getByRole('article', { name: DRAFT.card.label })).toBeVisible();
  expect(draftBody.sources).toHaveLength(2);
  expect(draftBody.tones).toHaveLength(1);

  await flow.getByRole('button', { name: 'Keep' }).click();
  await expect(flow.getByText('Kept on this device.')).toBeVisible();

  // Escape closes the dialog and hands focus back to the entry.
  await page.keyboard.press('Escape');
  await expect(flow).toBeHidden();
  await expect(entry).toBeFocused();

  await page.goto('/favourites');
  await expect(page.getByRole('heading', { name: 'Your cards' })).toBeVisible();
  await page.getByRole('button', { name: DRAFT.card.label, exact: true }).click();
  await expect(page.getByText('AI draft · check the sources')).toBeVisible();
});

test('partial list can be revised with omitted sources and clearly labelled user material', async ({
  page,
}) => {
  await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/draft-card', (route) => {
    bodies.push(route.request().postDataJSON());
    return json(route, {
      ...DRAFT,
      card: { ...DRAFT.card, kind: 'list', partial: bodies.length === 1 },
      notUsed: bodies.length === 1 ? [{ source: 1, why: 'not included in first draft' }] : [],
    });
  });
  await page.goto('/search?q=zorbo%20quibble');
  // Signed in with the wider web on: it runs by itself on the miss (D65).
  await page.getByRole('button', { name: 'Make a card from these' }).click();
  const flow = page.getByRole('dialog', { name: 'Make a card from “zorbo quibble”' });
  for (const result of WEB_RESULTS)
    await flow.getByRole('button', { name: result.snippet }).click();
  await flow.getByRole('button', { name: 'Review 2 frames' }).click();
  const format = flow.getByRole('group', { name: 'Card format' });
  await format.getByRole('button', { name: 'List' }).click();
  const colour = flow.getByRole('group', { name: 'Card colour' });
  await colour.getByRole('button', { name: 'Sage' }).click();
  await flow.getByRole('button', { name: 'Review sources and style' }).click();
  await flow.getByRole('button', { name: 'Make a card', exact: true }).click();
  await expect(
    flow.getByText('Partial draft · some selected material could not be included.'),
  ).toBeVisible();
  await flow.getByRole('checkbox', { name: 'Reconsider this source' }).check();
  await flow.getByRole('button', { name: 'Revise sources and curate again' }).click();
  await flow
    .getByRole('textbox', { name: 'Your context or text' })
    .fill('My personal reading of this joke.');
  await flow.getByRole('textbox', { name: 'Your source link' }).fill('https://example.net/zorbo');
  await flow
    .getByRole('textbox', { name: 'Link title (optional)' })
    .fill('Zorbo quibble reader source');
  await flow.getByRole('button', { name: 'Add link', exact: true }).click();
  await flow.getByRole('button', { name: 'Review 3 frames' }).click();
  await flow.getByRole('button', { name: 'Review sources and style' }).click();
  await flow.getByRole('button', { name: 'Make a card', exact: true }).click();
  await expect(flow.getByText('Added by you · unverified context')).toBeVisible();
  expect(bodies[1]).toMatchObject({
    kind: 'list',
    userContext: 'My personal reading of this joke.',
    retry: { preserveSources: [1] },
  });
  expect((bodies[1].sources as { provenance?: string }[])[2].provenance).toBe('user');
  await flow.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(flow.getByText('Kept on this device.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/favourites');
  await page.getByRole('button', { name: DRAFT.card.label, exact: true }).click();
  await expect(page.getByText('Added by you · unverified context')).toBeVisible();
  await expect(page.getByText('My personal reading of this joke.')).toBeVisible();
});

test('curation continues in Activity while the reader browses and persists its streamed result', async ({
  page,
}) => {
  await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/draft-card', async (route) => {
    expect(route.request().headers().accept).toBe('text/event-stream');
    await ready;
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        'event: started\ndata: {}\n\nevent: result\ndata: ' +
        JSON.stringify({ ...DRAFT, card: { ...DRAFT.card, context: [] } }) +
        '\n\n',
    });
  });
  await page.goto('/search?q=zorbo%20quibble');
  // Signed in with the wider web on: it runs by itself on the miss (D65).
  await page.getByRole('button', { name: 'Make a card from these' }).click();
  const flow = page.getByRole('dialog', { name: 'Make a card from “zorbo quibble”' });
  await flow.getByRole('button', { name: WEB_RESULTS[0].snippet }).click();
  await flow.getByRole('button', { name: 'Review 1 frame' }).click();
  await flow.getByRole('button', { name: 'Review sources and style' }).click();
  await flow.getByRole('button', { name: 'Make a card', exact: true }).click();
  await flow.getByRole('button', { name: 'Continue browsing' }).click();
  await expect(flow).toBeHidden();
  await page.getByRole('link', { name: 'Discover', exact: true }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await page.getByRole('link', { name: /^Activity/ }).click();
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await expect(page.getByText('1 of 5 cards in progress')).toBeVisible();
  finish();
  await expect(page.getByText('Ready to review')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Ready to review')).toBeVisible();
  await page.getByRole('button', { name: 'Review card' }).click();
  await expect(page.getByRole('article', { name: DRAFT.card.label })).toBeVisible();
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByText('Saved to Your cards')).toBeVisible();
});

test('reload marks an unfinished browser-owned job interrupted without resubmitting it', async ({
  page,
}) => {
  await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route('**/api/draft-card', async (route) => {
    calls += 1;
    await held;
    await json(route, { ...DRAFT, card: { ...DRAFT.card, context: [] } }).catch(() => {});
  });
  try {
    await page.goto('/search?q=zorbo%20quibble');
    // Signed in with the wider web on: it runs by itself on the miss (D65).
    await page.getByRole('button', { name: 'Make a card from these' }).click();
    const flow = page.getByRole('dialog', { name: 'Make a card from “zorbo quibble”' });
    await flow.getByRole('button', { name: WEB_RESULTS[0].snippet }).click();
    await flow.getByRole('button', { name: 'Review 1 frame' }).click();
    await flow.getByRole('button', { name: 'Review sources and style' }).click();
    await flow.getByRole('button', { name: 'Make a card', exact: true }).click();
    await flow.getByRole('button', { name: 'Continue browsing' }).click();
    await page.getByRole('link', { name: /^Activity/ }).click();
    await expect(page.getByText('1 of 5 cards in progress')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Interrupted when the app closed')).toBeVisible();
    await expect(page.getByText('0 of 5 cards in progress')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(calls).toBe(1);
  } finally {
    release();
  }
});

test.describe('the card maker hangs on a lanyard pass (owner, 2026-11-22)', () => {
  const PASS = `Make a card from “${SEARCH}”`;

  test('on a short phone the pass scrolls inside while its title, Close and the reel stay put', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 560 });
    await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
    await page.goto(`/search?q=${encodeURIComponent(SEARCH)}`);
    const entry = page.getByRole('button', { name: 'Make a card from these' });
    await entry.click();
    const flow = page.getByRole('dialog', { name: PASS });
    const pass = flow.getByRole('article', { name: PASS });
    await expect(pass).toBeVisible();
    await flow.getByRole('button', { name: WEB_RESULTS[0].snippet }).click();

    // The pass's own scroller: the child of the pass that scrolls (Lanyard's body).
    const scrolled = await pass.evaluate((article) => {
      const body = [...article.querySelectorAll<HTMLElement>(':scope > * > *')].find(
        (el) => getComputedStyle(el).overflowY === 'auto',
      );
      if (!body) return null;
      const before = body.scrollHeight > body.clientHeight;
      body.scrollTop = body.scrollHeight;
      return { before, moved: body.scrollTop > 0 };
    });
    expect(scrolled).toEqual({ before: true, moved: true });

    await expect(flow.getByRole('heading', { level: 2, name: PASS })).toBeInViewport();
    // Exact: the library list also has "Closer (The Chainsmokers)".
    const close = flow.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeInViewport();
    await expect(flow.getByRole('button', { name: 'Review 1 frame' })).toBeInViewport();

    await close.click();
    await expect(flow).toBeHidden();
    await expect(entry).toBeFocused();
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the pass just appears, with no swing', async ({ page }) => {
      await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
      await page.goto(`/search?q=${encodeURIComponent(SEARCH)}`);
      await page.getByRole('button', { name: 'Make a card from these' }).click();
      const pass = page.getByRole('dialog', { name: PASS }).getByRole('article', { name: PASS });
      await expect(pass).toBeVisible();
      // Read at once: a swinging pass would still be turned or see-through here.
      const style = await pass.evaluate((el) => {
        const s = getComputedStyle(el);
        return { transform: s.transform, opacity: s.opacity };
      });
      expect(style).toEqual({ transform: 'none', opacity: '1' });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: PASS })).toBeHidden();
    });
  });
});

test('Back closes the card dialog and keeps the search page; Back again leaves it', async ({
  page,
}) => {
  await page.route('**/api/web-search', (route) => json(route, { results: WEB_RESULTS }));
  await page.goto('/discover');
  await page.goto(`/search?q=${encodeURIComponent(SEARCH)}`);
  // Signed in with the wider web on: it runs by itself on the miss (D65).
  await page.getByRole('button', { name: 'Make a card from these' }).click();
  const flow = page.getByRole('dialog', { name: `Make a card from “${SEARCH}”` });
  await expect(flow).toBeVisible();

  await page.goBack();
  await expect(flow).toBeHidden();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole('button', { name: 'Make a card from these' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/discover$/);
});
