import { describe, expect, it } from 'vitest';
import { dropFanWorks, isFanSite } from './snippet.js';

describe('dropFanWorks', () => {
  it('drops excerpt fragments that are about fan works and keeps the canon ones', () => {
    const page =
      'Frieza wipes out the Saiyans in Dragon Ball Z. ... The Big Bad of the Sonic fan animation Nazo Unleashed destroys the planet. ... In a popular fanfic, Goku destroys Earth. ... Sailor Galaxia destroys several planets.';
    expect(dropFanWorks(page)).toBe(
      'Frieza wipes out the Saiyans in Dragon Ball Z. ... Sailor Galaxia destroys several planets.',
    );
  });

  it('cuts a fragment at a surviving "Fan Works" heading and keeps the canon text before it', () => {
    const page =
      'Anime & Manga Key the Metal Idol : people respond this way. Fan Works The Weaver kills everyone. ... Fan Fiction The Conversion Bureau converts mankind.';
    expect(dropFanWorks(page)).toBe('Anime & Manga Key the Metal Idol : people respond this way.');
  });

  it('leaves a page without fan-work markers unchanged, including words like "fans"', () => {
    const page = 'Fans call Vegeta the Prince of all Saiyans. ... He is a fan favourite.';
    expect(dropFanWorks(page)).toBe(page);
  });
});

describe('isFanSite', () => {
  it('flags fanon and fan-fiction sites but not ordinary fandom wikis', () => {
    expect(isFanSite('charactersfanon.fandom.com')).toBe(true);
    expect(isFanSite('archiveofourown.org')).toBe(true);
    expect(isFanSite('www.fanfiction.net')).toBe(true);
    expect(isFanSite('dragonball.fandom.com')).toBe(false);
    expect(isFanSite('villains.fandom.com')).toBe(false);
    expect(isFanSite('tvtropes.org')).toBe(false);
  });

  it('matches whole host labels, not substrings', () => {
    expect(isFanSite('fanon.example.com')).toBe(false);
    expect(isFanSite('notwattpad.com')).toBe(false);
    expect(isFanSite('archiveofourown.org.evil.test')).toBe(false);
    expect(isFanSite('blog.fanfiction.net')).toBe(true);
  });
});
