import type { Dispatch, SetStateAction } from 'react';
import type { Frame } from './frames';
import styles from './drafts.module.css';

interface ReconsiderSourcesProps {
  picked: readonly Frame[];
  /** Why the AI left a pick out, by frame key. */
  issues: Record<string, string>;
  preserveKeys: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
}

/** After a partial draft: tick the left-out sources the retry should consider again. */
export function ReconsiderSources(props: ReconsiderSourcesProps) {
  const { picked, issues, preserveKeys, onChange } = props;
  if (Object.keys(issues).length === 0) return null;
  return (
    <fieldset className={styles.sheet}>
      <legend>Reconsider omitted sources</legend>
      {picked
        .filter((frame) => issues[frame.key])
        .map((frame) => (
          <label key={frame.key}>
            <input
              type="checkbox"
              checked={preserveKeys.includes(frame.key)}
              onChange={(event) =>
                onChange((keys) =>
                  event.target.checked
                    ? [...keys, frame.key]
                    : keys.filter((key) => key !== frame.key),
                )
              }
            />
            {frame.title} · {issues[frame.key]}
          </label>
        ))}
      <p className={styles.note}>
        Retry considers checked sources again. Unsupported claims remain excluded and explained.
      </p>
    </fieldset>
  );
}
