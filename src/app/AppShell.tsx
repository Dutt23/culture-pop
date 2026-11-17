import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { classNames } from '../components/ui/classNames';
import {
  CompassIcon,
  FolderIcon,
  HeartIcon,
  SearchIcon,
  SettingsIcon,
} from '../components/ui/icons';
import styles from './AppShell.module.css';
import { useOnlineStatus } from './useOnlineStatus';

const NAV_ITEMS = [
  { to: '/discover', label: 'Discover', Icon: CompassIcon },
  { to: '/search', label: 'Search', Icon: SearchIcon },
  { to: '/favourites', label: 'Favourites', Icon: HeartIcon },
  { to: '/packs', label: 'Packs', Icon: FolderIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
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
      {!isOnline && (
        <p className={styles.offline} role="status">
          You're offline. Everything saved on this device still works.
        </p>
      )}
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <nav aria-label="Primary" className={styles.nav}>
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) => classNames(styles.navLink, isActive && styles.active)}
              >
                <Icon />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
