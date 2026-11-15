import { HeartIcon } from '../ui/icons';
import styles from './FavouriteButton.module.css';

interface FavouriteButtonProps {
  isFavourite: boolean;
  onToggle: () => void;
}

/** Toggle button: the name stays "Favourite"; state is conveyed by aria-pressed. */
export function FavouriteButton({ isFavourite, onToggle }: FavouriteButtonProps) {
  return (
    <button type="button" className={styles.button} aria-pressed={isFavourite} onClick={onToggle}>
      <HeartIcon filled={isFavourite} />
      <span>Favourite</span>
    </button>
  );
}
