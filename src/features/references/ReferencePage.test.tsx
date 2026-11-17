import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OPEN_PACK_KEY } from '../../components/reference-card/openPack';
import { createRepositories } from '../../data/repositories';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import { makeCandidate, makeSource } from '../../test/factories';
import { createTestDatabase, renderApp } from '../../test/renderApp';

const wikidata = makeSource('src:wd:Q83495', 'Wikidata', {
  url: 'https://www.wikidata.org/wiki/Q83495',
  title: 'The Matrix',
  sourceType: 'structured_data',
  license: 'CC0 1.0',
});
const article = makeSource('src:enwiki:30007', 'Wikipedia', {
  url: 'https://en.wikipedia.org/wiki/The_Matrix',
  title: 'The Matrix',
  sourceType: 'encyclopedia',
  excerpt: 'The Matrix is a science fiction action film.',
});
const matrix = makeCandidate({
  id: 'wd:Q83495',
  title: 'The Matrix',
  kind: 'work',
  category: 'film',
  role: 'work',
  year: 1999,
  yearSourceId: wikidata.id,
  sources: [article, wikidata],
});

async function withCached(...candidates: RetrievedCandidate[]) {
  const db = createTestDatabase();
  await db.open();
  await createRepositories(db).retrieval.saveCandidates(candidates);
  return db;
}

const pageOf = (id: string) => `/references/${encodeURIComponent(id)}`;

describe('reference page: glance card', () => {
  it('opens a built-in entry with what it means, the social move and a line to say', async () => {
    renderApp(pageOf('doh-simpsons'));
    const glance = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(glance).getByText('Ugh, I just did something stupid.')).toBeInTheDocument();
    expect(within(glance).getByText("They're laughing at their own mistake.")).toBeInTheDocument();
    expect(within(glance).getByText(/D'oh indeed/)).toBeInTheDocument();
    // The usage example is a situation, not a reply: it stays with the full meaning below.
    expect(within(glance).queryByText(/locked your keys in the car/)).not.toBeInTheDocument();
  });

  it('keeps a spoiler-gated meaning safe at a glance', async () => {
    renderApp(pageOf('king-of-the-world-titanic'));
    const glance = await screen.findByRole('region', { name: 'At a glance' });
    // The first meaning leads; the door debate's spoiler stays behind its own reveal below.
    expect(within(glance).getByText('I feel on top of everything right now.')).toBeInTheDocument();
    expect(within(glance).queryByText(/door/)).not.toBeInTheDocument();
  });

  it('has no glance card for an entry found online: nothing is made up from the article', async () => {
    renderApp(pageOf(matrix.id), await withCached(matrix));
    await screen.findByRole('heading', { name: 'Explained from sources' });
    expect(screen.queryByRole('region', { name: 'At a glance' })).not.toBeInTheDocument();
  });
});

describe('reference page: curated from sources', () => {
  it('shows the templated meaning with its citations, then the quoted sources', async () => {
    renderApp(pageOf(matrix.id), await withCached(matrix));

    expect(
      await screen.findByRole('heading', { name: 'Explained from sources' }),
    ).toBeInTheDocument();
    const card = screen.getByRole('article', { name: 'The work' });
    expect(within(card).getByText('“The Matrix” is a 1999 film (Wikidata).')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Wikidata: The Matrix/ })).toHaveAttribute(
      'href',
      'https://www.wikidata.org/wiki/Q83495',
    );
    // It cites only what its claim rests on.
    expect(within(card).queryByRole('link', { name: /Wikipedia/ })).not.toBeInTheDocument();
    expect(within(card).getByText('Backed by cited sources')).toBeInTheDocument();
    // No invented usage example or context.
    expect(within(card).queryByText('How people use it')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'More context' })).not.toBeInTheDocument();

    const quoted = screen.getByRole('region', { name: 'What the sources say' });
    expect(
      within(quoted).getByText('The Matrix is a science fiction action film.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Not explained yet' })).not.toBeInTheDocument();
  });

  it('keeps "Not explained yet" when no template could be filled', async () => {
    const topic = makeCandidate({
      id: 'enwiki:5',
      title: 'Some person',
      sources: [makeSource('src:enwiki:5', 'Wikipedia', { excerpt: 'A person.' })],
    });
    renderApp(pageOf(topic.id), await withCached(topic));

    expect(await screen.findByRole('heading', { name: 'Not explained yet' })).toBeInTheDocument();
    expect(screen.getByText('A person.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Explained from sources' }),
    ).not.toBeInTheDocument();
  });

  it('labels an explanation whose cited source is missing as unverified', async () => {
    // Typed as a film, but without the Wikidata record that states it.
    const film = makeCandidate({
      id: 'wd:Q9',
      title: 'Zzqx',
      kind: 'work',
      category: 'film',
      role: 'work',
    });
    renderApp(pageOf(film.id), await withCached(film));

    expect(
      await screen.findByRole('heading', { name: 'Explanation not verified' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Explained from sources' }),
    ).not.toBeInTheDocument();
  });

  it('shows layered meanings of one phrase side by side, without linking them', async () => {
    const film = makeCandidate({
      id: 'wd:Q1',
      title: 'Point Break',
      kind: 'work',
      category: 'film',
      role: 'work',
      year: 1991,
      yearSourceId: 'src:wd:Q1',
      sources: [makeSource('src:wd:Q1', 'Wikidata', { sourceType: 'structured_data' })],
    });
    const sense = makeCandidate({
      id: 'enwiktionary:point break',
      title: 'point break',
      kind: 'phrase',
      category: 'saying',
      role: 'definition',
      sources: [
        makeSource('src:enwiktionary:point break', 'Wiktionary', {
          sourceType: 'dictionary',
          excerpt: 'A surf break off a headland.',
        }),
      ],
    });
    renderApp(pageOf(film.id), await withCached(film, sense));

    expect(await screen.findByText('“Point Break” is a 1991 film (Wikidata).')).toBeInTheDocument();
    const layers = screen.getByRole('region', { name: 'Same phrase, different meaning' });
    const other = within(layers).getByRole('link', { name: /point break/i });
    expect(other).toHaveAttribute('href', pageOf(sense.id));
    expect(other).toHaveTextContent('Explained from sources');
  });
});

describe('reference page: "From" the work it appears in', () => {
  const redPillWikidata = makeSource('src:wd:Q99', 'Wikidata', {
    url: 'https://www.wikidata.org/wiki/Q99',
    title: 'Red pill and blue pill',
    sourceType: 'structured_data',
    license: 'CC0 1.0',
  });
  const redPill = makeCandidate({
    id: 'wd:Q99',
    title: 'Red pill and blue pill',
    kind: 'meme',
    category: 'meme',
    role: 'topic',
    inspiredBy: [{ qid: 'Q83495', label: 'The Matrix' }],
    sources: [redPillWikidata],
  });

  it('links to an in-app search for the work, and cites Wikidata for the claim', async () => {
    renderApp(pageOf(redPill.id), await withCached(redPill));
    const link = await screen.findByRole('link', { name: 'The Matrix' });
    expect(link).toHaveAttribute('href', '/search?q=The%20Matrix');
    expect(screen.getByText(/From:/)).toBeInTheDocument();
    expect(screen.getByText(/Inspired by “The Matrix” \(Wikidata\)\./)).toBeInTheDocument();
  });

  it('links the interpretation to the work when that work is cached too', async () => {
    const db = await withCached(matrix, redPill);
    const stored = await db.interpretations.where('referenceId').equals('wd:Q99').toArray();
    expect(stored.map((i) => i.relatedReferenceId)).toEqual(['wd:Q83495']);
  });

  it('shows From: on the search card, as plain text because the card is already a link', async () => {
    renderApp('/search?q=red%20pill%20and%20blue%20pill', await withCached(redPill));
    const text = await screen.findByText('From: The Matrix');
    expect(text.closest('a')?.getAttribute('href')).toBe('/references/wd%3AQ99');
    expect(text.querySelector('a')).toBeNull();
  });
});

describe('reference page: related references say why', () => {
  const memeOf = (qid: string, title: string, inspiredBy: { qid: string; label: string }[]) =>
    makeCandidate({
      id: `wd:${qid}`,
      title,
      kind: 'meme',
      category: 'meme',
      role: 'topic',
      inspiredBy,
      sources: [makeSource(`src:wd:${qid}`, 'Wikidata', { title, sourceType: 'structured_data' })],
    });
  const matrixWork = [{ qid: 'Q83495', label: 'The Matrix' }];
  const redPill = memeOf('Q99', 'Red pill and blue pill', matrixWork);
  const rain = memeOf('Q100', 'Digital rain', matrixWork);

  it('lists what shares a work under "Also inspired by <work>", linked to its page', async () => {
    renderApp(pageOf(redPill.id), await withCached(redPill, rain));

    const group = await screen.findByRole('region', { name: 'Also inspired by The Matrix' });
    expect(within(group).getByRole('link', { name: /Digital rain/ })).toHaveAttribute(
      'href',
      pageOf(rain.id),
    );
    // The page itself is never offered as related to itself.
    expect(within(group).queryByRole('link', { name: /Red pill/ })).not.toBeInTheDocument();
  });

  it('shows no related section when nothing is shared', async () => {
    renderApp(pageOf(redPill.id), await withCached(redPill));

    await screen.findByRole('heading', { name: 'Red pill and blue pill' });
    expect(
      screen.queryByRole('region', { name: /^Also (in|by|inspired by)/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Also/ })).not.toBeInTheDocument();
  });
});

describe('reference page: same-world chips', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  const memeOf = (qid: string, title: string) =>
    makeCandidate({
      id: `wd:${qid}`,
      title,
      kind: 'meme',
      category: 'meme',
      role: 'topic',
      inspiredBy: [{ qid: 'Q83495', label: 'The Matrix' }],
      sources: [makeSource(`src:wd:${qid}`, 'Wikidata', { title, sourceType: 'structured_data' })],
    });
  const redPill = memeOf('Q99', 'Red pill and blue pill');
  const rain = memeOf('Q100', 'Digital rain');
  const spoon = memeOf('Q101', 'There is no spoon');
  const glitch = memeOf('Q102', 'Glitch in the Matrix');
  const dejaVu = memeOf('Q103', 'Deja vu cat');

  it('puts up to three cards from the same work at the top of the page', async () => {
    renderApp(pageOf(redPill.id), await withCached(redPill, rain, spoon, glitch, dejaVu));

    const chips = await screen.findByRole('list', { name: 'Also inspired by The Matrix' });
    const links = within(chips).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(within(chips).getByRole('link', { name: 'Digital rain' })).toHaveAttribute(
      'href',
      pageOf(rain.id),
    );
    expect(within(chips).queryByRole('link', { name: /Red pill/ })).not.toBeInTheDocument();
    // Library order (by title) decides which three: the fourth waits in the section below.
    expect(
      within(chips).queryByRole('link', { name: 'There is no spoon' }),
    ).not.toBeInTheDocument();
    // At the top: before the longer "Also inspired by" section further down.
    const section = screen.getByRole('region', { name: 'Also inspired by The Matrix' });
    expect(chips.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the chosen card and carries the "before you watch" pack along', async () => {
    const db = await withCached(redPill, rain);
    const repos = createRepositories(db);
    const pack = await repos.packs.create({ name: 'Matrix', ceiling: 'before_watching' });
    await repos.packs.fileCard(redPill.id, pack.id, 0);
    await repos.packs.fileCard(rain.id, pack.id, 1);
    const { user } = renderApp(`/packs/${encodeURIComponent(pack.id)}`, db);

    await user.click(await screen.findByRole('link', { name: /Red pill and blue pill/ }));
    sessionStorage.clear(); // only the chip's own state and storage may carry the pack on
    const chips = await screen.findByRole('list', { name: 'Also inspired by The Matrix' });
    await user.click(within(chips).getByRole('link', { name: 'Digital rain' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Digital rain' })).toBeVisible();
    expect(
      screen.getByText('Filed for before you watch. The ending stays hidden.'),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(OPEN_PACK_KEY)).toBe(pack.id);
  });

  it('keeps the pack for later hops but holds back nothing on a card not filed in it', async () => {
    const db = await withCached(redPill, rain);
    const repos = createRepositories(db);
    const pack = await repos.packs.create({ name: 'Matrix', ceiling: 'before_watching' });
    await repos.packs.fileCard(redPill.id, pack.id, 0);
    const { user } = renderApp(`/packs/${encodeURIComponent(pack.id)}`, db);

    await user.click(await screen.findByRole('link', { name: /Red pill and blue pill/ }));
    const chips = await screen.findByRole('list', { name: 'Also inspired by The Matrix' });
    await user.click(within(chips).getByRole('link', { name: 'Digital rain' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Digital rain' })).toBeVisible();
    expect(screen.queryByText(/The ending stays hidden/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(OPEN_PACK_KEY)).toBe(pack.id);
  });
});
