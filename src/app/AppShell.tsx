import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { classNames } from '../components/ui/classNames';
import {
  CompassIcon,
  ActivityIcon,
  FolderIcon,
  HeartIcon,
  SearchIcon,
  SettingsIcon,
} from '../components/ui/icons';
import type { AuthClient } from '../services/auth/authClient';
import { AccountMenu } from './AccountMenu';
import { CardReadyToast } from './CardReadyToast';
import styles from './AppShell.module.css';
import { useOnlineStatus } from './useOnlineStatus';
import { useCurationJobs } from './useCurationJobs';

const NAV_ITEMS = [
  { to: '/discover', label: 'Discover', Icon: CompassIcon },
  { to: '/search', label: 'Search', Icon: SearchIcon },
  { to: '/favourites', label: 'Favourites', Icon: HeartIcon },
  { to: '/packs', label: 'Packs', Icon: FolderIcon },
  { to: '/activity', label: 'Activity', Icon: ActivityIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
] as const;

interface AppShellProps {
  children: ReactNode;
  /** Lets tests sign out without a server. */
  authClient?: AuthClient;
}

const inProgress = (count: number) =>
  count === 1 ? '1 card in progress' : `${count} cards in progress`;

export function AppShell({ children, authClient }: AppShellProps) {
  const isOnline = useOnlineStatus();
  // Signing in is the only thing a signed-out visitor can do (D66), so that page has no tabs.
  const onSignIn = useLocation().pathname === '/sign-in';
  const { activeCount } = useCurationJobs();
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/discover" className={styles.wordmark}>
          <img src="/icon.svg" alt="" className={styles.logo} width={32} height={32} />
          <span>
            Pop Culture <span className={styles.wordmarkAccent}>Decoder</span>
          </span>
        </Link>
      </header>
      {/* Outside the header, so a night scene behind it doesn't recolour the menu. */}
      {!onSignIn && (
        <div className={styles.accountBar}>
          <AccountMenu client={authClient} />
        </div>
      )}
      {/* A finished card is announced by the pop-up; the Activity tab shows what's still going. */}
      <CardReadyToast hidden={onSignIn} />
      {!isOnline && (
        <p className={styles.offline} role="status">
          {onSignIn
            ? "You're offline. Connect to the internet to sign in."
            : "You're offline. Everything saved on this device still works."}
        </p>
      )}
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      {!onSignIn && (
        <nav aria-label="Primary" className={styles.nav}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map(({ to, label, Icon }) => {
              const pending = to === '/activity' ? activeCount : 0;
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      classNames(styles.navLink, isActive && styles.active)
                    }
                    aria-label={pending > 0 ? `${label}, ${inProgress(pending)}` : undefined}
                  >
                    <span className={styles.navIcon}>
                      <Icon />
                      {pending > 0 && (
                        <span className={styles.badge} aria-hidden="true">
                          {pending}
                        </span>
                      )}
                    </span>
                    <span>{label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
