import { useId, useState, type FormEvent } from 'react';
import { Chip } from '../../components/ui/Chip';
import { CATEGORY_PLURAL_LABEL } from '../../domain/labels';
import {
  hasActiveTags,
  MAX_CUSTOM_TAGS,
  MAX_TAG_CHARS,
  TYPE_TAGS,
  type AddTagResult,
} from '../../domain/searchTags';
import styles from './SearchTags.module.css';
import type { SearchTagsControls } from './useSearchTags';

interface SearchTagsProps {
  tags: SearchTagsControls;
  /** "Only these": offered after a search while a tag is on; not remembered. */
  onlyThese?: { value: boolean; onChange: (value: boolean) => void };
}

const ADD_ERROR: Readonly<Record<Exclude<AddTagResult, { ok: true }>['reason'], string>> = {
  invalid: `Use 2 to ${MAX_TAG_CHARS} letters, numbers or spaces.`,
  duplicate: 'You already have that tag.',
  full: `You can keep up to ${MAX_CUSTOM_TAGS} tags. Remove one first.`,
};

/**
 * One row of tags under the search box: types and the reader's own tags. Tags lift matching
 * results and never hide them; only "Only these" hides the rest.
 */
export function SearchTags({ tags, onlyThese }: SearchTagsProps) {
  const { state } = tags;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  // Shown once stored tags are read, so no tap is lost or saved over them.
  if (!tags.loaded) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = tags.add(draft);
    if (!result.ok) {
      setError(ADD_ERROR[result.reason]);
      return;
    }
    setDraft('');
    setError(null);
    setAdding(false);
  };

  return (
    <div className={styles.tags}>
      <div className={styles.row} role="group" aria-label="Search tags: lift matching results">
        {TYPE_TAGS.map((type) => (
          <Chip
            key={type}
            selected={state.types.includes(type)}
            onClick={() => tags.toggleType(type)}
          >
            {CATEGORY_PLURAL_LABEL[type]}
          </Chip>
        ))}
        {state.custom.map((tag) => (
          <span key={tag.text} className={styles.custom}>
            <Chip selected={tag.on} onClick={() => tags.toggleCustom(tag.text)}>
              {tag.text}
            </Chip>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove tag ${tag.text}`}
              onClick={() => tags.remove(tag.text)}
            >
              ×
            </button>
          </span>
        ))}
        {!adding && (
          <Chip onClick={() => setAdding(true)}>
            <span aria-hidden="true">+&nbsp;</span>Add tag
          </Chip>
        )}
        {onlyThese && hasActiveTags(state) && (
          <Chip selected={onlyThese.value} onClick={() => onlyThese.onChange(!onlyThese.value)}>
            Only these
          </Chip>
        )}
      </div>
      {adding && (
        <form className={styles.add} onSubmit={submit}>
          <label htmlFor={inputId} className="sr-only">
            New tag
          </label>
          <input
            id={inputId}
            className={styles.input}
            value={draft}
            maxLength={MAX_TAG_CHARS}
            placeholder="A tag, like Marvel"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={error !== null}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(event) => setDraft(event.target.value)}
            // A new tag is the reader's own word; keep the field open until they add or cancel.
            autoFocus
          />
          <button type="submit" className={styles.button}>
            Add
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => {
              setAdding(false);
              setDraft('');
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {error && (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {tags.saveFailed && (
        <p className={styles.error} role="alert">
          Couldn&rsquo;t save your tags. Please try again.
        </p>
      )}
    </div>
  );
}
