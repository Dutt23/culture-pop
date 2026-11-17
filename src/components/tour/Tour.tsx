import { useEffect, useRef, useState } from 'react';
import { Mascot } from '../mascot/Mascot';
import styles from './Tour.module.css';

export interface TourStep {
  /** The `data-tour` value of the element this step points at; none for a general step. */
  target?: string;
  text: string;
}

export const TOUR_ATTRIBUTE = 'data-tour';
const ACTIVE_ATTRIBUTE = 'data-tour-active';

interface TourProps {
  steps: readonly TourStep[];
  onClose: () => void;
}

/**
 * The mascot explains a page one step at a time, outlining the part each step is about. Not modal:
 * the page stays usable underneath. Escape, Skip or Done ends it.
 */
export function Tour({ steps, onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!step.target) return;
    const element = document.querySelector<HTMLElement>(`[${TOUR_ATTRIBUTE}="${step.target}"]`);
    if (!element) return;
    element.setAttribute(ACTIVE_ATTRIBUTE, '');
    // jsdom has no scrolling.
    element.scrollIntoView?.({ block: 'center' });
    return () => element.removeAttribute(ACTIVE_ATTRIBUTE);
  }, [step.target]);

  return (
    <section
      className={styles.tour}
      role="dialog"
      aria-label="Tour"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <Mascot costume="plain" size={56} />
      <div className={styles.bubble}>
        <p className={styles.text} aria-live="polite">
          {step.text}
        </p>
        <div className={styles.controls}>
          <span className={styles.count}>
            {index + 1} of {steps.length}
          </span>
          {!last && (
            <button type="button" className={styles.quiet} onClick={onClose}>
              Skip
            </button>
          )}
          {index > 0 && (
            <button type="button" className={styles.quiet} onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className={styles.next}
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </section>
  );
}
