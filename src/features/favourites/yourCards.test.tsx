import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftCard } from '../../../api/_lib/cardTypes.js';
import { AppProviders } from '../../app/AppProviders';
import { createRepositories } from '../../data/repositories';
import type { DraftCardRecord } from '../../data/repositories/draftRepository';
import { unusedRetrievalService } from '../../test/fakeRetrieval';
import { createTestDatabase, renderApp } from '../../test/renderApp';
import { CurateFlow } from '../drafts/CurateFlow';

const CARD: DraftCard = {
  label: 'A dismissive comeback',
  gist: 'That opinion sounds out of touch.',
  means: 'They are brushing off your view as old-fashioned.',
  reply: 'Okay, Zoomer.',
  summary: [{ text: 'A catchphrase used to dismiss older attitudes.', sources: [1] }],
  context: [{ text: 'Often fired back in family chats.', sources: [0] }],
  example: null,
  spoiler: 'none',
};

const record = (id: string, label: string, savedAt: string): DraftCardRecord => ({
  id,
  search: 'ok boomer',
  card: { ...CARD, label },
  sources: [
    { from: 'bbc.co.uk', title: 'What does OK boomer mean?', url: 'https://www.bbc.co.uk/ok' },
    { from: 'dictionary.com', title: 'OK boomer meaning', url: 'https://www.dictionary.com/ok' },
  ],
  promptVersion: 'v2',
  savedAt,
});

async function seed(...records: DraftCardRecord[]) {
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  for (const r of records) await repos.drafts.save(r);
  return { db, repos };
}

afterEach(() => vi.restoreAllMocks());

describe('Your cards', () => {
  it('lists kept cards newest first and removes one', async () => {
    const { db, repos } = await seed(
      record('a', 'Older card', '2026-11-01T00:00:00.000Z'),
      record('b', 'Newer card', '2026-11-02T00:00:00.000Z'),
    );
    const { user } = renderApp('/favourites', db);

    const section = await screen.findByRole('region', { name: 'Your cards' });
    const names = within(section)
      .getAllByRole('button', { expanded: false })
      .map((b) => b.textContent);
    expect(names).toEqual(['Newer card', 'Older card']);

    await user.click(within(section).getByRole('button', { name: 'Remove Newer card' }));
    expect(await within(section).findByRole('button', { name: 'Older card' })).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Newer card' })).not.toBeInTheDocument();
    expect((await repos.drafts.list()).map((r) => r.id)).toEqual(['a']);
  });

  it('opens a kept card to read it in full', async () => {
    const { db } = await seed({
      ...record('a', 'A dismissive comeback', '2026-11-01T00:00:00.000Z'),
    });
    const { user } = renderApp('/favourites', db);

    await user.click(await screen.findByRole('button', { name: 'A dismissive comeback' }));

    const card = await screen.findByRole('article', { name: 'A dismissive comeback' });
    expect(card).toHaveTextContent('AI draft · check the sources');
    expect(card).toHaveTextContent('That opinion sounds out of touch.');
    expect(card).toHaveTextContent('Okay, Zoomer.');
    expect(within(card).getByRole('link', { name: /dictionary\.com/ })).toHaveAttribute(
      'href',
      'https://www.dictionary.com/ok',
    );
    expect(within(card).queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Drop' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'A dismissive comeback' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('hides a kept major spoiler under its search until revealed, unless set to show', async () => {
    const kept = record('a', 'A dismissive comeback', '2026-11-01T00:00:00.000Z');
    const spoiler = { ...kept, card: { ...kept.card, spoiler: 'major' as const } };
    const hidden = [CARD.gist, CARD.means, CARD.reply, CARD.summary[0]?.text ?? ''];
    const { db, repos } = await seed(spoiler);
    const first = renderApp('/favourites', db);

    await first.user.click(await screen.findByRole('button', { name: 'A dismissive comeback' }));
    const card = await screen.findByRole('article', { name: 'ok boomer' });
    expect(card).toHaveTextContent('Spoiler');
    expect(card).toHaveTextContent('This card gives away the ending of a story.');
    for (const text of [...hidden, 'A dismissive comeback']) {
      expect(card).not.toHaveTextContent(text);
    }
    await first.user.click(within(card).getByRole('button', { name: 'Reveal spoiler' }));
    expect(screen.getByRole('heading', { name: 'A dismissive comeback' })).toHaveFocus();
    for (const text of hidden) expect(card).toHaveTextContent(text);
    first.unmount();

    await repos.settings.set('spoilers', 'show');
    const second = renderApp('/favourites', db);
    await second.user.click(await screen.findByRole('button', { name: 'A dismissive comeback' }));
    const shown = await screen.findByRole('article', { name: 'A dismissive comeback' });
    for (const text of hidden) expect(shown).toHaveTextContent(text);
  });

  it('offers kept cards as tone filters but not as frames', async () => {
    const { db } = await seed(record('a', 'Polite brush-off', '2026-11-01T00:00:00.000Z'));
    render(
      <AppProviders db={db} retrieval={unusedRetrievalService()}>
        <CurateFlow
          search="ok boomer"
          candidates={[]}
          webResults={[
            { url: 'https://www.bbc.co.uk/x', title: 'BBC page', snippet: 'A snippet.', storage: 'none' },
          ]}
          onClose={vi.fn()}
        />
      </AppProviders>,
    );

    expect(await screen.findByRole('button', { name: 'Polite brush-off' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BBC page/ })).toBeInTheDocument();
    expect(screen.queryByText('your card')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Your card/i })).not.toBeInTheDocument();
  });
});
