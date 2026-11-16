import { AnimatePresence, m } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { PROVENANCE_LABEL } from '../../domain/labels';
import type { Interpretation, Source } from '../../domain/types';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { ExternalAnchor } from '../ui/ExternalAnchor';
import { safeHref } from '../ui/safeHref';
import styles from './InterpretationCard.module.css';

// Real labels can give the plot away, so veiled cards show a neutral one.
const SPOILER_LABEL = 'Spoiler-protected meaning';

interface InterpretationCardProps {
  interpretation: Interpretation;
  index: number;
  /** User setting; spoiler-free is the default. */
  revealSpoilers: boolean;
  /** The sources this interpretation cites, shown as links under it. */
  citations?: readonly Source[];
}

export function InterpretationCard({
  interpretation,
  index,
  revealSpoilers,
  citations = [],
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
          <m.div
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
          </m.div>
        ) : (
          <m.div
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
            {/* Curated-from-source meanings have no example or context unless a source gives one. */}
            {interpretation.usageExample && (
              <p className={styles.example}>
                <span className={styles.exampleLabel}>How people use it</span>
                {interpretation.usageExample}
              </p>
            )}
            {interpretation.context && (
              <>
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
                      <m.div key="context" className={styles.contextPanel} {...expand}>
                        <p className={styles.context}>{interpretation.context}</p>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {citations.length > 0 && (
        <p className={styles.citations}>
          Cites:{' '}
          {citations.map((source, i) => {
            const name = `${source.publisher}: ${source.title}`;
            return (
              <span key={source.id}>
                {i > 0 && ', '}
                {/* An unsafe URL keeps the citation as plain text. */}
                {safeHref(source.url) ? (
                  <ExternalAnchor href={source.url}>{name}</ExternalAnchor>
                ) : (
                  name
                )}
              </span>
            );
          })}
        </p>
      )}
      <p className={styles.provenance}>{PROVENANCE_LABEL[interpretation.provenance]}</p>
    </article>
  );
}
