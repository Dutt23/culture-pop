import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import type { AuthClient, AuthResult } from '../../services/auth/authClient';
import { SignInPage } from './SignInPage';

const ok: AuthResult = { ok: true, email: 'reader@example.test' };

function fakeClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    sendCode: vi.fn(async () => ok),
    signInWithCode: vi.fn(async () => ok),
    signInWithPassword: vi.fn(async () => ok),
    setPassword: vi.fn(async () => ok),
    signOut: vi.fn(async () => ok),
    session: vi.fn(async () => ({ signedIn: false })),
    ...overrides,
  };
}

function setup(client = fakeClient(), motion: 'system' | 'reduce' = 'system') {
  render(
    <MotionPreferenceProvider preference={motion}>
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage client={client} />} />
          <Route path="/settings" element={<p>Settings page</p>} />
        </Routes>
      </MemoryRouter>
    </MotionPreferenceProvider>,
  );
  const mascot = () => screen.getByRole('img', { name: /mascot/i });
  return {
    client,
    mascot,
    pose: () => mascot().getAttribute('data-pose'),
    gaze: () => mascot().getAttribute('data-gaze'),
    email: () => screen.getByLabelText('Email'),
    // By id: the method switch also has an option labelled "Password".
    password: () => passwordBox(),
  };
}

function passwordBox(): HTMLElement {
  const box = document.getElementById('sign-in-password');
  if (!box) throw new Error('no password box');
  return box;
}

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

afterEach(() => {
  vi.useRealTimers();
});

describe('the mascot', () => {
  it('follows the email as it is typed', () => {
    const s = setup();
    fireEvent.focus(s.email());
    expect(s.gaze()).toBe('-1.00');
    type(s.email(), 'a'.repeat(12));
    expect(s.gaze()).toBe('0.00');
    type(s.email(), 'a'.repeat(30));
    expect(s.gaze()).toBe('1.00');
    expect(s.pose()).toBe('rest');
  });

  it('covers its eyes for the password, peeks once, then covers again', () => {
    vi.useFakeTimers();
    const s = setup();
    fireEvent.focus(s.password());
    expect(s.pose()).toBe('cover');
    act(() => void vi.advanceTimersByTime(700));
    expect(s.pose()).toBe('peek-right');
    act(() => void vi.advanceTimersByTime(800));
    expect(s.pose()).toBe('cover');
    act(() => void vi.advanceTimersByTime(5000));
    expect(s.pose()).toBe('cover');
  });

  it("while peeking, its eyes follow the password; while covered they don't", () => {
    vi.useFakeTimers();
    const s = setup();
    fireEvent.focus(s.password());
    type(s.password(), 'secret');
    expect(s.gaze()).toBe('none');
    act(() => void vi.advanceTimersByTime(700));
    expect(s.gaze()).toBe('-0.50');
  });

  it('peeks for as long as the password is shown, watching it', () => {
    const s = setup();
    fireEvent.focus(s.password());
    type(s.password(), 'a'.repeat(24));
    const show = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(show);
    expect(s.password()).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.focus(s.password());
    expect(s.pose()).toBe('peek-left');
    expect(s.gaze()).toBe('1.00');
  });

  it('keeps peeking when focus moves from an empty password box to Show', () => {
    const s = setup();
    fireEvent.focus(s.password());
    fireEvent.blur(s.password());
    const show = screen.getByRole('button', { name: 'Show password' });
    fireEvent.focus(show);
    fireEvent.click(show);
    expect(s.pose()).toBe('peek-left');
  });

  it('puts its hands down when the password box is left empty', () => {
    const s = setup();
    fireEvent.focus(s.password());
    fireEvent.blur(s.password());
    expect(s.pose()).toBe('rest');
  });

  it('skips the peek when the reader asked for less motion', () => {
    vi.useFakeTimers();
    const s = setup(fakeClient(), 'reduce');
    fireEvent.focus(s.password());
    act(() => void vi.advanceTimersByTime(2000));
    expect(s.pose()).toBe('cover');
  });

  it('folds into an envelope for an emailed code, and opens it once sent', async () => {
    const s = setup();
    expect(s.mascot()).toHaveAttribute('data-form', 'bot');
    fireEvent.click(screen.getByRole('radio', { name: 'Email code' }));
    expect(s.mascot()).toHaveAttribute('data-form', 'mail');
    type(s.email(), 'reader@example.test');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Send code' })));
    expect(s.mascot()).toHaveAttribute('data-form', 'sent');
  });
});

describe('signing in', () => {
  it('signs in with a password and goes to Settings', async () => {
    const s = setup();
    type(s.email(), ' reader@example.test ');
    type(s.password(), 'correct horse battery');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(s.client.signInWithPassword).toHaveBeenCalledWith(
      'reader@example.test',
      'correct horse battery',
    );
    expect(screen.getByText('Settings page')).toBeInTheDocument();
  });

  it('says plainly when the password is wrong, and stays put', async () => {
    const s = setup(
      fakeClient({
        signInWithPassword: vi.fn(async () => ({ ok: false, error: 'wrong_password' }) as const),
      }),
    );
    type(s.email(), 'reader@example.test');
    type(s.password(), 'nope');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(screen.getByRole('alert')).toHaveTextContent("That email and password don't match.");
    expect(screen.queryByText('Settings page')).not.toBeInTheDocument();
  });

  it('marks the box an error is about, and moves to the code box once it opens', async () => {
    const s = setup();
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(s.email()).toHaveAttribute('aria-invalid', 'true');
    expect(s.email()).toHaveAccessibleDescription('Enter your email first.');
    type(s.email(), 'reader@example.test');
    type(s.password(), 'x');
    expect(s.email()).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Email code' }));
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Send code' })));
    expect(s.email()).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Code from the email')).toHaveFocus();
    expect(screen.getByLabelText('Code from the email')).toHaveAccessibleDescription(
      'Code sent. Check your email.',
    );
  });

  it('asks for an email before calling the server', async () => {
    const s = setup();
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email first.');
    expect(s.client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('sends a code, then signs in with it', async () => {
    const s = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Email code' }));
    type(s.email(), 'reader@example.test');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Send code' })));
    expect(s.client.sendCode).toHaveBeenCalledWith('reader@example.test');
    expect(screen.getByRole('status')).toHaveTextContent('Code sent. Check your email.');
    type(screen.getByLabelText('Code from the email'), '12 34-56');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(s.client.signInWithCode).toHaveBeenCalledWith('reader@example.test', '123456');
    expect(screen.getByText('Settings page')).toBeInTheDocument();
  });

  it('"Forgot password?" sets a new password with an emailed code', async () => {
    const s = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    type(s.email(), 'reader@example.test');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Send code' })));
    type(screen.getByLabelText('Code from the email'), '123456');
    type(screen.getByLabelText('New password'), 'short');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(screen.getByRole('alert')).toHaveTextContent('at least 10 characters');
    expect(s.client.setPassword).not.toHaveBeenCalled();
    type(screen.getByLabelText('New password'), 'a brand new passphrase');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(s.client.setPassword).toHaveBeenCalledWith(
      'reader@example.test',
      '123456',
      'a brand new passphrase',
    );
  });

  it('can send a new code, and editing the email asks for a fresh one', async () => {
    const s = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Email code' }));
    type(s.email(), 'reader@example.test');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Send code' })));
    await act(
      async () => void fireEvent.click(screen.getByRole('button', { name: 'Send a new code' })),
    );
    expect(s.client.sendCode).toHaveBeenCalledTimes(2);
    type(s.email(), 'other@example.test');
    expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
    expect(s.mascot()).toHaveAttribute('data-form', 'mail');
  });

  it('recovers when the request itself throws', async () => {
    const s = setup(
      fakeClient({
        signInWithPassword: vi.fn(async () => {
          throw new Error('boom');
        }),
      }),
    );
    type(s.email(), 'reader@example.test');
    type(s.password(), 'pw');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Sign in' })));
    expect(screen.getByRole('alert')).toHaveTextContent("Signing in isn't working right now.");
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-busy', 'false');
  });

  it('hides the closed parts of the form from keyboards and screen readers', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Email code' }));
    expect(passwordBox().closest('[data-open]')).toHaveAttribute('data-open', 'false');
    expect(passwordBox().closest('[inert]')).not.toBeNull();
  });
});
