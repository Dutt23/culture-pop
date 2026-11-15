import { useId } from 'react';
import { SearchIcon } from '../ui/icons';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
}

const SEARCH_LABEL = 'Search references';

export function SearchBar({ value, onChange, onSubmit, autoFocus = false }: SearchBarProps) {
  const inputId = useId();
  return (
    <form
      role="search"
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        {SEARCH_LABEL}
      </label>
      <div className={styles.field}>
        <SearchIcon />
        <input
          id={inputId}
          className={styles.input}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="A quote, meme, show or saying…"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
        />
        <button type="submit" className={styles.submit}>
          Decode
        </button>
      </div>
    </form>
  );
}
