import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './Page.module.css';

interface PageProps {
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  /** A browsing page (cards, lists) that uses the full width on big screens. */
  wide?: boolean;
  /** A decorative picture above the title. */
  scene?: ReactNode;
  children?: ReactNode;
}

export function Page({ title, eyebrow, intro, wide = false, scene, children }: PageProps) {
  const { reveal } = useMotionPresets();
  return (
    <div className={wide ? `${styles.page} ${styles.wide}` : styles.page}>
      {scene}
      <m.header className={styles.header} variants={reveal} initial="hidden" animate="visible">
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        {/* Focusable by script only: focus lands here when the control that had it disappears. */}
        <h1 className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        {intro && <div className={styles.intro}>{intro}</div>}
      </m.header>
      {children}
    </div>
  );
}
