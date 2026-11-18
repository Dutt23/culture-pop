import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftResponse } from '../../../api/_lib/cardTypes.js';
import { AppProviders } from '../../app/AppProviders';
import { createRepositories } from '../../data/repositories';
import type { Settings } from '../../domain/settings';
import {
  WebSearchError,
  type WebResult,
  type WebSearchClient,
} from '../../services/retrieval/webSearch';
import { unusedRetrievalService } from '../../test/fakeRetrieval';
import { createTestDatabase } from '../../test/renderApp';
import { CurateFlow } from './CurateFlow';

const SEARCH = 'ok boomer';
const web = (url: string, title: string, snippet: string): WebResult => ({
  url,
  title,
  snippet,
  storage: 'none',
});
const BBC = web(
  'https://www.bbc.co.uk/news/ok-boomer',
  'What does OK boomer mean?',
  'A two-word comeback to older people who seem out of touch, ok boomer.',
);
const DICT = web(
  'https://www.dictionary.com/browse/ok-boomer',
  'OK boomer meaning',
  'A retort to older people seen as dismissive of the young.',
);
const STONKS = web(
  'https://www.merriam-webster.com/stonks',
  'Stonks: meaning and origin',
  'Humorous slang for stocks, from a 2017 meme.',
);

const RESPONSE: DraftResponse = {
  card: {
    label: 'A dismissive comeback',
    gist: 'That opinion sounds out of touch.',
    means: 'They are brushing off your view as old-fashioned.',
    reply: 'Okay, Zoomer.',
    summary: [{ text: 'A catchphrase used to dismiss older attitudes.', sources: [1] }],
    context: [{ text: 'Often fired back in family chats.', sources: [0] }],
    example: null,
    spoiler: 'none',
  },
  notUsed: [],
  provider: 'fake',
  promptVersion: 'v2',
};

const TONE = 'Polite brush-off';

async function renderFlow(
  settings: Partial<Settings> = { webSearch: 'on' },
  draftCard?: WebSearchClient['draftCard'],
) {
  const db = createTestDatabase();
  await db.open();
  const repos = createRepositories(db);
  for (const [key, value] of Object.entries(settings)) {
    await repos.settings.set(key as keyof Settings, value as never);
  }
  const retrieval = unusedRetrievalService();
  if (draftCard) retrieval.webSearch.draftCard.mockImplementation(draftCard);
  const onClose = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <AppProviders db={db} retrieval={retrieval}>
      <CurateFlow
        search={SEARCH}
        candidates={[]}
        webResults={[BBC, DICT, STONKS]}
        onClose={onClose}
      />
    </AppProviders>,
  );
  return { db, repos, retrieval, user, onClose, ...view };
}

const frame = (title: string) => screen.findByRole('button', { name: new RegExp(title) });
const makeButton = () => screen.getByRole('button', { name: 'Make a card' });

async function pickAndCheck(user: ReturnType<typeof userEvent.setup>, ...titles: string[]) {
  for (const title of titles) await user.click(await frame(title));
  await user.click(screen.getByRole('button', { name: /^Review \d frames?$/ }));
  return screen.findByRole('region', { name: 'Splice check' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('curate a card', () => {
  it('Make a card stays disabled until a flagged pick is kept or cut', async () => {
    const first = await renderFlow();
    let check = await pickAndCheck(first.user, 'What does OK boomer mean', 'Stonks');
    expect(check).toHaveTextContent('⚠ Doesn’t seem to be about “ok boomer”');
    expect(check).toHaveTextContent('bbc.co.uk');
    expect(check).toHaveTextContent(BBC.snippet);
    expect(makeButton()).toBeDisabled();

    await first.user.click(within(check).getByRole('button', { name: 'Keep' }));
    expect(check).toHaveTextContent('Kept by you: the AI may leave it out');
    expect(makeButton()).toBeEnabled();
    first.unmount();

    const second = await renderFlow();
    check = await pickAndCheck(second.user, 'What does OK boomer mean', 'Stonks');
    await second.user.click(within(check).getByRole('button', { name: 'Cut it out' }));
    expect(check).not.toHaveTextContent('Stonks');
    expect(makeButton()).toBeEnabled();
  });

  it('cutting every pick keeps Make disabled', async () => {
    const { user } = await renderFlow();
    const check = await pickAndCheck(user, 'Stonks');
    await user.click(within(check).getByRole('button', { name: 'Cut it out' }));
    expect(check).not.toHaveTextContent('Stonks');
    expect(makeButton()).toBeDisabled();
  });

  it('shows the usage hint when no pick shows everyday use', async () => {
    const { user } = await renderFlow();
    const check = await pickAndCheck(user, 'OK boomer meaning');
    const hint = 'Add a web result to show how people use it.';
    expect(check).toHaveTextContent(hint);

    await user.click(screen.getByRole('button', { name: 'Back to the film' }));
    const again = await pickAndCheck(user, 'What does OK boomer mean');
    expect(again).not.toHaveTextContent(hint);
  });

  it('sends the picks and tone cards and shows the checked card with its sources', async () => {
    const draftCard = vi.fn<WebSearchClient['draftCard']>(async () => RESPONSE);
    const { user, repos } = await renderFlow({ webSearch: 'on' }, draftCard);
    await repos.drafts.save({
      id: 'kept-1',
      search: 'bless your heart',
      card: { ...RESPONSE.card, label: TONE },
      sources: [],
      promptVersion: 'v2',
      savedAt: '2026-11-01T00:00:00.000Z',
    });
    await user.click(await screen.findByRole('button', { name: TONE }));
    await pickAndCheck(user, 'What does OK boomer mean', 'OK boomer meaning');
    await user.click(makeButton());

    expect(draftCard).toHaveBeenCalledWith(
      {
        search: SEARCH,
        sources: [
          { kind: 'web', from: 'bbc.co.uk', title: BBC.title, text: BBC.snippet, url: BBC.url },
          {
            kind: 'web',
            from: 'dictionary.com',
            title: DICT.title,
            text: DICT.snippet,
            url: DICT.url,
          },
        ],
        tones: [expect.objectContaining({ label: TONE, gist: RESPONSE.card.gist })],
      },
      expect.any(AbortSignal),
    );
    const card = await screen.findByRole('article', { name: 'A dismissive comeback' });
    expect(card).toHaveTextContent('AI draft · check the sources');
    expect(card).toHaveTextContent('That opinion sounds out of touch.');
    expect(card).toHaveTextContent('Okay, Zoomer.');
    expect(within(card).getByRole('link', { name: /dictionary\.com/ })).toHaveAttribute(
      'href',
      DICT.url,
    );
    expect(within(card).getByRole('link', { name: /bbc\.co\.uk/ })).toHaveAttribute(
      'href',
      BBC.url,
    );
  });

  it('lists not-used sources with their reason', async () => {
    const { user } = await renderFlow({ webSearch: 'on' }, async () => ({
      ...RESPONSE,
      notUsed: [{ source: 1, why: 'about something else' }],
    }));
    await pickAndCheck(user, 'What does OK boomer mean', 'OK boomer meaning');
    await user.click(makeButton());
    expect(
      await screen.findByText('Not used: dictionary.com (about something else)'),
    ).toBeInTheDocument();
  });

  it('Keep saves the card on the device and Drop saves nothing', async () => {
    const first = await renderFlow({ webSearch: 'on' }, async () => RESPONSE);
    await pickAndCheck(first.user, 'What does OK boomer mean');
    await first.user.click(makeButton());
    await first.user.click(await screen.findByRole('button', { name: 'Edit' }));
    const gist = screen.getByRole('textbox', { name: 'Gist' });
    await first.user.clear(gist);
    await first.user.type(gist, 'Typed by me.');
    await first.user.click(screen.getByRole('button', { name: 'Keep' }));

    await waitFor(async () => expect(await first.db.draftCards.count()).toBe(1));
    const [saved] = await first.db.draftCards.toArray();
    expect(saved).toEqual({
      id: expect.any(String),
      search: SEARCH,
      card: { ...RESPONSE.card, gist: 'Typed by me.' },
      sources: [{ from: 'bbc.co.uk', title: BBC.title, url: BBC.url }],
      promptVersion: 'v2',
      savedAt: expect.any(String),
    });
    expect(await screen.findByText('Kept on this device.')).toBeInTheDocument();
    first.unmount();

    const second = await renderFlow({ webSearch: 'on' }, async () => RESPONSE);
    await pickAndCheck(second.user, 'What does OK boomer mean');
    await second.user.click(makeButton());
    await second.user.click(await screen.findByRole('button', { name: 'Drop' }));
    expect(await screen.findByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
    expect(await second.db.draftCards.count()).toBe(0);
  });

  it('going offline mid-draft cancels it and keeps the tray', async () => {
    let sent: AbortSignal | undefined;
    const { user } = await renderFlow(
      { webSearch: 'on' },
      (_body, signal) =>
        new Promise((_resolve, reject) => {
          sent = signal;
          signal?.addEventListener('abort', () => reject(new WebSearchError('aborted', 'x')));
        }),
    );
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());
    expect(await screen.findByText('Threading your frames…')).toBeInTheDocument();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(sent?.aborted).toBe(true);
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/);
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
    expect(await frame('What does OK boomer mean')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the no_card message and keeps the tray', async () => {
    const { user } = await renderFlow({ webSearch: 'on' }, async () => {
      throw new WebSearchError('no_card', 'HTTP 422');
    });
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "These results don't explain it. Try ticking others.",
    );
    expect(await frame('What does OK boomer mean')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
  });

  it('asks first under "Ask first" and sends nothing before consent', async () => {
    const draftCard = vi.fn<WebSearchClient['draftCard']>(async () => RESPONSE);
    const { user, repos } = await renderFlow({ webSearch: 'ask' }, draftCard);
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());

    let consent = await screen.findByRole('region', { name: 'Make a card from these?' });
    expect(consent).toHaveTextContent(/Parallel/);
    await user.click(within(consent).getByRole('button', { name: 'Not now' }));
    expect(draftCard).not.toHaveBeenCalled();

    await user.click(makeButton());
    consent = await screen.findByRole('region', { name: 'Make a card from these?' });
    expect(draftCard).not.toHaveBeenCalled();
    await user.click(within(consent).getByRole('button', { name: 'Make a card' }));
    expect(await screen.findByRole('article', { name: 'A dismissive comeback' })).toBeVisible();
    expect(draftCard).toHaveBeenCalledTimes(1);
    await waitFor(async () =>
      expect(await repos.settings.getAll()).toContainEqual({ key: 'webSearch', value: 'on' }),
    );
  });

  it('an empty tray shakes and says to cut a frame first', async () => {
    const { user } = await renderFlow();
    await user.click(await screen.findByRole('button', { name: 'Review 0 frames' }));
    await waitFor(() => expect(screen.getByText('Cut a frame first.')).toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'Splice check' })).toBeNull();
  });
});
