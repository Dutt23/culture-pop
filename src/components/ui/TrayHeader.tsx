import styles from './TrayHeader.module.css';

/**
 * A panel's title and its Close button (first used by `SideTray`). Give the dialog or region
 * `aria-labelledby={titleId}` so the title names it.
 */
export interface TrayHeaderProps {
  title: string;
  titleId: string;
  onClose: () => void;
  /** Defaults to "Close". */
  closeLabel?: string;
}

export function TrayHeader({ title, titleId, onClose, closeLabel = 'Close' }: TrayHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <button type="button" className={styles.close} onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}
