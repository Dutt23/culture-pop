import type { Interpretation } from '../../domain/types';
import styles from './GlanceCard.module.css';

interface GlanceCardProps {
  interpretation: Interpretation;
}

/**
 * The ten-second answer above everything else (Phase 5 re-plan): what it means, what the speaker
 * is doing with it, and a line to say back. Only hand-written lines, all spoiler-free; a line that
 * wasn't written is left out, never made up from the article. The usage example (a situation, not
 * a reply) stays with the full meaning below.
 */
export function GlanceCard({ interpretation }: GlanceCardProps) {
  const { gist, socialMove, reply } = interpretation;
  if (!gist && !socialMove && !reply) return null;
  return (
    <section className={styles.card} aria-labelledby="glance-title">
      <h2 id="glance-title" className="sr-only">
        At a glance
      </h2>
      <dl className={styles.lines}>
        {gist && (
          <div className={styles.line}>
            <dt>Means</dt>
            <dd className={styles.gist}>{gist}</dd>
          </div>
        )}
        {socialMove && (
          <div className={styles.line}>
            <dt>When people say it</dt>
            <dd>{socialMove}</dd>
          </div>
        )}
        {reply && (
          <div className={styles.line}>
            <dt>Say back</dt>
            <dd className={styles.sayBack}>&ldquo;{reply}&rdquo;</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
