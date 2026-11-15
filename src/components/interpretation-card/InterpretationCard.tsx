import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { PROVENANCE_LABEL } from '../../domain/labels';
import type { Interpretation } from '../../domain/types';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import styles from './InterpretationCard.module.css';

// Real labels can give the plot away, so veiled cards show a neutral one.
const SPOILER_LABEL = 'Spoiler-protected meaning';

interface InterpretationCardProps {
  interpretation: Interpretation;
  index: number;
  /** User setting; spoiler-free is the default. */
  revealSpoilers: boolean;
}

export function InterpretationCard({
  interpretation,
  index,
  revealSpoilers,
}: InterpretationCardProps) {
  const { reveal, expand } = useMotionPresets();
  const [revealedHere, setRevealedHere] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
  const contextId = useId();
  const isSpoiler = interpretation.spoiler === 'major';
  const isHidden = isSpoiler && !revealSpoilers && !revealedHere;

  // The reveal button disappears on tap; hand focus to the content it uncovered.
  useEffect(() => {
    if (revealedHere) summaryRef.current?.focus();
  }, [revealedHere]);

  return (
    <article className={styles.card} aria-labelledby={headingId}>
      <header className={styles.header}>
        <span className={styles.number} aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 id={headingId} className={styles.label}>
          {isHidden ? SPOILER_LABEL : interpretation.label}
        </h3>
        {isSpoiler && <span className={styles.spoilerTag}>Spoiler</span>}
      </header>

      <AnimatePresence mode="popLayout" initial={false}>
        {isHidden ? (
          <motion.div
            key="veil"
            className={styles.veil}
            variants={reveal}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <p>Spoiler ahead — this meaning reveals how the story unfolds.</p>
            <button type="button" className={styles.button} onClick={() => setRevealedHere(true)}>
              Reveal spoiler
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="body"
            className={styles.body}
            variants={reveal}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <p ref={summaryRef} tabIndex={-1} className={styles.summary}>
              {interpretation.summary}
            </p>
            <p className={styles.example}>
              <span className={styles.exampleLabel}>How people use it</span>
              {interpretation.usageExample}
            </p>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={contextOpen}
              aria-controls={contextId}
              onClick={() => setContextOpen((open) => !open)}
            >
              {contextOpen ? 'Less context' : 'More context'}
            </button>
            <div id={contextId} className={styles.contextRegion}>
              <AnimatePresence initial={false}>
                {contextOpen && (
                  <motion.div key="context" className={styles.contextPanel} {...expand}>
                    <p className={styles.context}>{interpretation.context}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className={styles.provenance}>{PROVENANCE_LABEL[interpretation.provenance]}</p>
    </article>
  );
}
