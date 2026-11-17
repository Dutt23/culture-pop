import type { Page } from '@playwright/test';

/** Start as a reader who has already seen the mascot tours (they have their own tests). */
export async function skipTours(page: Page) {
  await page.addInitScript(() => {
    for (const id of ['search', 'packs', 'pack']) localStorage.setItem(`pcd:tour-seen:${id}`, '1');
  });
}
