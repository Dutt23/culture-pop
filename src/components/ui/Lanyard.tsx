import { m } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { useMotionPresets } from '../../motion/useMotionPresets';
import { classNames } from './classNames';
import styles from './Lanyard.module.css';

/**
 * A backstage pass on a lanyard (owner, 2026-11-21: "modernise the app ... reusable component").
 * Everything comes in through props: a title, optional eyebrow, subtitle, avatar, tags, progress
 * (one punched hole per step), a stamp and actions. With `swing` it drops in on its strap the
 * first time it shows, and lifts away when it leaves inside <AnimatePresence>; reduced motion: it
 * simply appears. Use it alone, or as an item in `Collection` with `variant="lanyards"`.
 *
 * With `children` the pass holds a whole panel (the card maker, owner 2026-11-22): the head stays
 * put and the children scroll inside the pass. Cap the pass's height with `className`; set
 * `--lanyard-body-inset` to keep focused fields clear of anything pinned at the body's bottom.
 */

export type LanyardTone = 'accent' | 'success' | 'warm' | 'quiet';

export interface LanyardTag {
  label: string;
  tone?: LanyardTone;
}

export interface LanyardProgress {
  done: number;
  total: number;
  /** Read out instead of "3 of 5 done". */
  label?: string;
}

export interface LanyardProps {
  title: string;
  /** Small line above the title, e.g. "Backstage pass". */
  eyebrow?: string;
  subtitle?: ReactNode;
  /** Top left of the pass: an initial, a mascot, an image. Decorative unless named. */
  avatar?: ReactNode;
  tags?: readonly LanyardTag[];
  progress?: LanyardProgress;
  /** Stamped across the pass, e.g. "All access". */
  stamp?: string;
  /** Buttons or links along the bottom. */
  actions?: ReactNode;
  /** Top right of the head, e.g. a Close button. */
  corner?: ReactNode;
  /** A panel inside the pass, under the head; it scrolls on its own. */
  children?: ReactNode;
  /** Drops in on its strap when it first shows. */
  swing?: boolean;
  /**
   * Heading level of the title in the page outline (default 3); 'none' when the page already has
   * a heading saying the same.
   */
  headingLevel?: 2 | 3 | 4 | 'none';
  className?: string;
}

/** More holes than this don't fit across a pass; the count still says the rest. */
const MAX_HOLES = 10;

const SWING = {
  initial: { y: '-60%', rotate: 0, opacity: 0 },
  animate: { y: '0%', rotate: [7, -4, 2, 0], opacity: 1 },
  transition: { type: 'tween' as const, duration: 0.9, ease: 'easeOut' as const },
  exit: { y: '-60%', opacity: 0, transition: { duration: 0.3, ease: 'easeIn' as const } },
};

export function Lanyard({
  title,
  eyebrow,
  subtitle,
  avatar,
  tags,
  progress,
  stamp,
  actions,
  corner,
  children,
  swing = false,
  headingLevel = 3,
  className,
}: LanyardProps) {
  const { reduced } = useMotionPresets();
  const titleId = useId();
  const Heading = headingLevel === 'none' ? 'p' : (`h${headingLevel}` as const);
  const total = progress ? Math.max(0, Math.floor(progress.total)) : 0;
  const done = progress ? Math.min(total, Math.max(0, Math.floor(progress.done))) : 0;
  const holes = Math.min(total, MAX_HOLES);
  // Past MAX_HOLES each hole stands for a share of the steps.
  const filled = total > MAX_HOLES ? Math.round((done / total) * holes) : done;
  const motion = swing && !reduced ? SWING : {};

  return (
    <m.article
      className={classNames(styles.lanyard, className)}
      aria-labelledby={titleId}
      data-complete={progress && total > 0 && done === total ? '' : undefined}
      data-panel={children ? '' : undefined}
      {...motion}
    >
      <span className={styles.strap} aria-hidden="true" />
      <div className={styles.pass}>
        <span className={styles.slot} aria-hidden="true" />
        <div className={styles.head}>
          {avatar && <div className={styles.avatar}>{avatar}</div>}
          <div className={styles.names}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <Heading id={titleId} className={styles.title}>
              {title}
            </Heading>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {corner && <div className={styles.corner}>{corner}</div>}
        </div>
        {tags && tags.length > 0 && (
          <ul className={styles.tags}>
            {tags.map((tag) => (
              <li key={tag.label} className={styles.tag} data-tone={tag.tone ?? 'quiet'}>
                {tag.label}
              </li>
            ))}
          </ul>
        )}
        {progress && total > 0 && (
          <div className={styles.progress}>
            <span className={styles.holes} aria-hidden="true">
              {Array.from({ length: holes }, (_, i) => (
                <span key={i} className={styles.hole} data-punched={i < filled ? '' : undefined} />
              ))}
            </span>
            <span className={styles.count}>{progress.label ?? `${done} of ${total} done`}</span>
          </div>
        )}
        {children && <div className={styles.body}>{children}</div>}
        {stamp && <p className={styles.stamp}>{stamp}</p>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </m.article>
  );
}
