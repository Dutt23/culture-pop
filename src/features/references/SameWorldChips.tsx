import { useId } from 'react';
import { rememberOpenPack } from '../../components/reference-card/openPack';
import { Chip } from '../../components/ui/Chip';
import type { RelatedGroup } from '../../domain/related';
import styles from './ReferencePage.module.css';

interface SameWorldChipsProps {
  /** The page's related groups; only the first work ("Also in The Matrix") becomes chips. */
  groups: readonly RelatedGroup[];
  /** The pack this card was opened from, carried along so its spoiler ceiling keeps applying. */
  packId?: string;
}

/** Up to three cards from the same work, one tap away. Library only: never goes online. */
export function SameWorldChips({ groups, packId }: SameWorldChipsProps) {
  const labelId = useId();
  const world = groups.find((group) => group.kind === 'work');
  if (!world) return null;
  return (
    <div className={styles.world}>
      <span id={labelId} className={styles.worldLabel}>
        {world.label}
        <span aria-hidden="true">:</span>
      </span>
      <ul className={styles.worldList} aria-labelledby={labelId}>
        {world.references.map((reference) => (
          <li key={reference.id}>
            <Chip
              to={`/references/${encodeURIComponent(reference.id)}`}
              state={{ packId: packId ?? null }}
              onClick={() => rememberOpenPack(packId)}
            >
              {reference.title}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
