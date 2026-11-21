import { useOutletContext } from 'react-router';
import type { AccountSession } from '../services/auth/authClient';

/**
 * The wider web (search and card drafts) is turned on for this account (D65), from the sign-in
 * check `RequireSignIn` makes on every page (its Outlet context). False until the server has said so
 * and outside those pages: nothing about the wider web is shown then. The server still checks every
 * paid call.
 */
export function useWiderWebAllowed(): boolean {
  return useOutletContext<AccountSession | undefined>()?.widerWeb === true;
}
