import { useState } from 'react';
import { Lanyard } from '../../components/ui/Lanyard';
import { CEILING_LABEL } from '../../domain/labels';
import type { Pack } from '../../domain/types';
import styles from './Packs.module.css';

/**
 * The pack's backstage pass (owner pick, 2026-11-21): the pack's name and spoiler setting. No
 * holes, numbers or score (D52: a pack is never graded). When every card is got, it's stamped
 * "All access"; getting the last one during this visit swings it down on its lanyard first.
 */
export function PackPass({ pack, done, total }: { pack: Pack; done: number; total: number }) {
  const complete = total > 0 && done >= total;
  const [startedComplete] = useState(complete);
  return (
    <Lanyard
      // A new pass on completion, so the swing plays.
      key={complete ? 'complete' : 'going'}
      className={styles.pass}
      eyebrow="Backstage pass"
      title={pack.name}
      headingLevel="none"
      subtitle={CEILING_LABEL[pack.ceiling]}
      stamp={complete ? 'All access' : undefined}
      swing={complete && !startedComplete}
    />
  );
}
