import { describe, expect, it, vi } from 'vitest';
import { FIXED_NOW, fixtureGetJson, type FixtureQuery } from '../../test/fakeRetrieval';
import { firstValueFrom, toArray } from 'rxjs';
import { rerankCandidates } from './rerank';
import { retrieve, retrieve$, retrieveRaw } from './retrieve';
import { RetrievalError, type GetJson, type RetrievalResult } from './types';
import taarakMehtaTvmaze from './fixtures/tvmaze-taarak-mehta.json';

const now = () => FIXED_NOW;
const WIKIPEDIA = 'en.wikipedia.org';
const WIKIDATA = 'query.wikidata.org';
const WIKTIONARY = 'en.wiktionary.org';
const WIKIQUOTE = 'en.wikiquote.org';
const TVMAZE = 'api.tvmaze.com';

/** Answers every host with "nothing found" except the ones given. */
function onlyFrom(bodies: Record<string, unknown>): GetJson {
  const nothing: Record<string, unknown> = {
    [WIKIPEDIA]: { batchcomplete: true },
    [WIKTIONARY]: { query: { pages: [{ title: 'x', missing: true }] } },
    [WIKIQUOTE]: { query: { search: [] } },
    [TVMAZE]: [],
  };
  return async (url) => {
    const host = new URL(url).hostname;
    return bodies[host] ?? nothing[host];
  };
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Serves fixtures, but each host answers only once the test releases it. */
function gatedFixtures(query: FixtureQuery) {
  const serve = fixtureGetJson(query);
  const gates = new Map<string, { started: Deferred; release: Deferred }>();
  const gate = (host: string) => {
    const existing = gates.get(host);
    if (existing) return existing;
    const created = { started: deferred(), release: deferred() };
    gates.set(host, created);
    return created;
  };
  const getJson: GetJson = async (url, signal) => {
    const { started, release } = gate(new URL(url).hostname);
    started.resolve();
    await release.promise;
    return serve(url, signal);
  };
  return {
    getJson,
    started: (host: string) => gate(host).started.promise,
    release: (host: string) => gate(host).release.resolve(),
  };
}

describe('retrieve', () => {
  it('returns films with sourced years and drops disambiguation pages', async () => {
    const result = await retrieve('the matrix', { getJson: fixtureGetJson('the matrix'), now });
    expect(result.candidates.map((c) => c.id)).toEqual([
      'wd:Q83495',
      'wd:Q13014087',
      'wd:Q207536',
      'wd:Q80322391',
    ]);
    const film = result.candidates[0];
    expect(film).toMatchObject({
      category: 'film',
      kind: 'work',
      year: 1999,
      yearSourceId: 'src:wd:Q83495',
    });
    expect(film.sources.map((s) => s.publisher)).toEqual(['Wikipedia', 'Wikidata']);
    expect(film.sources[0]).toMatchObject({ license: 'CC BY-SA 4.0', retrievedAt: FIXED_NOW });
  });

  it('finds a 90s cartoon and excludes list articles', async () => {
    const result = await retrieve('swat kats', { getJson: fixtureGetJson('swat kats'), now });
    expect(result.candidates[0]).toMatchObject({
      id: 'wd:Q2077112',
      category: 'cartoon',
      year: 1993,
    });
    expect(result.candidates.some((c) => /^List of/.test(c.title))).toBe(false);
  });

  it('keeps every distinct meaning of an ambiguous phrase, including the dictionary sense', async () => {
    const result = await retrieve('hakuna matata', {
      getJson: fixtureGetJson('hakuna matata'),
      now,
    });
    const byId = new Map(result.candidates.map((c) => [c.id, c]));
    expect(byId.get('wd:Q1570072')).toMatchObject({ category: 'saying', kind: 'phrase' });
    expect(byId.get('wd:Q1646614')).toMatchObject({ category: 'music', year: 1994 });
    expect(byId.get('enwiktionary:hakuna matata')?.externalLinks).toEqual([]);
    expect(byId.get('enwiktionary:hakuna matata')?.sources[0]).toMatchObject({
      publisher: 'Wiktionary',
      excerpt: 'No worries, take it easy.',
    });
  });

  it('reports a failed provider without losing the others', async () => {
    const getJson = fixtureGetJson('hakuna matata', {
      wiktionary: new RetrievalError('network', 'down'),
    });
    const result = await retrieve('hakuna matata', { getJson, now });
    expect(result.outcomes).toEqual([
      { provider: 'wikipedia', status: 'ok' },
      { provider: 'wikidata', status: 'ok' },
      { provider: 'wiktionary', status: 'failed', failure: 'network' },
      { provider: 'wikiquote', status: 'empty' },
      { provider: 'tvmaze', status: 'skipped' },
    ]);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('drops unsourced years when Wikidata fails, but still returns Wikipedia hits', async () => {
    const getJson = fixtureGetJson('the matrix', {
      wikidata: new RetrievalError('timeout', 'slow'),
    });
    const result = await retrieve('the matrix', { getJson, now });
    expect(result.candidates[0].year).toBeUndefined();
    expect(result.candidates[0].sources.map((s) => s.publisher)).toEqual(['Wikipedia']);
  });

  it('skips Wikidata when Wikipedia found nothing to look up', async () => {
    const getJson = fixtureGetJson('the matrix', {
      wikipedia: new RetrievalError('rate_limited', 'slow down'),
    });
    const result = await retrieve('the matrix', { getJson, now });
    expect(result.outcomes[0]).toEqual({
      provider: 'wikipedia',
      status: 'failed',
      failure: 'rate_limited',
    });
    expect(result.outcomes[1]).toEqual({ provider: 'wikidata', status: 'skipped' });
    expect(result.candidates).toEqual([]);
  });

  it('starts Wiktionary and Wikiquote alongside Wikipedia instead of waiting for it', async () => {
    const started: string[] = [];
    let releaseWikipedia: () => void = () => undefined;
    const fixtures = fixtureGetJson('hakuna matata');
    const getJson: GetJson = async (url, signal) => {
      const host = new URL(url).hostname;
      started.push(host);
      if (host === 'en.wikipedia.org') {
        await new Promise<void>((resolve) => {
          releaseWikipedia = resolve;
        });
      }
      return fixtures(url, signal);
    };

    const pending = retrieve('hakuna matata', { getJson, now });
    await Promise.resolve();
    expect(started).toEqual([WIKTIONARY, WIKIQUOTE, WIKIPEDIA]);

    releaseWikipedia();
    const result = await pending;
    expect(started).toContain(WIKIDATA);
    expect(result.outcomes.slice(0, 3).every((o) => o.status === 'ok')).toBe(true);
  });

  it('streams Wikipedia candidates first, then classifies them when Wikidata answers', async () => {
    const gated = gatedFixtures('the matrix');
    const snapshots: RetrievalResult[] = [];
    const pending = retrieve('the matrix', { getJson: gated.getJson, now }, undefined, (s) => {
      snapshots.push(s);
    });

    gated.release(WIKIPEDIA);
    await gated.started(WIKIDATA);
    expect(snapshots).toHaveLength(1);
    const early = snapshots[0];
    expect(early.outcomes).toEqual([
      { provider: 'wikipedia', status: 'ok' },
      { provider: 'wikidata', status: 'pending' },
      { provider: 'wiktionary', status: 'pending' },
      { provider: 'wikiquote', status: 'pending' },
      { provider: 'tvmaze', status: 'pending' },
    ]);
    expect(early.candidates.map((c) => c.id)).toEqual([
      'wd:Q83495',
      'wd:Q13014087',
      'wd:Q207536',
      'wd:Q80322391',
    ]);
    expect(early.candidates.every((c) => c.classifying && c.externalLinks.length === 0)).toBe(true);
    // Until Wikidata says what a hit is, it's only a related page.
    expect(early.candidates.every((c) => c.role === 'topic')).toBe(true);
    expect(early.candidates[0]).toMatchObject({ category: 'other', kind: 'other' });
    expect(early.candidates[0].year).toBeUndefined();

    gated.release(WIKIDATA);
    gated.release(WIKTIONARY);
    gated.release(WIKIQUOTE);
    gated.release(TVMAZE);
    const final = await pending;
    expect(snapshots).toHaveLength(5);
    expect(snapshots[4]).toEqual(final);
    expect(final.candidates.every((c) => !c.classifying)).toBe(true);
    expect(final.candidates.map((c) => c.role)).toEqual(['work', 'topic', 'work', 'work']);
    expect(final.candidates[0]).toMatchObject({
      category: 'film',
      kind: 'work',
      year: 1999,
      yearSourceId: 'src:wd:Q83495',
      externalLinks: [
        { label: 'TV Tropes', url: 'https://tvtropes.org/pmwiki/pmwiki.php/Film/TheMatrix' },
        { label: 'Fandom', url: 'https://community.fandom.com/wiki/w:c:matrix:The_Matrix' },
      ],
    });
  });

  it('cites only Wikipedia when Wikidata adds neither a type nor a year', async () => {
    const result = await retrieve('the matrix', { getJson: fixtureGetJson('the matrix'), now });
    const franchise = result.candidates.find((c) => c.id === 'wd:Q13014087');
    expect(franchise).toMatchObject({ category: 'other', kind: 'other', classifying: false });
    expect(franchise?.year).toBeUndefined();
    expect(franchise?.sources.map((s) => s.publisher)).toEqual(['Wikipedia']);
  });

  it('classifies slang that Wikidata knows as an internet meme', async () => {
    const result = await retrieve('ok boomer', { getJson: fixtureGetJson('ok boomer'), now });
    expect(result.candidates[0]).toMatchObject({
      id: 'wd:Q74367025',
      category: 'meme',
      kind: 'meme',
      externalLinks: [{ label: 'Know Your Meme', url: 'https://knowyourmeme.com/memes/ok-boomer' }],
    });
    expect(result.candidates.some((c) => /^(List|Glossary) of/.test(c.title))).toBe(false);
    // Wiktionary only has a pointer entry, which is not a definition.
    expect(result.outcomes[2]).toEqual({ provider: 'wiktionary', status: 'empty' });
  });

  it('reports a MediaWiki error sent as HTTP 200 as a failed provider', async () => {
    const fixtures = fixtureGetJson('the matrix');
    const getJson: GetJson = async (url, signal) =>
      new URL(url).hostname === WIKIPEDIA
        ? { error: { code: 'ratelimited', info: 'You have exceeded your rate limit.' } }
        : fixtures(url, signal);
    const result = await retrieve('the matrix', { getJson, now });
    expect(result.outcomes).toEqual([
      { provider: 'wikipedia', status: 'failed', failure: 'rate_limited' },
      { provider: 'wikidata', status: 'skipped' },
      { provider: 'wiktionary', status: 'empty' },
      { provider: 'wikiquote', status: 'empty' },
      { provider: 'tvmaze', status: 'skipped' },
    ]);
    expect(result.candidates).toEqual([]);
  });

  it('emits no snapshot once cancelled, even if a provider answers late', async () => {
    const gated = gatedFixtures('the matrix');
    const controller = new AbortController();
    const onUpdate = vi.fn();
    const pending = retrieve(
      'the matrix',
      { getJson: gated.getJson, now },
      controller.signal,
      onUpdate,
    );

    gated.release(WIKIPEDIA);
    await gated.started(WIKIDATA);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    controller.abort();
    gated.release(WIKIDATA);
    gated.release(WIKTIONARY);
    gated.release(WIKIQUOTE);
    gated.release(TVMAZE);
    await expect(pending).rejects.toMatchObject({ failure: 'aborted' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('merges a TVmaze show into the Wikidata item that names it (P8600)', async () => {
    const result = await retrieve('swat kats', { getJson: fixtureGetJson('swat kats'), now });
    const cartoon = result.candidates.find((c) => c.id === 'wd:Q2077112');
    expect(cartoon).toMatchObject({
      category: 'cartoon',
      year: 1993,
      yearSourceId: 'src:wd:Q2077112',
    });
    expect(cartoon?.sources.map((s) => s.publisher)).toEqual(['Wikipedia', 'Wikidata', 'TVmaze']);
    expect(result.candidates.some((c) => c.id.startsWith('tvmaze:'))).toBe(false);
  });

  it('asks TVmaze about the canonical title only after Wikidata calls it a show', async () => {
    const requested: string[] = [];
    const fixtures = fixtureGetJson('swat kats');
    const getJson: GetJson = async (url, signal) => {
      const parsed = new URL(url);
      requested.push(
        parsed.hostname === TVMAZE ? `tvmaze:${parsed.searchParams.get('q')}` : parsed.hostname,
      );
      return fixtures(url, signal);
    };
    await retrieve('swat kats', { getJson, now });
    const tvmaze = requested.filter((r) => r.startsWith('tvmaze:'));
    // Only the animated series: the video game and the actor aren't series.
    expect(tvmaze).toEqual(['tvmaze:SWAT Kats: The Radical Squadron']);
    expect(requested.indexOf(WIKIDATA)).toBeLessThan(requested.indexOf(tvmaze[0]));
  });

  it('never asks TVmaze when nothing is a show, and never makes a card from TVmaze alone', async () => {
    const requested: string[] = [];
    const fixtures = fixtureGetJson('the matrix');
    const getJson: GetJson = async (url, signal) => {
      requested.push(new URL(url).hostname);
      return fixtures(url, signal);
    };
    const result = await retrieve('the matrix', { getJson, now });
    expect(requested).not.toContain(TVMAZE);
    expect(result.outcomes[4]).toEqual({ provider: 'tvmaze', status: 'skipped' });

    const alone = await retrieve('taarak mehta', {
      getJson: onlyFrom({ [TVMAZE]: taarakMehtaTvmaze }),
      now,
    });
    expect(alone.candidates).toEqual([]);
    expect(alone.outcomes[4]).toEqual({ provider: 'tvmaze', status: 'skipped' });
  });

  it('looks up at most two shows per search', async () => {
    const pages = [1, 2, 3].map((n) => ({
      pageid: n,
      title: `Show ${n}`,
      fullurl: `https://en.wikipedia.org/wiki/Show_${n}`,
      index: n,
      pageprops: { wikibase_item: `Q${n}` },
    }));
    const bindings = [1, 2, 3].map((n) => ({
      item: { type: 'uri', value: `http://www.wikidata.org/entity/Q${n}` },
      class: { type: 'uri', value: 'http://www.wikidata.org/entity/Q5398426' },
    }));
    const lookups: string[] = [];
    const answers = onlyFrom({
      [WIKIPEDIA]: { query: { pages } },
      [WIKIDATA]: { results: { bindings } },
    });
    const getJson: GetJson = async (url, signal) => {
      const parsed = new URL(url);
      if (parsed.hostname === TVMAZE) lookups.push(parsed.searchParams.get('q') ?? '');
      return answers(url, signal);
    };
    const result = await retrieve('show', { getJson, now });
    expect(lookups).toEqual(['Show 1', 'Show 2']);
    expect(result.outcomes[4]).toEqual({ provider: 'tvmaze', status: 'empty' });
  });

  describe('merging a TVmaze lookup into the Wikidata card', () => {
    const TITLE = 'Taarak Mehta Ka Ooltah Chashmah';
    function lookup(item: Record<string, unknown>) {
      return onlyFrom({
        [WIKIPEDIA]: {
          query: {
            pages: [
              {
                pageid: 7,
                title: `${TITLE} (TV series)`,
                fullurl: 'https://en.wikipedia.org/wiki/Taarak',
                index: 1,
                pageprops: { wikibase_item: 'Q7' },
              },
            ],
          },
        },
        [WIKIDATA]: {
          results: {
            bindings: [
              {
                item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q7' },
                class: { type: 'uri', value: 'http://www.wikidata.org/entity/Q5398426' },
              },
              { item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q7' }, ...item },
            ],
          },
        },
        [TVMAZE]: taarakMehtaTvmaze,
      });
    }
    const p8600 = (id: string) => ({
      idProperty: { type: 'uri', value: 'http://www.wikidata.org/prop/direct/P8600' },
      externalId: { type: 'literal', value: id },
    });
    const date = (year: number) => ({
      date: { type: 'literal', value: `${year}-07-28T00:00:00Z` },
    });

    it('fills a missing year and adds the network when the TVmaze ID matches', async () => {
      const result = await retrieve('taarak mehta', { getJson: lookup(p8600('18303')), now });
      expect(result.candidates[0]).toMatchObject({
        id: 'wd:Q7',
        category: 'tv',
        role: 'work',
        year: 2008,
        yearSourceId: 'src:tvmaze:18303',
      });
      const tvmaze = result.candidates[0].sources.find((s) => s.publisher === 'TVmaze');
      expect(tvmaze).toMatchObject({
        url: 'https://www.tvmaze.com/shows/18303/taarak-mehta-ka-ooltah-chashmah',
        license: 'CC BY-SA',
      });
      expect(tvmaze?.excerpt).toMatch(/^Sony SAB — /);
      expect(result.outcomes[4]).toEqual({ provider: 'tvmaze', status: 'ok' });
    });

    it('merges on an exact name only when the premiere year agrees', async () => {
      const agrees = await retrieve('taarak mehta', { getJson: lookup(date(2008)), now });
      expect(agrees.candidates[0].sources.map((s) => s.publisher)).toContain('TVmaze');
      expect(agrees.candidates[0].yearSourceId).toBe('src:wd:Q7');

      const differs = await retrieve('taarak mehta', { getJson: lookup(date(2009)), now });
      expect(differs.candidates[0].sources.map((s) => s.publisher)).not.toContain('TVmaze');
    });

    it('does not merge a different show even when TVmaze names it first', async () => {
      // The item's TVmaze ID names a show the search didn't return: no fallback to a name match.
      const result = await retrieve('taarak mehta', { getJson: lookup(p8600('99999')), now });
      expect(result.candidates[0].sources.map((s) => s.publisher)).not.toContain('TVmaze');
    });
  });

  it('keeps layered meanings apart: the films, where the phrase is quoted, the dictionary sense', async () => {
    const result = await retrieve('point break', { getJson: fixtureGetJson('point break'), now });
    const byId = new Map(result.candidates.map((c) => [c.id, c]));

    expect(byId.get('wd:Q1146552')).toMatchObject({ role: 'work', category: 'film', year: 1991 });
    expect(byId.get('wd:Q17410299')).toMatchObject({ role: 'work', category: 'film', year: 2015 });

    const quoted = byId.get('enwikiquote:199218');
    expect(quoted).toMatchObject({
      title: 'Thor: Ragnarok on Wikiquote',
      role: 'quoted_in',
      kind: 'quote',
      category: 'catchphrase',
    });
    expect(quoted?.sources).toHaveLength(1);
    expect(quoted?.sources[0]).toMatchObject({
      publisher: 'Wikiquote',
      title: 'Thor: Ragnarok',
      url: 'https://en.wikiquote.org/wiki/Thor%3A_Ragnarok',
      excerpt: 'Point Break.',
    });
    expect(quoted?.sources[0].license).toMatch(/^CC BY-SA 4\.0 .*fair use/);

    expect(byId.get('enwiktionary:point break')).toMatchObject({ role: 'definition' });
    // The films keep only their own evidence: nothing from the quote pages is merged in.
    for (const id of ['wd:Q1146552', 'wd:Q17410299']) {
      expect(byId.get(id)?.sources.map((s) => s.publisher)).toEqual(['Wikipedia', 'Wikidata']);
    }
    expect(result.candidates.filter((c) => c.role === 'quoted_in')).toHaveLength(3);
    // TVmaze is asked about the Indian "Break Point (2021 TV series)" and answers with Netflix's
    // 2023 "Break Point". Without a TVmaze ID or a year to match, it isn't merged.
    expect(byId.get('wd:Q108919894')?.sources.map((s) => s.publisher)).toEqual([
      'Wikipedia',
      'Wikidata',
    ]);
    expect(result.outcomes[4]).toEqual({ provider: 'tvmaze', status: 'empty' });
    expect(result.candidates.some((c) => c.id.startsWith('tvmaze:'))).toBe(false);
  });

  it('keeps Wikimedia results when Wikiquote and TVmaze fail', async () => {
    const getJson = fixtureGetJson('swat kats', {
      wikiquote: new RetrievalError('timeout', 'slow'),
      tvmaze: new RetrievalError('network', 'down'),
    });
    const result = await retrieve('swat kats', { getJson, now });
    expect(result.outcomes.slice(3)).toEqual([
      { provider: 'wikiquote', status: 'failed', failure: 'timeout' },
      { provider: 'tvmaze', status: 'failed', failure: 'network' },
    ]);
    expect(result.candidates[0]).toMatchObject({ id: 'wd:Q2077112', category: 'cartoon' });
    expect(result.candidates[0].sources.map((s) => s.publisher)).toEqual(['Wikipedia', 'Wikidata']);
  });

  it('returns candidates already reranked, and the dictionary sense stays behind exact-title pages', async () => {
    const result = await retrieve('hakuna matata', {
      getJson: fixtureGetJson('hakuna matata'),
      now,
    });
    expect(rerankCandidates('hakuna matata', result.candidates)).toEqual(result.candidates);
    expect(result.candidates[0]?.id).not.toBe('enwiktionary:hakuna matata');
    // retrieve() is exactly retrieveRaw() plus the reranking (the benchmark relies on this).
    const raw = await retrieveRaw('hakuna matata', {
      getJson: fixtureGetJson('hakuna matata'),
      now,
    });
    expect(result.candidates).toEqual(rerankCandidates('hakuna matata', raw.candidates));
  });

  it('finds only the song for "catch me outside", not the meme', async () => {
    const result = await retrieve('catch me outside', {
      getJson: fixtureGetJson('catch me outside'),
      now,
    });
    expect(result.candidates[0]).toMatchObject({
      id: 'wd:Q110449182',
      category: 'music',
      kind: 'work',
    });
    expect(result.candidates.some((c) => ['phrase', 'quote', 'meme'].includes(c.kind))).toBe(false);
    expect(result.outcomes.map((o) => o.status)).toEqual(['ok', 'ok', 'empty', 'empty', 'skipped']);
  });

  describe('retrieve$', () => {
    it('emits one snapshot per provider answer, then completes', async () => {
      const snapshots = await firstValueFrom(
        retrieve$('swat kats', { getJson: fixtureGetJson('swat kats'), now }).pipe(toArray()),
      );
      expect(snapshots).toHaveLength(5);
      expect(snapshots.at(-1)?.outcomes.every((o) => o.status !== 'pending')).toBe(true);
      // Each snapshot settles exactly one more provider.
      const settled = snapshots.map((s) => s.outcomes.filter((o) => o.status !== 'pending').length);
      expect(settled).toEqual([1, 2, 3, 4, 5]);
    });

    it('starts nothing until subscribed, and aborts every running request on unsubscribe', async () => {
      const signals: AbortSignal[] = [];
      const getJson: GetJson = (_url, signal) => {
        if (signal) signals.push(signal);
        return new Promise(() => undefined);
      };
      const lookup$ = retrieve$('the matrix', { getJson, now });
      expect(signals).toEqual([]);

      const subscription = lookup$.subscribe();
      expect(signals).toHaveLength(3);
      expect(signals.some((s) => s.aborted)).toBe(false);
      subscription.unsubscribe();
      expect(signals.every((s) => s.aborted)).toBe(true);
    });

    it('asks Wikidata only with the IDs Wikipedia returned', async () => {
      const wikidataUrls: string[] = [];
      const fixtures = fixtureGetJson('the matrix');
      const getJson: GetJson = async (url, signal) => {
        if (new URL(url).hostname === WIKIDATA) wikidataUrls.push(url);
        return fixtures(url, signal);
      };
      await firstValueFrom(retrieve$('the matrix', { getJson, now }).pipe(toArray()));
      expect(wikidataUrls).toHaveLength(1);
      const query = new URL(wikidataUrls[0]).searchParams.get('query') ?? '';
      expect(query).toContain('VALUES ?item { wd:Q83495 wd:Q13014087 wd:Q207536 wd:Q80322391 }');
    });
  });

  it('throws aborted when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const getJson = fixtureGetJson('the matrix', {
      wikipedia: new RetrievalError('aborted', 'cancelled'),
    });
    await expect(retrieve('the matrix', { getJson, now }, controller.signal)).rejects.toMatchObject(
      {
        failure: 'aborted',
      },
    );
  });

  describe('fallbacks after a miss (D43)', () => {
    const wikipediaPage = (title: string, pageId: number, qid: string) => ({
      pageid: pageId,
      title,
      fullurl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`,
      pageprops: { wikibase_item: qid },
      extract: `${title} is a thing.`,
      index: 1,
    });

    /** Answers by what is searched: `wikipedia[search]` is that search's JSON, anything else is empty. */
    function scripted(
      wikipedia: Record<string, unknown>,
      quotes: unknown = { query: { search: [] } },
    ) {
      const requests: string[] = [];
      const getJson: GetJson = async (url) => {
        const u = new URL(url);
        requests.push(
          `${u.hostname} ${u.searchParams.get('gsrsearch') ?? u.searchParams.get('srsearch') ?? ''}`.trim(),
        );
        if (u.hostname === WIKIPEDIA)
          return wikipedia[u.searchParams.get('gsrsearch') ?? ''] ?? { batchcomplete: true };
        if (u.hostname === WIKTIONARY) return { query: { pages: [{ title: 'x', missing: true }] } };
        if (u.hostname === WIKIQUOTE) return quotes;
        if (u.hostname === WIKIDATA) return { results: { bindings: [] } };
        return [];
      };
      return { getJson, requests };
    }

    it("searches Wikipedia's suggestion after a miss and marks what it found", async () => {
      const { getJson, requests } = scripted({
        'hakuna matatta': { query: { searchinfo: { suggestion: 'hakuna matata' } } },
        'hakuna matata': { query: { pages: [wikipediaPage('Hakuna matata', 7, 'Q1570072')] } },
      });
      const result = await retrieve('hakuna matatta', { getJson, now });
      expect(result.rewrite).toEqual({ kind: 'suggestion', text: 'hakuna matata' });
      expect(result.candidates.map((c) => [c.id, c.via])).toEqual([['wd:Q1570072', 'suggestion']]);
      // The plain search, Wiktionary, Wikiquote, then the fallback search and its Wikidata lookup.
      expect(requests.filter((r) => r.startsWith(WIKIPEDIA))).toEqual([
        `${WIKIPEDIA} hakuna matatta`,
        `${WIKIPEDIA} hakuna matata`,
      ]);
      expect(requests.filter((r) => r.startsWith(WIKIDATA))).toHaveLength(1);
    });

    it('cuts a long query to its first words when there is no suggestion', async () => {
      const { getJson } = scripted({
        'babu bhaiya paisa hi paisa hoga': {
          query: { pages: [wikipediaPage('Hemlata', 1, 'Q5712227')] },
        },
        'babu bhaiya': {
          query: { pages: [wikipediaPage('Hera Pheri (2000 film)', 2, 'Q5732486')] },
        },
      });
      const result = await retrieve('babu bhaiya paisa hi paisa hoga', { getJson, now });
      expect(result.rewrite).toEqual({ kind: 'shorter_phrase', text: 'babu bhaiya' });
      const byId = new Map(result.candidates.map((c) => [c.id, c.via]));
      expect(byId.get('wd:Q5712227')).toBeUndefined();
      expect(byId.get('wd:Q5732486')).toBe('shorter_phrase');
    });

    it('makes no extra request when the plain search already found a page named by the query', async () => {
      const { getJson, requests } = scripted({
        'hera pheri': {
          query: {
            pages: [wikipediaPage('Hera Pheri (2000 film)', 3, 'Q5732486')],
            searchinfo: { suggestion: 'hera pheri 2' },
          },
        },
      });
      const result = await retrieve('hera pheri', { getJson, now });
      expect(result.rewrite).toBeUndefined();
      expect(requests.filter((r) => r.startsWith(WIKIPEDIA))).toEqual([`${WIKIPEDIA} hera pheri`]);
    });

    it('does not pile requests on an outage: a failed provider means no fallback', async () => {
      const requests: string[] = [];
      const getJson: GetJson = async (url) => {
        const u = new URL(url);
        requests.push(u.hostname + (u.searchParams.get('gsrsearch') ?? ''));
        if (u.hostname === WIKTIONARY) throw new RetrievalError('network', 'down');
        if (u.hostname === WIKIPEDIA)
          return { query: { searchinfo: { suggestion: 'something else' } } };
        return { query: { search: [] } };
      };
      const result = await retrieve('some misspelt thing here', { getJson, now });
      expect(result.rewrite).toBeUndefined();
      expect(requests.filter((r) => r.startsWith(WIKIPEDIA))).toHaveLength(1);
    });
  });
});
