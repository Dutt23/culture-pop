import { createAuthRoutes } from '../_lib/authHandlers.js';

/**
 * Sign-in API (D64). POST otp { email } · verify { email, code } · password { email, password } ·
 * set-password { email, code, password } · logout. GET session. See api/_lib/authHandlers.ts.
 */
export const { GET, POST } = createAuthRoutes();
