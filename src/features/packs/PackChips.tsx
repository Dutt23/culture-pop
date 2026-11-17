import { Chip } from '../../components/ui/Chip';
import type { Pack } from '../../domain/types';
import styles from './Packs.module.css';
import { packPath } from './usePacks';

interface PackChipsProps {
  /** e.g. "In your packs:". */
  label: string;
  packs: readonly Pack[];
}

/** Which packs a card is filed in, each opening that pack. Nothing at all for a card in no pack. */
export function PackChips({ label, packs }: PackChipsProps) {
  if (packs.length === 0) return null;
  return (
    <div className={styles.chips}>
      <span className={styles.chipsLabel}>{label}</span>
      <ul className={styles.chipList}>
        {packs.map((pack) => (
          <li key={pack.id}>
            <Chip to={packPath(pack.id)}>{pack.name}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
