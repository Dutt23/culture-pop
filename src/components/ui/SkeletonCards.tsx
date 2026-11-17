import styles from './SkeletonCards.module.css';

/** Grey card shapes holding the space results will fill, so the page doesn't jump as they land. */
export function SkeletonCards({ count }: { count: number }) {
  return (
    <ul className={styles.list} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={styles.card}>
          <span className={styles.line} />
          <span className={`${styles.line} ${styles.short}`} />
        </li>
      ))}
    </ul>
  );
}
