import { describe, expect, it } from 'vitest';
import { FIXED_NOW, makeSource } from '../test/factories';
import { BACKUP_APP, BackupError, backupFileName, readBackup } from './backup';

const empty = {
  app: BACKUP_APP,
  version: 1,
  exportedAt: FIXED_NOW,
  favourites: [],
  savedLinks: [],
  settings: [],
  packs: [],
  references: [],
};

const read = (fields: Record<string, unknown>) =>
  readBackup(JSON.stringify({ ...empty, ...fields }));

describe('reading a backup file', () => {
  it('refuses a file that is not a backup, with a plain message', () => {
    const notBackups = [
      'not json',
      '[]',
      '{"app":"something-else"}',
      JSON.stringify({ app: BACKUP_APP, version: 1 }),
    ];
    for (const text of notBackups) expect(() => readBackup(text)).toThrow(BackupError);
    expect(() => readBackup('{}')).toThrow("This file isn't a Pop Culture Decoder backup.");
  });

  it('refuses a backup from a newer version of the app', () => {
    expect(() => read({ version: 2 })).toThrow(/newer version/);
    for (const version of [0, 1.5, '1']) {
      expect(() => read({ version })).toThrow("This file isn't a Pop Culture Decoder backup.");
    }
  });

  it('keeps only settings this app can use, never the sign-in flag or search consents', () => {
    const { backup, skipped } = read({
      settings: [
        { key: 'theme', value: 'dark' },
        { key: 'searchTags', value: '["anime"]' },
        { key: 'webAccess', value: 'unlocked' },
        { key: 'retrieval', value: 'on' },
        { key: 'webSearch', value: 'on' },
        { key: 'theme', value: 'purple' },
        { key: 'accessCode', value: 'secret' },
      ],
    });
    expect(backup.settings).toEqual([
      { key: 'theme', value: 'dark' },
      { key: 'searchTags', value: '["anime"]' },
    ]);
    expect(skipped).toBe(5);
  });

  it('accepts only ISO dates, stored in one form', () => {
    const { backup, skipped } = read({
      favourites: [
        { referenceId: 'ok-boomer', savedAt: '2026-11-17T09:00:00+05:30' },
        { referenceId: 'doh-simpsons', savedAt: '1' },
        { referenceId: 'bazinga-big-bang-theory', savedAt: 'Jan 2' },
      ],
    });
    expect(backup.favourites).toEqual([
      { referenceId: 'ok-boomer', savedAt: '2026-11-17T03:30:00.000Z' },
    ]);
    expect(skipped).toBe(2);
  });

  it('keeps one row per favourite, link, setting and pack', () => {
    const { backup } = read({
      favourites: [
        { referenceId: 'ok-boomer', savedAt: FIXED_NOW },
        { referenceId: 'ok-boomer', savedAt: '2026-01-01T00:00:00.000Z' },
      ],
      settings: [
        { key: 'theme', value: 'dark' },
        { key: 'theme', value: 'light' },
      ],
    });
    expect(backup.favourites).toEqual([{ referenceId: 'ok-boomer', savedAt: FIXED_NOW }]);
    expect(backup.settings).toEqual([{ key: 'theme', value: 'dark' }]);
  });

  it('leaves out malformed items, counts them, and copies only known fields', () => {
    const { backup, skipped } = read({
      favourites: [
        { referenceId: 'ok-boomer', savedAt: FIXED_NOW, extra: 'dropped' },
        { referenceId: 'doh-simpsons' },
      ],
      savedLinks: [
        { url: 'https://example.org/page', title: ' A page ', savedAt: FIXED_NOW },
        { url: 'javascript:alert(1)', title: 'Bad', savedAt: FIXED_NOW },
      ],
      packs: [
        {
          id: 'pack:1',
          name: 'Before X-Men',
          ceiling: 'before_watching',
          now: true,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          members: [
            { referenceId: 'ok-boomer', addedAt: FIXED_NOW, doneAt: FIXED_NOW },
            { referenceId: 'ok-boomer', addedAt: FIXED_NOW },
          ],
        },
        { id: 'pack:2', name: 'Bad', ceiling: 'never', now: false, members: [] },
      ],
    });
    expect(backup.favourites).toEqual([{ referenceId: 'ok-boomer', savedAt: FIXED_NOW }]);
    expect(backup.savedLinks).toEqual([
      { url: 'https://example.org/page', title: 'A page', savedAt: FIXED_NOW },
    ]);
    // A card appears once per pack.
    expect(backup.packs).toEqual([
      expect.objectContaining({
        id: 'pack:1',
        members: [{ referenceId: 'ok-boomer', addedAt: FIXED_NOW, doneAt: FIXED_NOW }],
      }),
    ]);
    expect(skipped).toBe(3);
  });

  it('keeps an online card only with a source, and a year only with its source', () => {
    const source = makeSource('src:wd:Q99', 'Wikidata', {
      url: 'https://www.wikidata.org/wiki/Q99',
    });
    const { backup, skipped } = read({
      references: [
        {
          id: 'wd:Q99',
          title: 'Red pill',
          kind: 'meme',
          category: 'meme',
          year: 1999,
          yearSourceId: 'src:gone',
          sources: [source, { ...source, id: 'src:bad', url: 'http://insecure.example' }],
          externalLinks: [{ label: 'Bad', url: 'data:text/html,hi' }],
        },
        { id: 'wd:Q100', title: 'No sources', kind: 'meme', category: 'meme', sources: [] },
        // Not an online card's ID: a library card or anything else can't be written this way.
        { id: 'ok-boomer', title: 'Hijack', kind: 'meme', category: 'meme', sources: [source] },
        // A publisher's name on someone else's site doesn't count as that publisher.
        {
          id: 'wd:Q101',
          title: 'Fake',
          kind: 'meme',
          category: 'meme',
          sources: [{ ...source, id: 'src:fake', url: 'https://evil.example/wiki/Q101' }],
        },
        // The same address under another ID would clash in the database.
        {
          id: 'wd:Q102',
          title: 'Clash',
          kind: 'meme',
          category: 'meme',
          sources: [{ ...source, id: 'src:other' }],
        },
      ],
    });
    expect(backup.references).toEqual([
      {
        id: 'wd:Q99',
        title: 'Red pill',
        kind: 'meme',
        category: 'meme',
        sources: [source],
        externalLinks: [],
      },
    ]);
    expect(skipped).toBe(4);
  });

  it('names the file after the day it was made', () => {
    expect(backupFileName(new Date(2026, 10, 7, 23, 30))).toBe(
      'pop-culture-backup-2026-11-07.json',
    );
  });
});
