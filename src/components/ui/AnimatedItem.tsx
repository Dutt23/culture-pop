import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';

interface AnimatedItemProps {
  /** Position in the list; drives the capped stagger delay. */
  index: number;
  className?: string;
  children: ReactNode;
}

/** List item that enters with the shared `reveal` preset. */
export function AnimatedItem({ index, className, children }: AnimatedItemProps) {
  const { reveal } = useMotionPresets();
  return (
    <motion.li
      className={className}
      variants={reveal}
      custom={index}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.li>
  );
}
