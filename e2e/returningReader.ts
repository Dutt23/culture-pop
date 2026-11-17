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
