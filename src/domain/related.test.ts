import { describe, expect, it } from 'vitest';
import { makeAlias, makeReference } from '../test/factories';
import { relatedReferences } from './related';
import type { Reference } from './types';

const ff = { qid: 'Q1', label: 'Fantastic Four' };

function ids(references: readonly Reference[]): string[] {
  return references.map((r) => r.id);
}

describe('relatedReferences: shared work', () => {
  it('groups references that name the same work by qid, even under another label', () => {
    const thing = makeReference('thing', 'The Thing', { presentIn: [ff] });
    const doom = makeReference('doom', 'Doctor Doom', {
      inspiredBy: [{ qid: 'Q1', label: 'F4' }],
    });
    const { groups } = relatedReferences(thing, [thing, doom], []);
    expect(groups).toEqual([{ kind: 'work', label: 'Also in Fantastic Four', references: [doom] }]);
  });

  it('groups references that name the same work by label, ignoring case and qid', () => {
    const thing = makeReference('thing', 'The Thing', { presentIn: [ff] });
    const doom = makeReference('doom', 'Doctor Doom', {
      presentIn: [{ qid: 'Q777', label: 'FANTASTIC FOUR' }],
    });
    const other = makeReference('other', 'Unrelated', { presentIn: [{ qid: 'Q2', label: 'X' }] });
    const { groups } = relatedReferences(thing, [thing, doom, other], []);
    expect(groups.map((g) => [g.label, ids(g.references)])).toEqual([
      ['Also in Fantastic Four', ['doom']],
    ]);
  });

  it('makes one group per distinct work, capped at three groups', () => {
    const works = ['A', 'B', 'C', 'D'].map((name, i) => ({ qid: `Q${i}`, label: `Work ${name}` }));
    const hub = makeReference('hub', 'Hub', {
      presentIn: works.slice(0, 2),
      inspiredBy: works.slice(2),
    });
    const others = works.map((work, i) =>
      makeReference(`o${i}`, `Other ${i}`, { presentIn: [work] }),
    );
    const { groups } = relatedReferences(hub, [hub, ...others], []);
    expect(groups.map((g) => g.label)).toEqual([
      'Also in Work A',
      'Also in Work B',
      'Also inspired by Work C',
    ]);
  });

  it('keeps "inspired by" apart from "in": it is the reference\'s own relation to the work', () => {
    const matrix = { qid: 'Q9', label: 'The Matrix' };
    const redPill = makeReference('pill', 'Red pill', { inspiredBy: [matrix] });
    const rain = makeReference('rain', 'Digital rain', { presentIn: [matrix] });
    const { groups } = relatedReferences(redPill, [redPill, rain], []);
    expect(groups).toEqual([
      { kind: 'work', label: 'Also inspired by The Matrix', references: [rain] },
    ]);
    expect(relatedReferences(rain, [redPill, rain], []).groups.map((g) => g.label)).toEqual([
      'Also in The Matrix',
    ]);
  });

  it('gives one work one heading when its qid comes under two labels', () => {
    const hub = makeReference('hub', 'Hub', {
      presentIn: [
        { qid: 'Q1', label: 'Fantastic Four' },
        { qid: 'Q1', label: 'F4' },
      ],
      inspiredBy: [{ qid: 'Q1', label: 'The Fantastic Four' }],
    });
    const other = makeReference('other', 'Other', { presentIn: [ff] });
    const { groups } = relatedReferences(hub, [hub, other], []);
    expect(groups.map((g) => [g.label, ids(g.references)])).toEqual([
      ['Also in Fantastic Four', ['other']],
    ]);
  });
});

describe('relatedReferences: shared creator', () => {
  it('groups references by the same creator, ignoring case', () => {
    const thing = makeReference('thing', 'The Thing', { creators: ['Jack Kirby'] });
    const doom = makeReference('doom', 'Doctor Doom', { creators: ['Stan Lee', 'jack kirby'] });
    const { groups } = relatedReferences(thing, [thing, doom], []);
    expect(groups).toEqual([{ kind: 'creator', label: 'Also by Jack Kirby', references: [doom] }]);
  });

  it('makes at most two creator groups', () => {
    const names = ['Jack Kirby', 'Stan Lee', 'Steve Ditko'];
    const hub = makeReference('hub', 'Hub', { creators: names });
    const others = names.map((name, i) =>
      makeReference(`o${i}`, `Other ${i}`, { creators: [name] }),
    );
    const { groups } = relatedReferences(hub, [hub, ...others], []);
    expect(groups.map((g) => g.label)).toEqual(['Also by Jack Kirby', 'Also by Stan Lee']);
  });
});

describe('relatedReferences: same era', () => {
  it('uses the sourced year over the decade', () => {
    const a = makeReference('a', 'Alpha', { year: 2015, decade: '2000s' });
    const sourced = makeReference('b', 'Beta', { year: 2012 });
    const labelled = makeReference('c', 'Gamma', { decade: '2010s+' });
    const wrong = makeReference('d', 'Delta', { decade: '2000s' });
    const { groups } = relatedReferences(a, [a, sourced, labelled, wrong], []);
    expect(groups.map((g) => [g.kind, g.label, ids(g.references)])).toEqual([
      ['era', 'More from the 2010s & later', ['b', 'c']],
    ]);
  });

  it('falls back to the decade, and names the era in plain words', () => {
    const a = makeReference('a', 'Alpha', { decade: '2000s' });
    const b = makeReference('b', 'Beta', { decade: '2000s' });
    const old = makeReference('c', 'Gamma', { year: 1975 });
    const old2 = makeReference('d', 'Delta', { year: 1980 });
    expect(relatedReferences(a, [a, b], []).groups.map((g) => g.label)).toEqual([
      'More from the 2000s',
    ]);
    expect(relatedReferences(old, [old, old2], []).groups.map((g) => g.label)).toEqual([
      'More from before 1990',
    ]);
  });

  it('has no era group for a reference with no year or decade', () => {
    const a = makeReference('a', 'Alpha');
    const b = makeReference('b', 'Beta');
    expect(relatedReferences(a, [a, b], []).groups).toEqual([]);
  });
});

describe('relatedReferences: grouping rules', () => {
  it('lists a reference only in the first group it qualifies for (work, creator, era)', () => {
    const base = { creators: ['Jack Kirby'], decade: '2000s' as const };
    const thing = makeReference('thing', 'The Thing', { ...base, presentIn: [ff] });
    const doom = makeReference('doom', 'Doctor Doom', { ...base, presentIn: [ff] });
    const kirby = makeReference('kirby', 'Kirby Dots', { ...base });
    const era = makeReference('era', 'Era Only', { decade: '2000s' });
    const { groups } = relatedReferences(thing, [thing, doom, kirby, era], []);
    expect(groups.map((g) => [g.kind, ids(g.references)])).toEqual([
      ['work', ['doom']],
      ['creator', ['kirby']],
      ['era', ['era']],
    ]);
  });

  it('leaves out references already shown as another meaning of the same phrase', () => {
    const film = makeReference('film', 'Point Break (1991 film)', { presentIn: [ff] });
    const sense = makeReference('sense', 'Point Break', { presentIn: [ff] });
    const other = makeReference('other', 'Other', { presentIn: [ff] });
    const aliases = [makeAlias('sense', 'Point Break')];
    const related = relatedReferences(film, [film, sense, other], aliases);
    expect(ids(related.otherMeanings)).toEqual(['sense']);
    expect(related.groups.flatMap((g) => ids(g.references))).toEqual(['other']);
  });

  // Layered meanings show side by side even before they are explained; only reasoned links skip them.
  it('keeps an unexplained online result as another meaning, but never in a reasoned group', () => {
    const film = makeReference('film', 'Point Break (1991 film)', { decade: '1990s' });
    const raw = makeReference('raw', 'Point Break', { editorialState: 'retrieved' });
    const other = makeReference('other', 'Other', { decade: '1990s', editorialState: 'retrieved' });
    const related = relatedReferences(film, [film, raw, other], [makeAlias('raw', 'Point Break')]);
    expect(related.otherMeanings.map((r) => r.id)).toEqual(['raw']);
    expect(related.groups).toEqual([]);
  });

  it('shows at most three per group, in title order', () => {
    const hub = makeReference('hub', 'Hub', { presentIn: [ff] });
    const members = ['e', 'b', 'd', 'a', 'c'].map((t) =>
      makeReference(t, `Title ${t}`, { presentIn: [ff] }),
    );
    const { groups } = relatedReferences(hub, [hub, ...members], []);
    expect(ids(groups[0].references)).toEqual(['a', 'b', 'c']);
  });

  it('never includes the reference itself or an unexplained online one', () => {
    const hub = makeReference('hub', 'Hub', { presentIn: [ff] });
    const unexplained = makeReference('raw', 'Raw', {
      presentIn: [ff],
      editorialState: 'retrieved',
    });
    const explained = makeReference('ok', 'Ok', {
      presentIn: [ff],
      editorialState: 'source_curated',
    });
    const { groups } = relatedReferences(hub, [hub, unexplained, explained], []);
    expect(groups.flatMap((g) => ids(g.references))).toEqual(['ok']);
  });

  it('is empty when nothing is shared', () => {
    const a = makeReference('a', 'Alpha', {
      presentIn: [ff],
      creators: ['Jack Kirby'],
      year: 2001,
    });
    const b = makeReference('b', 'Beta', {
      presentIn: [{ qid: 'Q2', label: 'Other' }],
      creators: ['Stan Lee'],
      year: 1985,
    });
    expect(relatedReferences(a, [a, b], [])).toEqual({ otherMeanings: [], groups: [] });
  });
});
