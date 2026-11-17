import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { classNames } from './classNames';
import styles from './Chip.module.css';

interface ChipProps {
  children: ReactNode;
  /** Renders a toggle button when set, otherwise a link (requires `to`) or a plain button. */
  selected?: boolean;
  to?: string;
  /** Router state for a link chip. */
  state?: unknown;
  onClick?: () => void;
}

export function Chip({ children, selected, to, state, onClick }: ChipProps) {
  const className = classNames(styles.chip, selected && styles.selected);
  if (to) {
    return (
      <Link to={to} state={state} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}
