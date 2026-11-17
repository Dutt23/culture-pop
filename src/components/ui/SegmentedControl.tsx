import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  /** For a control right under a heading that already says what it is: read, not shown. */
  hideLegend?: boolean;
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className={styles.group}>
      <legend className={hideLegend ? 'sr-only' : styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.text}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
