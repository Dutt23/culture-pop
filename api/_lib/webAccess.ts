import { currentSession, isSameOriginMutation, type SessionDeps } from './session.js';
import { createSupabase, supabaseConfig, type Supabase, type SupabaseConfig } from './supabase.js';

/**
 * Who may use the wider web (search and card drafts), checked on every request, in this order:
 * from our own pages (Origin + `X-PCD-Request`, like the sign-in endpoints); a signed-in person the
 * owner turned it on for (`app_private.wider_web_access`, docs/SUPABASE_SETUP.md); and one of
 * today's credits, per person and for everyone, counted in Postgres (`bff.take_web_credit`), so
 * no server instance has an allowance of its own.
 */
export type WebAccess =
  | 'ok'
  | 'cross_site'
  | 'signed_out'
  | 'not_allowed'
  | 'daily_cap'
  | 'not_configured'
  | 'unavailable';

/** What one call spends: a wider-web search or a card draft. */
export type WebUsage = 'web_search' | 'card_draft';

export interface WebAccessDeps {
  config?: SupabaseConfig;
  supabase?: Supabase;
  now?: SessionDeps['now'];
}

export async function checkWebAccess(
  request: Request,
  usage: WebUsage,
  deps: WebAccessDeps = {},
): Promise<WebAccess> {
  const config = deps.config ?? supabaseConfig();
  if (!config) return 'not_configured';
  if (!isSameOriginMutation(request, config)) return 'cross_site';
  const supabase = deps.supabase ?? createSupabase(config);
  const session = await currentSession(request, { supabase, now: deps.now });
  if (session.kind === 'none') return 'signed_out';
  if (session.kind === 'unavailable') return 'unavailable';
  try {
    const allowed = await supabase.rpc<boolean>('can_search_wider_web', {
      p_user: session.userId,
    });
    if (allowed !== true) return 'not_allowed';
    const credit = await supabase.rpc<string>('take_web_credit', {
      p_user: session.userId,
      p_kind: usage,
    });
    if (credit === 'ok') return 'ok';
    return credit === 'user_cap' || credit === 'global_cap' ? 'daily_cap' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** The answer for each refusal, the same from every wider-web endpoint. */
export const WEB_ACCESS_REFUSALS: Record<
  Exclude<WebAccess, 'ok'>,
  { status: number; error: string }
> = {
  cross_site: { status: 403, error: 'cross_site' },
  signed_out: { status: 401, error: 'signed_out' },
  not_allowed: { status: 403, error: 'not_allowed' },
  daily_cap: { status: 429, error: 'daily_cap' },
  not_configured: { status: 503, error: 'not_configured' },
  unavailable: { status: 503, error: 'unavailable' },
};
