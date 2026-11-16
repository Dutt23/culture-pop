import { classNames } from '../ui/classNames';
import { HeartIcon } from '../ui/icons';
import styles from './FavouriteButton.module.css';

interface FavouriteButtonProps {
  isFavourite: boolean;
  onToggle: () => void;
  /** The accessible name; it should name what is being kept when several buttons share a page. */
  label?: string;
  /** Just the heart, in a square tap target (for cards and lists). The name moves to `aria-label`. */
  iconOnly?: boolean;
}

/** Toggle button: the name stays "Favourite" (or `label`); state is conveyed by aria-pressed. */
export function FavouriteButton({
  isFavourite,
  onToggle,
  label = 'Favourite',
  iconOnly = false,
}: FavouriteButtonProps) {
  return (
    <button
      type="button"
      className={classNames(styles.button, iconOnly && styles.iconOnly)}
      aria-pressed={isFavourite}
      aria-label={iconOnly ? label : undefined}
      onClick={onToggle}
    >
      <HeartIcon filled={isFavourite} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
