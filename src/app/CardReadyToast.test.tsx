import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurationJob } from '../data/repositories/curationJobRepository';
import { CardReadyToast } from './CardReadyToast';
import { CurationJobsContext, type CurationJobsContextValue } from './useCurationJobs';
import { watchJob } from './watchedJobs';

function job(status: CurationJob['status'], search = 'Gundam', id = 'job-1'): CurationJob {
  return {
    id,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    request: { search },
    sent: [],
  } as unknown as CurationJob;
}

function value(jobs: CurationJob[]): CurationJobsContextValue {
  return {
    jobs,
    activeCount: jobs.filter((j) => j.status === 'running').length,
    start: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
  };
}

function tree(jobs: CurationJob[], hidden = false) {
  return (
    <MemoryRouter>
      <CurationJobsContext.Provider value={value(jobs)}>
        <CardReadyToast hidden={hidden} />
      </CurationJobsContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('CardReadyToast', () => {
  it('says the card is ready, in a polite live region, once a watched job completes', () => {
    const { rerender } = render(tree([job('running')]));
    expect(screen.queryByText(/is ready/)).not.toBeInTheDocument();
    rerender(tree([job('completed')]));
    const text = screen.getByText('Your “Gundam” card is ready');
    expect(text.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/activity');
  });

  it("says the card couldn't be made when a watched job fails", () => {
    const { rerender } = render(tree([job('running')]));
    rerender(tree([job('failed')]));
    expect(screen.getByText('Your “Gundam” card couldn\'t be made')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/activity');
  });

  it('stays quiet for a card the reader is watching appear in Make a card', () => {
    const unwatch = watchJob('job-1');
    const { rerender } = render(tree([job('running')]));
    rerender(tree([job('completed')]));
    expect(screen.queryByText(/is ready/)).not.toBeInTheDocument();
    unwatch();
  });

  it('pops up once the reader has left Make a card while it was still being made', () => {
    const unwatch = watchJob('job-1');
    const { rerender } = render(tree([job('running')]));
    unwatch();
    rerender(tree([job('completed')]));
    expect(screen.getByText('Your “Gundam” card is ready')).toBeInTheDocument();
  });

  it('stays quiet for a job that was already finished when the app loaded', () => {
    render(tree([job('completed')]));
    expect(screen.queryByText(/card is ready/)).not.toBeInTheDocument();
  });

  it('stays quiet when a watched job is cancelled or interrupted', () => {
    const { rerender } = render(tree([job('running'), job('running', 'Akira', 'job-2')]));
    rerender(tree([job('cancelled'), job('interrupted', 'Akira', 'job-2')]));
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();
  });

  it('the dismiss button closes it', () => {
    const { rerender } = render(tree([job('running')]));
    rerender(tree([job('completed')]));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/card is ready/)).not.toBeInTheDocument();
  });

  it('goes away by itself after a few seconds', () => {
    const { rerender } = render(tree([job('running')]));
    rerender(tree([job('completed')]));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/card is ready/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByText(/card is ready/)).not.toBeInTheDocument();
  });

  it('shows nothing while hidden, as on the sign-in page', () => {
    const { rerender } = render(tree([job('running')], true));
    rerender(tree([job('completed')], true));
    expect(screen.queryByText(/card is ready/)).not.toBeInTheDocument();
  });
});
