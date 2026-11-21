import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountSession, AuthClient, AuthResult } from '../services/auth/authClient';
import { browserLikeBack, settle } from '../test/browserBack';
import { fakeAuthClient } from '../test/fakeAuth';
import { OVERLAY_MARK } from '../components/ui/useBackCloses';
import { AccountMenu } from './AccountMenu';
import type { CurationJob } from '../data/repositories/curationJobRepository';
import { CurationJobsContext, type CurationJobsContextValue } from './useCurationJobs';

const EMAIL = 'reader@example.test';

function runningJob(search: string, id = 'job-1'): CurationJob {
  return {
    id,
    status: 'running',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    request: { search },
    sent: [],
  } as unknown as CurationJob;
}

function jobsValue(jobs: CurationJob[]): CurationJobsContextValue {
  return {
    jobs,
    activeCount: jobs.length,
    start: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
  };
}

function show(client: AuthClient, jobs: CurationJob[] = [], { strict = false } = {}) {
  render(
    <MemoryRouter initialEntries={['/discover']}>
      <CurationJobsContext.Provider value={jobsValue(jobs)}>
        <Routes>
          <Route path="/discover" element={<AccountMenu client={client} />} />
          <Route path="/settings" element={<p>Settings page</p>} />
          <Route path="/activity" element={<p>Activity page</p>} />
          <Route path="/sign-in" element={<p>Sign-in page</p>} />
        </Routes>
      </CurationJobsContext.Provider>
    </MemoryRouter>,
    // StrictMode as in development (src/main.tsx): mount, unmount, mount again.
    { reactStrictMode: strict },
  );
  return screen.getByRole('button', { name: /^Your account/ });
}

async function openTray(client: AuthClient, jobs: CurationJob[] = [], strict = false) {
  const button = show(client, jobs, { strict });
  fireEvent.click(button);
  const tray = await screen.findByRole('dialog', { name: 'Your account' });
  return { button, tray };
}

/** A sign-out the test finishes when it chooses. */
function slowSignOut(session?: AccountSession) {
  let finish: (result: AuthResult) => void = () => {};
  const signOut = vi.fn(
    () =>
      new Promise<AuthResult>((resolve) => {
        finish = resolve;
      }),
  );
  const client: AuthClient = { ...fakeAuthClient(session), signOut };
  return { client, signOut, finish: (r: AuthResult) => finish(r) };
}

// Closing the tray steps history back; jsdom does that late, into the next test. Not here.
beforeEach(() => {
  localStorage.setItem('pcd-account', EMAIL);
  window.history.replaceState(null, '');
  vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AccountMenu', () => {
  it("shows the signed-in person's initial and names them for screen readers", () => {
    const button = show(fakeAuthClient());
    expect(button).toHaveAccessibleName(`Your account, ${EMAIL}`);
    expect(button).toHaveTextContent('R');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens a tray with who is signed in, wider web search and what is left today', async () => {
    const session = {
      signedIn: true,
      email: EMAIL,
      widerWeb: true,
      quota: { available: 4, reserved: 0 },
    };
    const { tray } = await openTray(fakeAuthClient(session));
    expect(within(tray).getByText(`Signed in as ${EMAIL}`)).toBeInTheDocument();
    expect(await within(tray).findByText('On')).toBeInTheDocument();
    expect(within(tray).getByText('4 cards left')).toBeInTheDocument();
    expect(within(tray).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(within(tray).getByRole('link', { name: 'Activity' })).toBeInTheDocument();
  });

  it('keeps a slot for daily use until the server sends it, and shows search off', async () => {
    const off = fakeAuthClient({ signedIn: true, email: EMAIL, widerWeb: false });
    const { tray } = await openTray(off);
    expect(await within(tray).findByText('Off')).toBeInTheDocument();
    expect(within(tray).getByText(/Your daily use shows here/)).toBeInTheDocument();
  });

  it('Escape closes it and puts focus back on the account button', async () => {
    const { button, tray } = await openTray(fakeAuthClient());
    fireEvent.keyDown(tray, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and stays open under StrictMode, as in development (owner bug, 2026-11-22)', async () => {
    browserLikeBack();
    const { button, tray } = await openTray(fakeAuthClient(), [], true);
    await settle();
    expect(tray).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Your account' })).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('Back closes it instead of leaving the page', async () => {
    await openTray(fakeAuthClient());
    expect((window.history.state as Record<string, unknown>)?.[OVERLAY_MARK]).toBeTruthy();
    act(() => {
      window.history.replaceState(null, '');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Your account/ })).toBeInTheDocument();
  });

  it('a link goes to its page and closes the tray', async () => {
    const { tray } = await openTray(fakeAuthClient());
    fireEvent.click(within(tray).getByRole('link', { name: 'Settings' }));
    expect(screen.getByText('Settings page')).toBeInTheDocument();
  });

  it('signs out once, greyed while it runs, switches off and lands on sign-in', async () => {
    const { client, signOut, finish } = slowSignOut();
    const { tray } = await openTray(client);
    fireEvent.click(within(tray).getByRole('button', { name: 'Sign out' }));
    const busy = within(tray).getByRole('button', { name: 'Signing out…' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(busy);
    expect(signOut).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true }));
    // The screen switches off first, then sign-in.
    expect(await screen.findByText('Sign-in page')).toBeInTheDocument();
  });

  it('stays open while signing out, then says so if it fails and works again', async () => {
    const { client, signOut, finish } = slowSignOut();
    const { tray } = await openTray(client);
    fireEvent.click(within(tray).getByRole('button', { name: 'Sign out' }));
    fireEvent.keyDown(tray, { key: 'Escape' });
    await act(async () => finish({ ok: false, error: 'unavailable' }));
    expect(within(tray).getByRole('alert')).toHaveTextContent("Couldn't sign out. Try again.");
    const again = within(tray).getByRole('button', { name: 'Sign out' });
    expect(again).not.toHaveAttribute('aria-disabled');
    fireEvent.click(again);
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('says nothing about cards in progress when none are being made', async () => {
    const { button, tray } = await openTray(fakeAuthClient());
    expect(button).toHaveAccessibleName(`Your account, ${EMAIL}`);
    expect(within(tray).queryByText('Cards in progress')).not.toBeInTheDocument();
  });

  it('marks the button and names the count while cards are being made', () => {
    const button = show(fakeAuthClient(), [runningJob('Gundam')]);
    expect(button).toHaveAccessibleName(`Your account, ${EMAIL}, 1 card being made`);
    const two = [runningJob('Gundam'), runningJob('Akira', 'job-2')];
    cleanup();
    expect(show(fakeAuthClient(), two)).toHaveAccessibleName(
      `Your account, ${EMAIL}, 2 cards being made`,
    );
  });

  it('lists each running search in the tray, linking to Activity', async () => {
    const jobs = [runningJob('Gundam'), runningJob('Akira', 'job-2')];
    const { tray } = await openTray(fakeAuthClient(), jobs);
    expect(within(tray).getByText('Cards in progress')).toBeInTheDocument();
    const link = within(tray).getByRole('link', { name: /Gundam.*being made/ });
    expect(link).toHaveAttribute('href', '/activity');
    expect(within(tray).getByRole('link', { name: /Akira.*being made/ })).toBeInTheDocument();
    fireEvent.click(link);
    expect(screen.getByText('Activity page')).toBeInTheDocument();
  });
});
