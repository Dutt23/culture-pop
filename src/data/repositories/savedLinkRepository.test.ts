import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/renderApp';
import { createRepositories } from './index';

const T0 = '2026-11-16T09:00:00.000Z';
const LINK = {
  title: 'Why are Ferrari fans always sad?',
  url: 'https://www.reddit.com/r/formula1/comments/abc/',
};

async function setup() {
  const db = createTestDatabase();
  await db.open();
  return { db, repos: createRepositories(db) };
}

describe('saved web links (owner choice A)', () => {
  it('toggles a link on and off', async () => {
    const { db, repos } = await setup();
    expect(await repos.savedLinks.toggle(LINK)).toBe(true);
    expect(await repos.savedLinks.list()).toEqual([{ ...LINK, savedAt: expect.any(String) }]);
    expect(await repos.savedLinks.toggle(LINK)).toBe(false);
    expect(await repos.savedLinks.list()).toEqual([]);
    db.close();
  });

  it('lists the newest first', async () => {
    const { db, repos } = await setup();
    await db.savedLinks.bulkPut([
      { url: 'https://a.test/', title: 'A', savedAt: '2026-11-14T09:00:00.000Z' },
      { url: 'https://c.test/', title: 'C', savedAt: '2026-11-16T09:00:00.000Z' },
      { url: 'https://b.test/', title: 'B', savedAt: '2026-11-15T09:00:00.000Z' },
    ]);
    expect((await repos.savedLinks.list()).map((link) => link.title)).toEqual(['C', 'B', 'A']);
    db.close();
  });

  it('keeps only the title, link and date, never a snippet', async () => {
    const { db, repos } = await setup();
    const withSnippet = { ...LINK, snippet: 'Because the team keeps throwing away wins.' };
    await repos.savedLinks.toggle(withSnippet as never);
    expect(await db.savedLinks.toArray()).toEqual([{ ...LINK, savedAt: expect.any(String) }]);
    db.close();
  });

  it.each(['http://example.test/page', 'javascript:alert(1)', 'https://user:pass@example.test/'])(
    'refuses %s',
    async (url) => {
      const { db, repos } = await setup();
      expect(await repos.savedLinks.toggle({ title: 'Nope', url })).toBe(false);
      expect(await db.savedLinks.count()).toBe(0);
      db.close();
    },
  );

  it('skips malformed stored rows on the way out', async () => {
    const { db, repos } = await setup();
    await db.savedLinks.bulkPut([
      { url: 'javascript:alert(1)', title: 'Script', savedAt: T0 },
      { url: 'http://plain.test/', title: 'Plain', savedAt: T0 },
      { url: 'https://numbered.test/', title: 42, savedAt: T0 },
      { url: 'https://blank.test/', title: '  ', savedAt: T0 },
      { url: 'https://undated.test/', title: 'Undated' },
      // Not the normalised form toggle writes (no trailing slash): toggling would duplicate it.
      { url: 'https://unslashed.test', title: 'Unslashed', savedAt: T0 },
      { ...LINK, savedAt: T0 },
    ] as never);
    expect(await repos.savedLinks.list()).toEqual([{ ...LINK, savedAt: T0 }]);
    db.close();
  });

  it('removes a link saved under another spelling of the same address', async () => {
    const { db, repos } = await setup();
    await repos.savedLinks.toggle({ title: 'Page', url: 'https://example.test' });
    expect(await repos.savedLinks.toggle({ title: 'Page', url: 'https://example.test/' })).toBe(
      false,
    );
    expect(await db.savedLinks.count()).toBe(0);
    db.close();
  });

  it('uses the site name when the title is empty', async () => {
    const { db, repos } = await setup();
    await repos.savedLinks.toggle({ title: '   ', url: 'https://www.knowyourmeme.com/memes/x' });
    expect((await repos.savedLinks.list()).map((link) => link.title)).toEqual(['knowyourmeme.com']);
    db.close();
  });

  it('is deleted by Reset', async () => {
    const { db, repos } = await setup();
    await repos.savedLinks.toggle(LINK);
    await repos.resetUserData();
    expect(await db.savedLinks.count()).toBe(0);
    db.close();
  });

  it('is kept by Clear history', async () => {
    const { db, repos } = await setup();
    await repos.history.record({ text: 'ferrari fans' }, Date.parse(T0));
    await repos.savedLinks.toggle(LINK);
    await repos.history.clear();
    expect(await db.searchHistory.count()).toBe(0);
    expect(await db.savedLinks.count()).toBe(1);
    db.close();
  });
});
