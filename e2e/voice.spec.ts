import { expect, test, type Page } from '@playwright/test';
import { returningReader } from './returningReader';

/**
 * Voice search with a fake speech engine: real speech can't be automated, so this checks the app's
 * side (button, listening state, words into the box, search runs). The owner checks real speech on
 * phones by hand. No audio is involved and nothing goes to a speech service.
 */

test.beforeEach(({ page }) => returningReader(page));

/**
 * Replace the browser's engine (Chromium has a real one) with one the test drives: it listens until
 * `speak` or `failWith` is called, so nothing depends on timing.
 */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    interface Fake {
      lang: string;
      onresult: ((event: unknown) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
    }
    const w = window as unknown as {
      __speech: { active: Fake | null; lang: string; starts: number };
      __speak: (words: string[]) => void;
      __failWith: (error: string) => void;
    };
    w.__speech = { active: null, lang: '', starts: 0 };
    class FakeRecognition implements Fake {
      lang = '';
      continuous = true;
      interimResults = false;
      maxAlternatives = 0;
      onresult: Fake['onresult'] = null;
      onerror: Fake['onerror'] = null;
      onend: Fake['onend'] = null;
      start() {
        w.__speech = { active: this, lang: this.lang, starts: w.__speech.starts + 1 };
      }
      stop() {
        w.__speech.active = null;
        this.onend?.();
      }
      abort() {
        w.__speech.active = null;
      }
    }
    /** Interim words, the last one final, then the engine ends as it does after a pause. */
    w.__speak = (words) => {
      const engine = w.__speech.active;
      if (!engine) throw new Error('not listening');
      words.forEach((text, index) => {
        const result = Object.assign([{ transcript: text }], {
          isFinal: index === words.length - 1,
        });
        engine.onresult?.({ resultIndex: 0, results: [result] });
      });
      w.__speech.active = null;
      engine.onend?.();
    };
    w.__failWith = (error) => {
      const engine = w.__speech.active;
      if (!engine) throw new Error('not listening');
      w.__speech.active = null;
      engine.onerror?.({ error });
      engine.onend?.();
    };
    for (const key of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, key, { configurable: true, value: FakeRecognition });
    }
  });
}

type SpeechWindow = {
  __speech: { lang: string; starts: number };
  __speak: (words: string[]) => void;
  __failWith: (error: string) => void;
};
const speak = (page: Page, words: string[]) =>
  page.evaluate((said) => (window as unknown as SpeechWindow).__speak(said), words);
const failWith = (page: Page, error: string) =>
  page.evaluate((code) => (window as unknown as SpeechWindow).__failWith(code), error);
const speechLang = (page: Page) =>
  page.evaluate(() => (window as unknown as SpeechWindow).__speech.lang);

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search references' });
const mic = (page: Page) => page.getByRole('button', { name: 'Search by voice' });

test('speaking a search fills the box and shows results', async ({ page }) => {
  await fakeSpeech(page);
  await page.goto('/search');

  await expect(mic(page)).toBeVisible();
  const box = await mic(page).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);

  await mic(page).click();
  await expect(page.getByText(/Listening… speak now/)).toBeVisible();
  await expect(page.getByText(/Google in Chrome, Apple in Safari/)).toBeVisible();
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await speechLang(page)).toMatch(/^en/);

  await speak(page, ['hakuna', 'hakuna matata']);
  await expect(searchBox(page)).toHaveValue('hakuna matata');
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/can mean 2 different things/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ })).toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=hakuna/);

  // What was heard is editable like typed text.
  await searchBox(page).fill('hakuna matata song');
  await expect(searchBox(page)).toHaveValue('hakuna matata song');
});

test('speaking on Discover opens the search page with the results', async ({ page }) => {
  await fakeSpeech(page);
  await page.goto('/discover');
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'true');
  await speak(page, ['hakuna matata']);
  await expect(page).toHaveURL(/\/search\?q=hakuna(%20|\+)matata/);
  await expect(searchBox(page)).toHaveValue('hakuna matata');
  await expect(page.getByRole('link', { name: /Hakuna Matata \(The Lion King\)/ })).toBeVisible();
});

test('a blocked microphone says how to allow it', async ({ page }) => {
  await fakeSpeech(page);
  await page.goto('/search');
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'true');
  await failWith(page, 'not-allowed');
  await expect(page.getByRole('status').filter({ hasText: /microphone is blocked/ })).toBeVisible();
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(searchBox(page)).toHaveValue('');
});

test('no microphone button where the browser has no speech recognition', async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, key, { configurable: true, value: undefined });
    }
  });
  await page.goto('/search');
  await expect(searchBox(page)).toBeVisible();
  await expect(mic(page)).toHaveCount(0);
});
