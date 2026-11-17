import { useId } from 'react';
import { SearchIcon } from '../../components/ui/icons';
import styles from './Packs.module.css';

interface PackSearchFieldProps {
  /** Also the placeholder, e.g. "Search all packs". */
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Searches packs on this device only; there is nothing to submit and nothing goes online. */
export function PackSearchField({ label, value, onChange }: PackSearchFieldProps) {
  const inputId = useId();
  return (
    <div role="search" aria-label={label} className={styles.field}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <SearchIcon />
      <input
        id={inputId}
        className={styles.input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
      />
    </div>
  );
}
