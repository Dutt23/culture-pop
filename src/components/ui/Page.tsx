import { m } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './Page.module.css';

const APP_NAME = 'Pop Culture Decoder';

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
  const { key, pathname } = useLocation();
  const navigation = useNavigationType();
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The tab's name is the first thing a screen reader says after a page change.
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
  // After moving to another page (not on first load or a redirect), start at its name, unless the
  // page already put focus somewhere of its own, like the search box.
  useEffect(() => {
    if (key === 'default' || navigation === 'REPLACE') return;
    if (document.getElementById('main')?.contains(document.activeElement)) return;
    titleRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page, not per URL change
  }, [pathname]);
  const top = (
    <>
      <m.header className={styles.header} variants={reveal} initial="hidden" animate="visible">
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        {/* Focusable by script only: focus lands here when the control that had it disappears. */}
        <h1 ref={titleRef} className={styles.title} tabIndex={-1}>
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
