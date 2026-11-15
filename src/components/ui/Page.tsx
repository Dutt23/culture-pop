import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './Page.module.css';

interface PageProps {
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  children?: ReactNode;
}

export function Page({ title, eyebrow, intro, children }: PageProps) {
  const { reveal } = useMotionPresets();
  return (
    <div className={styles.page}>
      <motion.header className={styles.header} variants={reveal} initial="hidden" animate="visible">
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {intro && <div className={styles.intro}>{intro}</div>}
      </motion.header>
      {children}
    </div>
  );
}
