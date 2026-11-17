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
  /** Shown right under the title, and inside the scene with it (e.g. a search bar). */
  lead?: ReactNode;
  /** Wraps the title and `lead` in a scene, e.g. the mascot's room. */
  scene?: (top: ReactNode) => ReactNode;
  children?: ReactNode;
}

export function Page({ title, eyebrow, intro, wide = false, lead, scene, children }: PageProps) {
  const { reveal } = useMotionPresets();
  const top = (
    <>
      <m.header className={styles.header} variants={reveal} initial="hidden" animate="visible">
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        {/* Focusable by script only: focus lands here when the control that had it disappears. */}
        <h1 className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        {intro && <div className={styles.intro}>{intro}</div>}
      </m.header>
      {lead}
    </>
  );
  return (
    <div className={wide ? `${styles.page} ${styles.wide}` : styles.page}>
      {scene ? scene(top) : top}
      {children}
    </div>
  );
}
