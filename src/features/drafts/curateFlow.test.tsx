import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftResponse } from '../../../shared/cardTypes.js';
import { AppProviders } from '../../app/AppProviders';
import { createRepositories } from '../../data/repositories';
import type { Settings } from '../../domain/settings';
import {
  WebSearchError,
  type WebResult,
  type WebSearchClient,
} from '../../services/retrieval/webSearch';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import { unusedRetrievalService } from '../../test/fakeRetrieval';
import { createTestDatabase } from '../../test/renderApp';
import { CurateFlow } from './CurateFlow';
import { DraftReveal } from './DraftReveal';
import type { Frame } from './frames';

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
/** One pick in the splice check, found by its title. */
const pickIn = (check: HTMLElement, title: string) =>
  within(within(check).getByText(title).closest('li') as HTMLElement);

async function pickAndCheck(user: ReturnType<typeof userEvent.setup>, ...titles: string[]) {
  for (const title of titles) await user.click(await frame(title));
  await user.click(screen.getByRole('button', { name: /^Review \d frames?$/ }));
  const example =
    screen.queryByRole('button', { name: TONE }) ??
    screen.queryByRole('button', { name: 'bless your heart (spoiler)' });
  if (example) await user.click(example);
  await user.click(screen.getByRole('button', { name: 'Review sources and style' }));
  return screen.findByRole('region', { name: 'Splice check' });
}

/**
 * A Web Animations stand-in: animations finish on the next tick (or never, with `finish: false`),
 * and `cancel()` runs `oncancel` like the real thing.
 */
function stubAnimate({ finish = true } = {}) {
  const animate = vi.fn(() => {
    let onCancel: (() => void) | null = null;
    const animation = { cancel: vi.fn(() => onCancel?.()) } as unknown as Animation;
    Object.defineProperty(animation, 'onfinish', {
      set: (fn: (() => void) | null) => finish && setTimeout(() => fn?.(), 0),
    });
    Object.defineProperty(animation, 'oncancel', {
      set: (fn: (() => void) | null) => (onCancel = fn),
    });
    return animation;
  });
  Element.prototype.animate = animate;
  return animate;
}
const finishingAnimate = () => stubAnimate();

async function keepACard(settings: Partial<Settings>) {
  const flow = await renderFlow(settings, async () => RESPONSE);
  await pickAndCheck(flow.user, 'What does OK boomer mean');
  await flow.user.click(makeButton());
  await flow.user.click(await screen.findByRole('button', { name: 'Keep' }));
  return flow;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (Element.prototype as Partial<Element>).animate;
});

describe('curate a card', () => {
  it('retries omitted sources with user context and persists its provenance', async () => {
    const draftCard = vi.fn<WebSearchClient['draftCard']>(async () => ({
      ...RESPONSE,
      notUsed: [{ source: 1, why: 'not included' }],
    }));
    const { user, db } = await renderFlow({ webSearch: 'on' }, draftCard);
    await pickAndCheck(user, 'What does OK boomer mean', 'OK boomer meaning');
    await user.click(makeButton());
    await user.click(await screen.findByRole('checkbox', { name: 'Reconsider this source' }));
    await user.click(screen.getByRole('button', { name: 'Revise sources and curate again' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Your context or text' }),
      'My interpretation',
    );
    await user.click(screen.getByRole('button', { name: 'Review 2 frames' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Card format' }), 'list');
    await user.click(screen.getByRole('button', { name: 'Review sources and style' }));
    await user.click(makeButton());
    await waitFor(() => expect(draftCard).toHaveBeenCalledTimes(2));
    expect(draftCard.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        kind: 'list',
        userContext: 'My interpretation',
        retry: { preserveSources: [1] },
      }),
    );
    expect(await screen.findByText('My interpretation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(async () =>
      expect((await db.draftCards.toArray())[0]?.userContext).toBe('My interpretation'),
    );
  });
  it('offers kept cards as merge sources before the style step', async () => {
    const { user, repos } = await renderFlow({ webSearch: 'on' });
    await repos.drafts.save({
      id: 'merge-source',
      search: SEARCH,
      card: { ...RESPONSE.card, label: 'My existing explanation' },
      sources: [],
      promptVersion: 'v2',
      savedAt: '2026-11-01T00:00:00.000Z',
    });
    const source = await frame('My existing explanation');
    await user.click(source);
    expect(source).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Review 1 frame' }));
    expect(screen.getByRole('region', { name: 'Card style' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review sources and style' }));
    expect(screen.getByRole('region', { name: 'Splice check' })).toHaveTextContent(
      'My existing explanation',
    );
  });
  it('reviews and sends custom tone and structure after source selection', async () => {
    const draftCard = vi.fn<WebSearchClient['draftCard']>(async () => RESPONSE);
    const { user } = await renderFlow({ webSearch: 'on' }, draftCard);
    await user.click(await frame('What does OK boomer mean'));
    await user.click(screen.getByRole('button', { name: 'Review 1 frame' }));
    await user.type(screen.getByRole('textbox', { name: 'Tone' }), 'Warm and concise');
    await user.type(screen.getByRole('textbox', { name: 'Structure' }), 'Explanation then context');
    await user.click(screen.getByRole('button', { name: 'Review sources and style' }));
    expect(screen.getByRole('region', { name: 'Splice check' })).toHaveTextContent(
      'Warm and concise',
    );
    await user.click(makeButton());
    await waitFor(() => expect(draftCard).toHaveBeenCalled());
    expect(draftCard.mock.calls[0]?.[0].styleGuidance).toEqual({
      tone: 'Warm and concise',
      structure: 'Explanation then context',
    });
  });
  it('Make a card stays disabled until a flagged pick is kept or cut', async () => {
    const first = await renderFlow();
    let check = await pickAndCheck(
      first.user,
      'What does OK boomer mean',
      'Stonks: meaning and origin',
    );
    expect(check).toHaveTextContent('⚠ Doesn’t seem to be about “ok boomer”');
    expect(check).toHaveTextContent('bbc.co.uk');
    expect(check).toHaveTextContent(BBC.snippet);
    expect(makeButton()).toBeDisabled();

    await first.user.click(within(check).getByRole('button', { name: 'Keep' }));
    expect(check).toHaveTextContent('Kept by you: the AI may leave it out');
    expect(makeButton()).toBeEnabled();
    first.unmount();

    const second = await renderFlow();
    check = await pickAndCheck(
      second.user,
      'What does OK boomer mean',
      'Stonks: meaning and origin',
    );
    const cutStonks = pickIn(check, STONKS.title).getByRole('button', { name: 'Cut it out' });
    await second.user.click(cutStonks);
    expect(check).not.toHaveTextContent('Stonks');
    expect(makeButton()).toBeEnabled();
  });

  it('cutting every pick keeps Make disabled', async () => {
    const { user } = await renderFlow();
    const check = await pickAndCheck(user, 'Stonks: meaning and origin');
    await user.click(within(check).getByRole('button', { name: 'Cut it out' }));
    expect(check).not.toHaveTextContent('Stonks');
    expect(makeButton()).toBeDisabled();
  });

  it('any pick can be cut and a picked filter removed, until nothing is left to make', async () => {
    const { user, repos } = await renderFlow();
    await repos.drafts.save({
      id: 'kept-1',
      search: 'bless your heart',
      card: { ...RESPONSE.card, label: TONE },
      sources: [],
      promptVersion: 'v2',
      savedAt: '2026-11-01T00:00:00.000Z',
    });
    const check = await pickAndCheck(user, 'What does OK boomer mean', 'OK boomer meaning');
    expect(makeButton()).toBeEnabled();

    const filters = within(check).getByRole('list', { name: 'Colour filters' });
    expect(filters).toHaveTextContent(TONE);
    await user.click(within(filters).getByRole('button', { name: `Remove ${TONE}` }));
    expect(check).not.toHaveTextContent(TONE);

    await user.click(pickIn(check, BBC.title).getByRole('button', { name: 'Cut it out' }));
    expect(check).not.toHaveTextContent(BBC.title);
    expect(makeButton()).toBeEnabled();
    await user.click(pickIn(check, DICT.title).getByRole('button', { name: 'Cut it out' }));
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
    await pickAndCheck(user, 'What does OK boomer mean', 'OK boomer meaning');
    await user.click(makeButton());

    await waitFor(() => expect(draftCard).toHaveBeenCalled());
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

  it('a hidden spoiler filter shows its search, but the AI still gets its label', async () => {
    const draftCard = vi.fn<WebSearchClient['draftCard']>(async () => RESPONSE);
    const kept = {
      id: 'kept-1',
      search: 'bless your heart',
      card: { ...RESPONSE.card, label: TONE, spoiler: 'major' as const },
      sources: [],
      promptVersion: 'v2',
      savedAt: '2026-11-01T00:00:00.000Z',
    };
    const first = await renderFlow({ webSearch: 'on' }, draftCard);
    await first.repos.drafts.save(kept);
    await first.repos.drafts.list();
    expect(screen.queryByText(TONE)).toBeNull();
    const check = await pickAndCheck(first.user, 'What does OK boomer mean');
    expect(check).toHaveTextContent('bless your heart (spoiler)');
    expect(check).not.toHaveTextContent(TONE);
    await first.user.click(makeButton());
    await waitFor(() => expect(draftCard).toHaveBeenCalled());
    expect(draftCard.mock.calls[0]?.[0].tones).toEqual([
      expect.objectContaining({ label: TONE, gist: RESPONSE.card.gist }),
    ]);
    first.unmount();

    const second = await renderFlow({ webSearch: 'on', spoilers: 'show' });
    await second.repos.drafts.save(kept);
    await second.user.click(await frame('What does OK boomer mean'));
    await second.user.click(screen.getByRole('button', { name: 'Review 1 frame' }));
    expect(await screen.findByRole('button', { name: TONE })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\(spoiler\)/ })).toBeNull();
  });

  it('lists not-used sources with their reason', async () => {
    const { user } = await renderFlow({ webSearch: 'on' }, async () => ({
      ...RESPONSE,
      notUsed: [{ source: 1, why: 'about something else' }],
    }));
    await pickAndCheck(user, 'What does OK boomer mean', 'OK boomer meaning');
    await user.click(makeButton());
    expect(
      await screen.findByText('Not used: OK boomer meaning (about something else)'),
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

  it('moves focus to the card when it appears and back to the tray after Drop', async () => {
    const { user } = await renderFlow({ webSearch: 'on' }, async () => RESPONSE);
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());

    expect(await screen.findByRole('heading', { name: RESPONSE.card.label })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Drop' }));
    expect(await screen.findByRole('button', { name: 'Review 1 frame' })).toHaveFocus();
  });

  describe('a major spoiler', () => {
    const SPOILER = { ...RESPONSE, card: { ...RESPONSE.card, spoiler: 'major' as const } };
    const { label, gist, means, reply } = RESPONSE.card;
    const hidden = [label, gist, means, reply, RESPONSE.card.summary[0]?.text ?? ''];

    async function veiledCard(settings: Partial<Settings> = { webSearch: 'on' }) {
      const flow = await renderFlow(settings, async () => SPOILER);
      await pickAndCheck(flow.user, 'What does OK boomer mean');
      await flow.user.click(makeButton());
      return { ...flow, card: await screen.findByRole('article', { name: /./ }) };
    }

    it('shows only the search until Reveal, then focuses the real name', async () => {
      const { user, card } = await veiledCard();
      expect(card).toHaveAccessibleName(SEARCH);
      expect(card).toHaveTextContent('AI draft · check the sources');
      expect(card).toHaveTextContent('Spoiler');
      expect(card).toHaveTextContent('This card gives away the ending of a story.');
      for (const text of hidden) expect(card).not.toHaveTextContent(text);
      expect(within(card).queryByRole('link')).toBeNull();

      await user.click(within(card).getByRole('button', { name: 'Reveal spoiler' }));
      expect(screen.getByRole('heading', { name: label })).toHaveFocus();
      for (const text of hidden) expect(card).toHaveTextContent(text);
      expect(within(card).getByRole('link', { name: /bbc\.co\.uk/ })).toBeInTheDocument();
    });

    it('can be kept or edited while veiled; Edit uncovers it first', async () => {
      const first = await veiledCard();
      await first.user.click(screen.getByRole('button', { name: 'Keep' }));
      await waitFor(async () => expect(await first.db.draftCards.count()).toBe(1));
      expect((await first.db.draftCards.toArray())[0]?.card).toEqual(SPOILER.card);
      first.unmount();

      const second = await veiledCard();
      await second.user.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue(label);
      expect(screen.getByRole('textbox', { name: 'Gist' })).toHaveValue(gist);
      expect(screen.queryByRole('button', { name: 'Reveal spoiler' })).toBeNull();
    });

    it('is never veiled when spoilers are set to show', async () => {
      const { card } = await veiledCard({ webSearch: 'on', spoilers: 'show' });
      expect(card).toHaveAccessibleName(label);
      for (const text of hidden) expect(card).toHaveTextContent(text);
      expect(within(card).queryByRole('button', { name: 'Reveal spoiler' })).toBeNull();
    });
  });

  it('Edit can change the label, and Keep waits while a needed field is blank', async () => {
    const { user, db } = await renderFlow({ webSearch: 'on' }, async () => RESPONSE);
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    const label = screen.getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    expect(screen.getByRole('button', { name: 'Keep' })).toBeDisabled();
    await user.type(label, 'My own name');
    expect(screen.getByRole('heading', { name: 'My own name' })).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'You could say' }));
    expect(screen.getByRole('button', { name: 'Keep' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'You could say' }), '  ');
    expect(screen.getByRole('button', { name: 'Keep' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'You could say' }), 'Sure.');
    await user.click(screen.getByRole('button', { name: 'Keep' }));

    await waitFor(async () => expect(await db.draftCards.count()).toBe(1));
    const [saved] = await db.draftCards.toArray();
    expect(saved?.card.label).toBe('My own name');
  });

  it('Keep flies the card to the library with a thumbs-up, then returns to the tray', async () => {
    const animate = finishingAnimate();
    const { db } = await keepACard({ webSearch: 'on' });

    expect(await screen.findByRole('img', { name: 'Thumbs up' })).toBeInTheDocument();
    // The copy that flew (it is removed as soon as its flight ends).
    const flew = (el: unknown) => (el as HTMLElement).dataset?.flight === 'library';
    expect(animate.mock.contexts.some(flew)).toBe(true);
    expect(await screen.findByText('Kept on this device.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
    expect(await frame('What does OK boomer mean')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-flight="library"]')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Thumbs up' })).toBeNull();
    expect(await db.draftCards.count()).toBe(1);
    expect(animate).toHaveBeenCalled();
  });

  it('under reduced motion Keep fades instead of flying and still saves', async () => {
    finishingAnimate();
    const { db } = await keepACard({ webSearch: 'on', motion: 'reduce' });

    expect(await screen.findByText('Kept on this device.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Thumbs up' })).toBeNull();
    expect(document.querySelector('[data-flight="library"]')).toBeNull();
    expect(await db.draftCards.count()).toBe(1);
  });

  it('closing during the thumbs-up leaves nothing behind', async () => {
    // Flights never finish on their own here, so the copy is still in the air at unmount.
    stubAnimate({ finish: false });
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const onKeep = vi.fn(async () => {});
      const sent: Frame[] = [
        { key: BBC.url, kind: 'web', from: 'bbc.co.uk', title: BBC.title, line: '', url: BBC.url },
      ];
      const { unmount } = render(
        <MotionPreferenceProvider preference="system">
          <DraftReveal response={RESPONSE} sent={sent} onKeep={onKeep} onDone={onDone} />
        </MotionPreferenceProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onKeep).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('img', { name: 'Thumbs up' })).toBeInTheDocument();
      expect(document.querySelector('[data-flight]')).not.toBeNull();

      unmount();
      act(() => vi.advanceTimersByTime(5000));

      expect(document.querySelector('[data-flight]')).toBeNull();
      expect(onDone).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('in a dialog, Keep flies inside it and up and away from the hidden library link', async () => {
    const animate = stubAnimate({ finish: false });
    const sent: Frame[] = [
      { key: BBC.url, kind: 'web', from: 'bbc.co.uk', title: BBC.title, line: '', url: BBC.url },
    ];
    render(
      <MotionPreferenceProvider preference="system">
        <nav>
          <a href="/favourites">Favourites</a>
        </nav>
        <dialog open>
          <DraftReveal response={RESPONSE} sent={sent} onKeep={async () => {}} />
        </dialog>
      </MotionPreferenceProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    // The page under a modal dialog is covered: a copy on the body, or flying to the nav, is unseen.
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.querySelector('[data-flight="library"]')).not.toBeNull());
    const i = animate.mock.contexts.indexOf(dialog.querySelector('[data-flight="library"]'));
    expect(JSON.stringify((animate.mock.calls as unknown[][])[i]?.[0])).toContain(
      'translate(0px,-340px)',
    );
  });

  it("the browser's cancel (Escape, a back gesture) closes like Close and keeps the dialog", async () => {
    const { onClose } = await renderFlow();
    const dialog = await screen.findByRole('dialog', { name: `Make a card from “${SEARCH}”` });

    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);

    // Prevented: the dialog stays until the page unmounts it, so its exit can play.
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a press on the backdrop closes; a drag from the panel out onto it does not', async () => {
    const { onClose } = await renderFlow();
    const dialog = await screen.findByRole('dialog', { name: `Make a card from “${SEARCH}”` });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 500,
      left: 100,
      right: 500,
    } as DOMRect);
    // jsdom has no PointerEvent: a mouse event of that type carries the coordinates.
    const pressThenClick = (target: Element, x: number, y: number) => {
      fireEvent(target, new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
      // The click lands on the dialog, outside the panel, either way.
      fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    };

    pressThenClick(screen.getByRole('heading', { name: `Make a card from “${SEARCH}”` }), 200, 200);
    expect(onClose).not.toHaveBeenCalled();

    pressThenClick(dialog, 20, 20);
    expect(onClose).toHaveBeenCalledTimes(1);
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

    await waitFor(() => expect(sent).toBeDefined());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => expect(sent?.aborted).toBe(true));
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/);
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
    expect(await frame('What does OK boomer mean')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the no_card message and keeps the tray', async () => {
    const { user } = await renderFlow({ webSearch: 'on' }, async () => {
      throw new WebSearchError('no_card', 'HTTP 422', {
        reason: 'unclear',
        notUsed: [{ source: 0, why: 'different language' }],
      });
    });
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "These results don't explain it. Try ticking others.",
    );
    expect(await frame('What does OK boomer mean')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
    expect(await screen.findByText('Not used · different language')).toBeInTheDocument();
  });

  it.each([
    ['daily_cap', "Today's cards are used up. Try again tomorrow."],
    ['failed', "The card writer didn't answer. Try again."],
  ] as const)("says %s in the card flow's own words", async (failure, text) => {
    const { user } = await renderFlow({ webSearch: 'on' }, async () => {
      throw new WebSearchError(failure, 'x');
    });
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('asks first under "Ask first" and sends nothing before consent', async () => {
    const draftCard = vi.fn<WebSearchClient['draftCard']>(async () => RESPONSE);
    const { user, repos } = await renderFlow({ webSearch: 'ask' }, draftCard);
    await pickAndCheck(user, 'What does OK boomer mean');
    await user.click(makeButton());

    let consent = await screen.findByRole('region', { name: 'Make a card from these?' });
    expect(consent).toHaveTextContent(/OpenAI \(or Cloudflare if OpenAI is busy\)/);
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
