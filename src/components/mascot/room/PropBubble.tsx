import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { classNames } from '../../ui/classNames';
import { Mascot } from '../Mascot';
import { ROOM_PROPS, type RoomPropId } from './roomProps';
import styles from './PropBubble.module.css';

interface PropBubbleProps {
  id: RoomPropId;
  still: boolean;
  onClose: () => void;
}

/**
 * The mascot pops up at the bottom of the screen and says what one prop references. Not modal:
 * the page stays usable. "Got it" or Escape closes it. Rendered on the body, because the page's
 * frame would otherwise hold it in place instead of the screen.
 */
export function PropBubble({ id, still, onClose }: PropBubbleProps) {
  const titleId = useId();
  const lineId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  const { title, line } = ROOM_PROPS[id];

  useEffect(() => {
    doneRef.current?.focus();
  }, [id]);

  return createPortal(
    <section
      className={classNames(styles.bubble, still && styles.still)}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={lineId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      {/* Keyed by the prop, so the mascot hops up again for each new one. */}
      <div key={id} className={styles.mascot}>
        <Mascot costume="plain" size={56} />
      </div>
      <div className={styles.card}>
        <p id={titleId} className={styles.title}>
          {title}
        </p>
        <p id={lineId} className={styles.line}>
          {line}
        </p>
        <div className={styles.controls}>
          <button ref={doneRef} type="button" className={styles.done} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </section>,
    document.body,
  );
}
