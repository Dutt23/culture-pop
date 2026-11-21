import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountSession, AuthClient } from '../services/auth/authClient';
import { reportSessionEnded } from '../services/auth/sessionEnded';
import { fakeAuthClient } from '../test/fakeAuth';
import { RequireSignIn, SignInGate } from './RequireSignIn';

function SignInStub() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p>sign-in page at {pathname + search}</p>
      <button type="button" onClick={() => void navigate(-1)}>
        Back
      </button>
    </>
  );
}

/**
 * The guard around every page. With `gate`, the sign-in page has its gate too (which asks the
 * client again); without, it is a plain page, so a test sees exactly where the guard sent it.
 */
function renderGuard(
  client: AuthClient,
  route = '/packs/abc?q=x#top',
  { gate = false, entries = [route] }: { gate?: boolean; entries?: string[] } = {},
) {
  const signIn = <Route path="/sign-in" element={<SignInStub />} />;
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.indexOf(route)}>
      <Routes>
        {gate ? <Route element={<SignInGate client={client} />}>{signIn}</Route> : signIn}
        <Route element={<RequireSignIn client={client} />}>
          <Route path="/discover" element={<p>discover page</p>} />
          <Route
            path="*"
            element={
              <>
                <p>protected page</p>
                <Link to="/favourites">Favourites</Link>
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** A client whose session answer the test hands over when it chooses. */
function pendingClient() {
  let answer: (session: AccountSession | undefined) => void = () => {};
  const session = vi.fn(
    () =>
      new Promise<AccountSession | undefined>((resolve) => {
        answer = resolve;
      }),
  );
  const client: AuthClient = { ...fakeAuthClient(), session };
  return { client, session, answer: (s?: AccountSession) => answer(s) };
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('RequireSignIn', () => {
  it('sends a signed-out visitor to sign-in, remembering where they were going', async () => {
    renderGuard(fakeAuthClient({ signedIn: false }));
    expect(
      await screen.findByText('sign-in page at /sign-in?next=%2Fpacks%2Fabc%3Fq%3Dx%23top'),
    ).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('shows the page once the server says who is signed in', async () => {
    renderGuard(fakeAuthClient({ signedIn: true, email: 'r@e.test' }));
    expect(await screen.findByText('protected page')).toBeInTheDocument();
  });

  it('shows neither the page nor sign-in while it is still checking', async () => {
    const { client, answer } = pendingClient();
    renderGuard(client);
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    expect(screen.queryByText(/sign-in page/)).not.toBeInTheDocument();
    await act(async () => answer({ signedIn: true, email: 'r@e.test' }));
    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('lets a device that signed in before use the app offline', async () => {
    localStorage.setItem('pcd-account', 'r@e.test');
    renderGuard(fakeAuthClient(null));
    expect(await screen.findByText('protected page')).toBeInTheDocument();
  });

  it('sends a device that never signed in to sign-in when the server cannot answer', async () => {
    renderGuard(fakeAuthClient(null));
    expect(await screen.findByText(/sign-in page/)).toBeInTheDocument();
  });

  it('checks again when back online, and signs out if the server says so', async () => {
    localStorage.setItem('pcd-account', 'r@e.test');
    const { client, session, answer } = pendingClient();
    renderGuard(client);
    await act(async () => answer(undefined));
    expect(screen.getByText('protected page')).toBeInTheDocument();

    act(() => setOnline(false));
    await act(async () => answer(undefined));
    act(() => setOnline(true));
    // The page stays up while it re-checks.
    expect(screen.getByText('protected page')).toBeInTheDocument();
    await act(async () => answer({ signedIn: false }));
    expect(await screen.findByText(/sign-in page/)).toBeInTheDocument();
    expect(session).toHaveBeenCalledTimes(3);
  });

  it('signs out at once when an /api call says the sign-in ended', async () => {
    renderGuard(fakeAuthClient());
    expect(await screen.findByText('protected page')).toBeInTheDocument();
    act(() => reportSessionEnded());
    expect(await screen.findByText(/sign-in page at \/sign-in\?next=/)).toBeInTheDocument();
  });

  it('signs out when another tab signs out (the hint disappears)', async () => {
    localStorage.setItem('pcd-account', 'r@e.test');
    renderGuard(fakeAuthClient());
    expect(await screen.findByText('protected page')).toBeInTheDocument();
    localStorage.removeItem('pcd-account');
    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: 'pcd-account' })));
    expect(await screen.findByText(/sign-in page/)).toBeInTheDocument();
  });

  it('checks again on every page change', async () => {
    const { client, session, answer } = pendingClient();
    renderGuard(client);
    await act(async () => answer({ signedIn: true, email: 'r@e.test' }));
    act(() => void fireEvent.click(screen.getByRole('link', { name: 'Favourites' })));
    expect(session).toHaveBeenCalledTimes(2);
    await act(async () => answer({ signedIn: false }));
    expect(
      await screen.findByText('sign-in page at /sign-in?next=%2Ffavourites'),
    ).toBeInTheDocument();
  });

  it('hides a page restored from the back/forward cache until checked again', async () => {
    const { client, answer } = pendingClient();
    renderGuard(client);
    await act(async () => answer({ signedIn: true, email: 'r@e.test' }));
    act(() => void window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    await act(async () => answer({ signedIn: false }));
    expect(await screen.findByText(/sign-in page/)).toBeInTheDocument();
  });

  it('does not show a page from history after signing out (Back)', async () => {
    renderGuard(fakeAuthClient({ signedIn: false }), '/sign-in', {
      entries: ['/favourites', '/sign-in'],
    });
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    // On /favourites now: the loader shows until the server answers, then back to sign-in.
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    expect(
      await screen.findByText('sign-in page at /sign-in?next=%2Ffavourites'),
    ).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });
});

describe('SignInGate', () => {
  it('sends someone already signed in on to where they were going', async () => {
    renderGuard(fakeAuthClient(), '/sign-in?next=%2Fpacks%2Fabc', { gate: true });
    expect(await screen.findByText('protected page')).toBeInTheDocument();
    expect(screen.queryByText(/sign-in page/)).not.toBeInTheDocument();
  });

  it('sends someone already signed in to Discover when nothing was asked for', async () => {
    renderGuard(fakeAuthClient(), '/sign-in', { gate: true });
    expect(await screen.findByText('discover page')).toBeInTheDocument();
  });

  it('shows no sign-in form while it checks, then the form to someone signed out', async () => {
    const { client, answer } = pendingClient();
    renderGuard(client, '/sign-in', { gate: true });
    expect(screen.queryByText(/sign-in page/)).not.toBeInTheDocument();
    await act(async () => answer({ signedIn: false }));
    expect(screen.getByText('sign-in page at /sign-in')).toBeInTheDocument();
  });
});
