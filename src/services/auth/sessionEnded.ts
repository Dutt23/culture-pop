/**
 * Our server answered 401 on an `/api` call: the sign-in ended mid-use (expired, revoked, or signed
 * out on another device). The sign-in guard listens and sends the reader to sign in at once (D66).
 */
const SESSION_ENDED = 'pcd:session-ended';

export function reportSessionEnded(): void {
  window.dispatchEvent(new Event(SESSION_ENDED));
}

export function onSessionEnded(listener: () => void): () => void {
  window.addEventListener(SESSION_ENDED, listener);
  return () => window.removeEventListener(SESSION_ENDED, listener);
}
