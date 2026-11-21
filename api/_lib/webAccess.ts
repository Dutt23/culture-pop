import { currentSession, type SessionDeps } from './session.js';
import { createSupabase, supabaseConfig, type Supabase } from './supabase.js';

/**
 * Who may use the wider web (search and card drafts): a signed-in person the owner turned it on
 * for (`app_private.wider_web_access`, docs/SUPABASE_SETUP.md). Checked on every request.
 */
export type WebAccess = 'ok' | 'signed_out' | 'not_allowed' | 'not_configured' | 'unavailable';

export interface WebAccessDeps {
  supabase?: Supabase;
  now?: SessionDeps['now'];
}

export async function checkWebAccess(
  request: Request,
  deps: WebAccessDeps = {},
): Promise<WebAccess> {
  const config = supabaseConfig();
  const supabase = deps.supabase ?? (config && createSupabase(config));
  if (!supabase) return 'not_configured';
  const session = await currentSession(request, { supabase, now: deps.now });
  if (session.kind === 'none') return 'signed_out';
  if (session.kind === 'unavailable') return 'unavailable';
  try {
    const allowed = await supabase.rpc<boolean>('can_search_wider_web', {
      p_user: session.userId,
    });
    return allowed === true ? 'ok' : 'not_allowed';
  } catch {
    return 'unavailable';
  }
}

/** The answer for each refusal, the same from every wider-web endpoint. */
export const WEB_ACCESS_REFUSALS: Record<
  Exclude<WebAccess, 'ok'>,
  { status: number; error: string }
> = {
  signed_out: { status: 401, error: 'signed_out' },
  not_allowed: { status: 403, error: 'not_allowed' },
  not_configured: { status: 503, error: 'not_configured' },
  unavailable: { status: 503, error: 'unavailable' },
};
