import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

/**
 * Live: many attempts at the same moment can't get past a shared limit (security review,
 * 2026-11-21). Calls `bff.take_auth_attempt` on the Supabase project in `.env` with a fresh random
 * key, so nobody's real count is touched; daily credits use the same one-statement pattern
 * (`app_private.take_one`), checked here without spending the project's real allowance.
 * Run with `npm run test:e2e:live`, after migration 20261122000100_usage_limits.sql.
 */

const URL = process.env.SUPABASE_URL ?? '';
const SECRET = process.env.SUPABASE_SECRET_KEY ?? '';
if (!URL || !SECRET) {
  throw new Error('Live limits test needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env.');
}

/** The policy default for wrong codes or passwords per email per window. */
const GUESSES_PER_EMAIL = 5;
const AT_ONCE = 40;

test('40 sign-in guesses at the same moment: exactly the limit get through', async ({
  request,
}) => {
  const key = randomBytes(32).toString('hex');
  const answers = await Promise.all(
    Array.from({ length: AT_ONCE }, () =>
      request.post(`${URL}/rest/v1/rpc/take_auth_attempt`, {
        headers: { apikey: SECRET, 'Content-Profile': 'bff', 'Content-Type': 'application/json' },
        data: { p_bucket: 'guess_email', p_key_digest: key },
      }),
    ),
  );
  for (const answer of answers) expect(answer.status()).toBe(200);
  const allowed = (await Promise.all(answers.map((a) => a.json()))).filter((v) => v === true);
  expect(allowed).toHaveLength(GUESSES_PER_EMAIL);
});
