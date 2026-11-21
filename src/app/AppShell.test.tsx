import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { CurationJob } from '../data/repositories/curationJobRepository';
import { fakeAuthClient } from '../test/fakeAuth';
import { AppShell } from './AppShell';
import { CurationJobsContext, type CurationJobsContextValue } from './useCurationJobs';

const running = (id: string) =>
  ({ id, status: 'running', request: { search: id }, sent: [] }) as unknown as CurationJob;

function shell(activeCount: number) {
  const jobs = Array.from({ length: activeCount }, (_, i) => running(`job-${i}`));
  const value: CurationJobsContextValue = {
    jobs,
    activeCount,
    start: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
  };
  render(
    <MemoryRouter initialEntries={['/discover']}>
      <CurationJobsContext.Provider value={value}>
        <AppShell authClient={fakeAuthClient()}>
          <p>Page</p>
        </AppShell>
      </CurationJobsContext.Provider>
    </MemoryRouter>,
  );
  return within(screen.getByRole('navigation', { name: 'Primary' }));
}

describe('the Activity tab while cards are being made (owner, 2026-11-22)', () => {
  it('shows the count on its icon and says it in words', () => {
    const nav = shell(1);
    const tab = nav.getByRole('link', { name: 'Activity, 1 card in progress' });
    expect(tab).toHaveTextContent('1');
  });

  it('counts several', () => {
    const nav = shell(3);
    expect(nav.getByRole('link', { name: 'Activity, 3 cards in progress' })).toBeInTheDocument();
  });

  it('is a plain tab when nothing is pending', () => {
    const nav = shell(0);
    expect(nav.getByRole('link', { name: 'Activity' })).not.toHaveTextContent(/\d/);
  });
});
