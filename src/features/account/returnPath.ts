/** Where to go after signing in, when nothing (or nothing safe) was asked for. */
export const DEFAULT_RETURN = '/discover';

/**
 * Only a path inside this app: never `//host`, `/\host` or a full URL. Control characters are
 * refused too, since browsers drop tabs and newlines from URLs (`/<tab>/host` becomes `//host`).
 */
export function safeReturnPath(from: unknown): string {
  if (typeof from !== 'string') return DEFAULT_RETURN;
  // eslint-disable-next-line no-control-regex
  const unsafe = !/^\/(?![/\\])/.test(from) || /[\\\u0000-\u001f\u007f]/.test(from);
  // Back to the sign-in page itself would leave a signed-in reader on it.
  const signIn = /^\/sign-in(?:[/?#]|$)/.test(from);
  return unsafe || signIn ? DEFAULT_RETURN : from;
}

/**
 * The page a sign-in should return to: `?next=` from the sign-in guard, or `state.from` from an
 * in-app "Sign in" link.
 */
export function returnPathOf(location: { search: string; state: unknown }): string {
  const next =
    new URLSearchParams(location.search).get('next') ??
    (location.state as { from?: unknown } | null)?.from;
  return safeReturnPath(next);
}
