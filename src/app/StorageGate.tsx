import { useEffect, useState, type ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { describeStorageError } from '../domain/storageErrors';
import styles from './StorageGate.module.css';

type OpenState = { status: 'opening' } | { status: 'ready' } | { status: 'error'; message: string };

interface StorageGateProps {
  db: PopCultureDb;
  children: ReactNode;
}

/** Opens IndexedDB before rendering the app and explains failures in plain language. */
export function StorageGate({ db, children }: StorageGateProps) {
  const [state, setState] = useState<OpenState>({ status: 'opening' });

  useEffect(() => {
    let active = true;
    db.open().then(
      () => active && setState({ status: 'ready' }),
      (error: unknown) =>
        active && setState({ status: 'error', message: describeStorageError(error) }),
    );
    return () => {
      active = false;
    };
  }, [db]);

  if (state.status === 'ready') return <>{children}</>;
  if (state.status === 'opening') {
    return (
      <p className={styles.message} role="status">
        Opening your library…
      </p>
    );
  }
  return (
    <div className={styles.error} role="alert">
      <h1 className={styles.title}>Your library couldn't open</h1>
      <p>{state.message}</p>
      <button type="button" className={styles.button} onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
