import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('../../app/CurationJobsProvider', () => ({ useCurationJobs: () => mocks }));
vi.mock('../../app/RepositoriesContext', () => {
  const drafts = { save: mocks.save, list: mocks.list };
  return { useRepositories: () => ({ drafts }) };
});
vi.mock('../settings/SettingsContext', () => ({
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

beforeEach(() => {
  mocks.jobs = [];
  mocks.activeCount = 0;
  mocks.cancel.mockReset().mockResolvedValue(undefined);
  mocks.retry.mockReset().mockResolvedValue(undefined);
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.list.mockReset().mockResolvedValue([]);
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
    expect(screen.getByText('Saved preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('shows an empty state and navigation', () => {
    show();
    expect(screen.getByText('No card requests yet.')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('running'));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith(mocks.jobs[1]));
  });

  it('disables retry at capacity and reports cancellation failure', async () => {
    mocks.jobs = [job('running', 'running'), job('failed', 'failed')];
    mocks.activeCount = 5;
    mocks.cancel.mockRejectedValue(new Error('storage failed'));
    show();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Review card' }));
    const preview = screen.getByRole('region', { name: 'Preview for Search done' });
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
    expect(
      screen.queryByRole('region', { name: 'Preview for Search done' }),
    ).not.toBeInTheDocument();
  });
});
