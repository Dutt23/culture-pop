import { useState } from 'react';
import { Link } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { classNames } from '../../components/ui/classNames';
import { CEILING_LABEL, PINNED_LABEL } from '../../domain/labels';
import type { Pack } from '../../domain/types';
import styles from './Packs.module.css';
import {
  acceptsCard,
  cardCount,
  FROM_PACK_DRAG_TYPE,
  packPath,
  REFERENCE_DRAG_TYPE,
  useAttempt,
} from './usePacks';

interface PackRowProps {
  pack: Pack;
  count: number;
}

/**
 * A pack in a list: opens it, and with a mouse a card dropped on it is filed at its end (moved,
 * when dragged out of another pack, like the Move sheet).
 */
export function PackRow({ pack, count }: PackRowProps) {
  const { packs } = useRepositories();
  const { error, attempt } = useAttempt();
  const [over, setOver] = useState(false);

  return (
    <li
      className={classNames(styles.packRow, over && styles.dropOver)}
      onDragOver={(event) => setOver(acceptsCard(event))}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        if (!acceptsCard(event)) return;
        const referenceId = event.dataTransfer.getData(REFERENCE_DRAG_TYPE);
        const fromPackId = event.dataTransfer.getData(FROM_PACK_DRAG_TYPE) || undefined;
        void attempt(() => packs.fileCard(referenceId, pack.id, Infinity, fromPackId));
      }}
    >
      <Link to={packPath(pack.id)} className={styles.packLink}>
        <span className={styles.packName}>{pack.name}</span>
        <span className={styles.muted}>
          {cardCount(count)} · {CEILING_LABEL[pack.ceiling]}
        </span>
      </Link>
      {pack.now && <span className={styles.nowChip}>{PINNED_LABEL}</span>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
