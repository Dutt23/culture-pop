import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Page } from '../../components/ui/Page';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import {
  createAuthClient,
  type AuthClient,
  type AuthFailure,
  type AuthResult,
} from '../../services/auth/authClient';
import { CODE_LENGTH, CODE_PATTERN, MIN_PASSWORD } from '../../../shared/auth.js';
import { returnPathOf } from './returnPath';
import { SignInScene, type Pose } from './SignInScene';
import styles from './SignInPage.module.css';

/**
 * Sign in with a password or an emailed code (D64). The mascot follows the email as it's typed,
 * covers its eyes for the password (peeking once), peeks while the password is shown, and folds
 * into an envelope for the code. The server keeps the sign-in; this page only sends what's typed.
 */

type Mode = 'password' | 'code';
type Field = 'email' | 'password' | 'code' | 'newPassword';
/** An error names the box it is about, so that box is marked invalid and points at the error. */
type Message = { kind: 'ok'; text: string } | { kind: 'error'; text: string; field?: Field };

const MODES = [
  { value: 'password', label: 'Password' },
  { value: 'code', label: 'Email code' },
] as const;

/** When the one peek starts after the password box gets focus, and how long it lasts. */
const PEEK_AFTER_MS = 700;
const PEEK_FOR_MS = 800;
/** How many typed characters take the eyes from one end of the box to the other. */
const GAZE_SPAN = 24;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_ID = 'sign-in-status';
const ERROR_ID = 'sign-in-error';

const MESSAGES: Record<AuthFailure, string> = {
  wrong_code: "That code didn't work. Check it, or send a new one.",
  wrong_password: "That email and password don't match.",
  weak_password: `Choose a longer password: at least ${MIN_PASSWORD} characters.`,
  same_password: "That's already your password. Choose a new one.",
  too_many_attempts: 'Too many tries. Wait a minute, then try again.',
  bad_request: 'Check what you typed, then try again.',
  offline: "You're offline. Connect, then try again.",
  unavailable: "Signing in isn't working right now. Try again soon.",
};

const defaultClient = createAuthClient();

/** Opens and closes its content by animating its height, so the card never jumps. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={styles.collapse} data-open={open} inert={!open}>
      <div className={styles.collapseInner}>{children}</div>
    </div>
  );
}

interface ShowButtonProps {
  shown: boolean;
  what: string;
  onToggle: () => void;
  /** The button belongs to its password box: focus on it keeps the mascot on that box. */
  onFocus?: () => void;
  onBlur?: () => void;
}

function ShowButton({ shown, what, onToggle, onFocus, onBlur }: ShowButtonProps) {
  return (
    <button
      type="button"
      className={styles.secondary}
      aria-pressed={shown}
      aria-label={`${shown ? 'Hide' : 'Show'} ${what}`}
      onClick={onToggle}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {shown ? 'Hide' : 'Show'}
    </button>
  );
}

export function SignInPage({ client = defaultClient }: { client?: AuthClient }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { reduced } = useMotionPresets();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const timers = useRef<number[]>([]);
  const codeRef = useRef<HTMLInputElement>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  // The code box takes focus as it opens; its description is the "Code sent" status.
  useEffect(() => {
    if (codeSent) codeRef.current?.focus();
  }, [codeSent]);

  // The hands come up while the password box has focus or something typed in it.
  const hiding = mode === 'password' && (focused === 'password' || password !== '');
  const pose: Pose = !hiding
    ? 'rest'
    : showPassword
      ? 'peek-left'
      : peeking
        ? 'peek-right'
        : 'cover';
  const form = mode === 'password' ? 'bot' : codeSent ? 'sent' : 'mail';
  // Eyes follow a password only while it can be seen (a peek, or Show).
  const watched: Field | null =
    focused === 'password'
      ? pose === 'cover'
        ? null
        : 'password'
      : focused === 'newPassword'
        ? showNew
          ? 'newPassword'
          : null
        : focused;
  const watchedValue = { email, password, code, newPassword }[watched ?? 'email'];
  const gazeX =
    watched === null ? null : -1 + (2 * Math.min(watchedValue.length, GAZE_SPAN)) / GAZE_SPAN;

  const invalid = (field: Field) =>
    message?.kind === 'error' && message.field === field ? true : undefined;
  const describedBy = (field: Field, also?: string) =>
    [also, invalid(field) ? ERROR_ID : undefined].filter(Boolean).join(' ') || undefined;

  function focusPassword() {
    setFocused('password');
    clearTimers();
    setPeeking(false);
    if (showPassword || reduced) return;
    timers.current.push(
      window.setTimeout(() => setPeeking(true), PEEK_AFTER_MS),
      window.setTimeout(() => setPeeking(false), PEEK_AFTER_MS + PEEK_FOR_MS),
    );
  }

  function blurPassword() {
    setFocused(null);
    clearTimers();
    setPeeking(false);
  }

  function switchMode(next: Mode, wantsNewPassword = false) {
    setMode(next);
    setCodeSent(false);
    setCode('');
    setPassword('');
    setSettingPassword(wantsNewPassword);
    setShowPassword(false);
    setShowNew(false);
    setPeeking(false);
    clearTimers();
    setMessage(null);
  }

  /** Runs one request with the busy state, whatever happens. */
  async function run(request: () => Promise<AuthResult>): Promise<AuthResult> {
    setBusy(true);
    setMessage(null);
    try {
      return await request();
    } catch {
      return { ok: false, error: 'unavailable' };
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(address: string) {
    const result = await run(() => client.sendCode(address));
    if (!result.ok) return setMessage({ kind: 'error', text: MESSAGES[result.error] });
    setCodeSent(true);
    setMessage({ kind: 'ok', text: 'Code sent. Check your email.' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (!EMAIL.test(address))
      return setMessage({ kind: 'error', text: 'Enter your email first.', field: 'email' });
    if (mode === 'password' && !password) {
      return setMessage({ kind: 'error', text: 'Enter your password.', field: 'password' });
    }
    if (mode === 'code' && !codeSent) return sendCode(address);
    if (mode === 'code' && !CODE_PATTERN.test(code)) {
      const text = `Enter the ${CODE_LENGTH}-digit code from the email.`;
      return setMessage({ kind: 'error', text, field: 'code' });
    }
    if (mode === 'code' && settingPassword && newPassword.length < MIN_PASSWORD) {
      return setMessage({ kind: 'error', text: MESSAGES.weak_password, field: 'newPassword' });
    }
    const result = await run(() =>
      mode === 'password'
        ? client.signInWithPassword(address, password)
        : settingPassword
          ? client.setPassword(address, code, newPassword)
          : client.signInWithCode(address, code),
    );
    if (!result.ok) return setMessage({ kind: 'error', text: MESSAGES[result.error] });
    navigate(returnPathOf(location), { replace: true });
  }

  const submitLabel = mode === 'password' || codeSent ? 'Sign in' : 'Send code';
  const hint =
    mode === 'password'
      ? 'Sign in to keep your cards and search the wider web.'
      : settingPassword
        ? "We'll email you a code, then you choose a new password."
        : `We'll email you a ${CODE_LENGTH}-digit code. No password needed.`;

  return (
    <Page title="Sign in">
      <div className={styles.card} data-scene="night">
        <SignInScene pose={pose} form={form} gazeX={gazeX} />
        <form className={styles.body} onSubmit={submit} noValidate>
          <p className={styles.welcome}>Welcome back</p>
          <p className={styles.hint}>{hint}</p>
          <SegmentedControl
            legend="How to sign in"
            hideLegend
            name="sign-in-method"
            options={MODES}
            value={mode}
            onChange={(next) => switchMode(next)}
          />
          <label className={styles.label} htmlFor="sign-in-email">
            Email
          </label>
          <input
            id="sign-in-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={invalid('email')}
            aria-describedby={describedBy('email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // A code belongs to the address it was sent to.
              if (codeSent) {
                setCodeSent(false);
                setCode('');
              }
            }}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />

          <Collapse open={mode === 'password'}>
            <label className={styles.label} htmlFor="sign-in-password">
              Password
            </label>
            <div className={styles.row}>
              <input
                id="sign-in-password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={invalid('password')}
                aria-describedby={describedBy('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={focusPassword}
                onBlur={blurPassword}
              />
              <ShowButton
                shown={showPassword}
                what="password"
                onFocus={() => setFocused('password')}
                onBlur={blurPassword}
                onToggle={() => {
                  clearTimers();
                  setPeeking(false);
                  setShowPassword((s) => !s);
                }}
              />
            </div>
          </Collapse>

          <Collapse open={mode === 'code' && codeSent}>
            <label className={styles.label} htmlFor="sign-in-code">
              Code from the email
            </label>
            <input
              id="sign-in-code"
              ref={codeRef}
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              placeholder="123456"
              aria-invalid={invalid('code')}
              aria-describedby={describedBy('code', STATUS_ID)}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onFocus={() => setFocused('code')}
              onBlur={() => setFocused(null)}
            />
            <Collapse open={settingPassword}>
              <label className={styles.label} htmlFor="sign-in-new-password">
                New password
              </label>
              <div className={styles.row}>
                <input
                  id="sign-in-new-password"
                  className={styles.input}
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={invalid('newPassword')}
                  aria-describedby={describedBy('newPassword')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setFocused('newPassword')}
                  onBlur={() => setFocused(null)}
                />
                <ShowButton
                  shown={showNew}
                  what="new password"
                  onToggle={() => setShowNew((s) => !s)}
                />
              </div>
              <p className={styles.small}>
                At least {MIN_PASSWORD} characters. Other devices are signed out.
              </p>
            </Collapse>
          </Collapse>

          {/* Two live regions, both always present: errors interrupt, confirmations wait their turn. */}
          <p id={ERROR_ID} className={styles.message} data-kind="error" role="alert">
            {message?.kind === 'error' ? message.text : ''}
          </p>
          <p id={STATUS_ID} className={styles.status} data-kind="ok" role="status">
            {message?.kind === 'ok' ? message.text : ''}
          </p>
          <button type="submit" className={styles.primary} aria-busy={busy}>
            {busy ? 'One moment…' : submitLabel}
          </button>
          <p className={styles.footer}>
            {mode === 'password' ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => switchMode('code', true)}
              >
                Forgot password?
              </button>
            ) : (
              <>
                {codeSent && (
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => !busy && void sendCode(email.trim())}
                  >
                    Send a new code
                  </button>
                )}
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => setSettingPassword((s) => !s)}
                >
                  {settingPassword ? 'Just sign in with the code' : 'Set a new password too'}
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </Page>
  );
}
