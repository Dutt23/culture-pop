import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
