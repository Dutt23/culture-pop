import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthClient } from '../../services/auth/authClient';
import { AccountSection } from './AccountSection';

function fakeClient(): AuthClient {
  return {
    sendCode: vi.fn(),
    signInWithCode: vi.fn(),
    signInWithPassword: vi.fn(),
    setPassword: vi.fn(),
    signOut: vi.fn(async () => ({ ok: true }) as const),
    session: vi.fn(async () => ({
      signedIn: true,
      email: 'reader@example.test',
      quota: { available: 7, reserved: 0 },
    })),
  };
}

const show = (client: AuthClient) =>
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<AccountSection client={client} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  localStorage.clear();
});

describe('AccountSection', () => {
  it('offers sign-in without asking the server on a device that never signed in', () => {
    const client = fakeClient();
    show(client);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(client.session).not.toHaveBeenCalled();
  });

  it('shows who is signed in, and signing out goes to sign-in', async () => {
    localStorage.setItem('pcd-account', 'reader@example.test');
    const client = fakeClient();
    show(client);
    expect(await screen.findByText('reader@example.test')).toBeInTheDocument();
    expect(screen.getByText(/7 cards left/)).toBeInTheDocument();
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign out' })));
    expect(client.signOut).toHaveBeenCalled();
    expect(screen.getByText('Sign-in page')).toBeInTheDocument();
  });

  it('greys Sign out while it runs, and brings it back with a message if it fails', async () => {
    localStorage.setItem('pcd-account', 'reader@example.test');
    let fail: () => void = () => {};
    const client = {
      ...fakeClient(),
      signOut: vi.fn(
        () =>
          new Promise<{ ok: false; error: 'unavailable' }>((resolve) => {
            fail = () => resolve({ ok: false, error: 'unavailable' });
          }),
      ),
    };
    show(client);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await act(async () => fail());
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't sign out. Try again.");
    expect(screen.getByRole('button', { name: 'Sign out' })).not.toHaveAttribute('aria-disabled');
  });
});
