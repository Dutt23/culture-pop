import { clearedAccessCookie } from './_lib/access.js';
import { isCrossSite, json } from './_lib/http.js';

/** POST: "Forget access code" in Settings. The cookie is HttpOnly, so only the server can clear it. */
export function POST(request: Request): Response {
  if (isCrossSite(request)) return json(403, { error: 'cross_site' });
  return json(200, { ok: true }, { 'Set-Cookie': clearedAccessCookie() });
}
