import { Chip } from '../../components/ui/Chip';
import type { EraKey, ResultFilter } from '../../domain/discovery';
import { CATEGORY_PLURAL_LABEL, ERA_LABEL } from '../../domain/labels';
import type { Category } from '../../domain/types';
import styles from './SearchPage.module.css';

interface SearchFiltersProps {
  categories: readonly Category[];
  eras: readonly EraKey[];
  value: ResultFilter;
  onChange: (filter: ResultFilter) => void;
}

/** Category and era chips; eras come only from sourced years or editorial labels. */
export function SearchFilters({ categories, eras, value, onChange }: SearchFiltersProps) {
  // An empty box would still take a row, and the page's gap on both sides of it.
  if (categories.length < 2 && eras.length < 2) return null;
  return (
    <div className={styles.filters}>
      {categories.length > 1 && (
        <div className={styles.filterRow} role="group" aria-label="Filter by category">
          <Chip
            selected={value.category === 'all'}
            onClick={() => onChange({ ...value, category: 'all' })}
          >
            All types
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              selected={value.category === c}
              onClick={() => onChange({ ...value, category: c })}
            >
              {CATEGORY_PLURAL_LABEL[c]}
            </Chip>
          ))}
        </div>
      )}
      {eras.length > 1 && (
        <div className={styles.filterRow} role="group" aria-label="Filter by era">
          <Chip selected={value.era === 'all'} onClick={() => onChange({ ...value, era: 'all' })}>
            Any time
          </Chip>
          {eras.map((e) => (
            <Chip key={e} selected={value.era === e} onClick={() => onChange({ ...value, era: e })}>
              {ERA_LABEL[e]}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
