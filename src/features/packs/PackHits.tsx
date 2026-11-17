import { Link } from 'react-router';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { matchReason, PINNED_LABEL } from '../../domain/labels';
import type { PackHitGroup } from '../../domain/packs';
import type { Pack } from '../../domain/types';
import { PackChips } from './PackChips';
import styles from './Packs.module.css';
import { packPath } from './usePacks';

interface PackHitsProps {
  groups: readonly PackHitGroup[];
  packsByReference: ReadonlyMap<string, Pack[]>;
  query: string;
  /** Cards shown per pack before "N more"; every card when unset. */
  limit?: number;
}

/** Search hits grouped by pack. A pack whose name matched shows even with no matching card. */
export function PackHits({ groups, packsByReference, query, limit = Infinity }: PackHitsProps) {
  return (
    <ul className={styles.groups}>
      {groups.map(({ pack, cards }) => {
        const shown = cards.slice(0, limit);
        const more = cards.length - shown.length;
        return (
          <li key={pack.id} className={styles.group}>
            <div className={styles.groupHeader}>
              <Link to={packPath(pack.id, query)} className={styles.packName}>
                {pack.name}
              </Link>
              {pack.now && <span className={styles.nowChip}>{PINNED_LABEL}</span>}
            </div>
            {shown.length > 0 && (
              <ul className={styles.list}>
                {shown.map((match) => (
                  <li key={match.reference.id} className={styles.card}>
                    <ReferenceCard
                      reference={match.reference}
                      packId={pack.id}
                      matchNote={matchReason(match)}
                    />
                    <PackChips
                      label="Also in:"
                      packs={(packsByReference.get(match.reference.id) ?? []).filter(
                        (other) => other.id !== pack.id,
                      )}
                    />
                  </li>
                ))}
              </ul>
            )}
            {more > 0 && (
              <Link to={packPath(pack.id, query)} className={styles.more}>
                {more} more<span className="sr-only"> in {pack.name}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
