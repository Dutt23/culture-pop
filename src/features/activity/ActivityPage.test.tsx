import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftCard, DraftResponse } from '../../../shared/cardTypes.js';
import type { CurationJob } from '../../data/repositories/curationJobRepository';
import { ActivityPage } from './ActivityPage';

const mocks = vi.hoisted(() => ({
  jobs: [] as CurationJob[],
  activeCount: 0,
  cancel: vi.fn(),
  retry: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
}));

vi.mock('../../app/useCurationJobs', () => ({ useCurationJobs: () => mocks }));
vi.mock('../../app/useRepositories', () => {
  // Activity reads jobs page by page and asks only whether the read jobs' cards are kept (D69).
  const drafts = {
    save: mocks.save,
    list: mocks.list,
    keptFromActivity: async () => {
      const kept: { id: string }[] = (await mocks.list()) ?? [];
      return new Set(kept.map((card) => card.id).filter((id) => id.startsWith('activity:')));
    },
  };
  const curationJobs = {
    list: async (limit?: number) => mocks.jobs.slice(0, limit),
    count: async () => mocks.jobs.length,
  };
  return { useRepositories: () => ({ drafts, curationJobs }) };
});
vi.mock('../settings/useSettings', () => ({
  useSettings: () => ({ settings: { spoilers: 'hide' } }),
}));
vi.mock('../../components/ui/Page', () => ({
  Page: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock('../drafts/DraftReveal', () => ({
  DraftReveal: ({
    response,
    userContext,
    onKeep,
    onDone,
    readOnly,
  }: {
    response: DraftResponse;
    userContext?: string;
    onKeep: (card: DraftCard) => Promise<void>;
    onDone: (saved: boolean) => void;
    readOnly?: boolean;
  }) => (
    <div>
      <p>{response.card.label}</p>
      <p>{userContext}</p>
      {readOnly ? (
        <p>Saved preview</p>
      ) : (
        <button
          type="button"
          onClick={async () => {
            await onKeep(response.card);
            onDone(true);
          }}
        >
          Keep
        </button>
      )}
    </div>
  ),
}));

const card: DraftCard = {
  label: 'A useful card',
  gist: 'An explanation.',
  means: '',
  reply: '',
  summary: [{ text: 'An explanation.', sources: [0] }],
  context: [],
  example: null,
  spoiler: 'none',
};
const job = (id: string, status: CurationJob['status']): CurationJob => ({
  id,
  status,
  createdAt: '2026-11-19T00:00:00Z',
  updatedAt: '2026-11-19T00:00:00Z',
  request: { search: `Search ${id}`, sources: [] },
  sent: [
    {
      key: id,
      kind: 'web',
      from: 'example.com',
      title: 'A source',
      line: 'Evidence.',
      url: 'https://example.com',
      provenance: 'user',
    },
  ],
});
const show = () =>
  render(
    <MemoryRouter>
      <ActivityPage />
    </MemoryRouter>,
  );

// Closing the tray steps history back; jsdom does that late, into the next test. Not here.
beforeEach(() => {
  window.history.replaceState(null, '');
  vi.spyOn(window.history, 'back').mockImplementation(() => {});
  mocks.jobs = [];
  mocks.activeCount = 0;
  mocks.cancel.mockReset().mockResolvedValue(undefined);
  mocks.retry.mockReset().mockResolvedValue(undefined);
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.list.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ActivityPage', () => {
  it('restores saved status and read-only preview from persisted cards after remount', async () => {
    mocks.jobs = [
      {
        ...job('done', 'completed'),
        response: { card, notUsed: [], provider: 'fake', promptVersion: 'v9' },
      },
    ];
    mocks.list.mockResolvedValue([{ id: 'activity:done', card }]);
    const first = show();
    expect(await screen.findByText('Saved to Your cards')).toBeInTheDocument();
    first.unmount();
    show();
    expect(await screen.findByText('Saved to Your cards')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review card' }));
    expect(await screen.findByText('Saved preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('shows an empty state and navigation', async () => {
    show();
    expect(await screen.findByText('No card requests yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find sources for another card' })).toHaveAttribute(
      'href',
      '/search',
    );
  });

  it('cancels a running request and retries an interrupted request', async () => {
    mocks.jobs = [job('running', 'running'), job('interrupted', 'interrupted')];
    mocks.activeCount = 1;
    show();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 cards in progress');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('running'));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith(mocks.jobs[1]));
  });

  it('disables retry at capacity and reports cancellation failure', async () => {
    mocks.jobs = [job('running', 'running'), job('failed', 'failed')];
    mocks.activeCount = 5;
    mocks.cancel.mockRejectedValue(new Error('storage failed'));
    show();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not cancel');
  });

  it('previews a result and saves with idempotent job ID and user provenance', async () => {
    mocks.jobs = [
      {
        ...job('done', 'completed'),
        userContext: 'My context',
        color: 'sage',
        response: { card, notUsed: [], provider: 'fake', promptVersion: 'v9' },
      },
    ];
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Review card' }));
    const preview = await screen.findByRole('dialog', { name: 'Review “Search done”' });
    expect(preview).toHaveTextContent('My context');
    fireEvent.click(within(preview).getByRole('button', { name: 'Keep' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'activity:done',
          card,
          userContext: 'My context',
          color: 'sage',
          sources: [expect.objectContaining({ provenance: 'user' })],
        }),
      ),
    );
    expect(await screen.findByText('Saved to Your cards')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Review “Search done”' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('opens the review in a tray; Escape closes it and focus returns to the button', async () => {
    mocks.jobs = [
      {
        ...job('done', 'completed'),
        response: { card, notUsed: [], provider: 'fake', promptVersion: 'v9' },
      },
    ];
    show();
    const opener = await screen.findByRole('button', { name: 'Review card' });
    expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(opener);
    const tray = await screen.findByRole('dialog', { name: 'Review “Search done”' });
    expect(within(tray).getByText('A useful card')).toBeInTheDocument();
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(tray, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Review “Search done”' }),
      ).not.toBeInTheDocument(),
    );
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute('aria-expanded', 'false');
  });
});
