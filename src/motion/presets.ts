import type { Transition, Variants } from 'motion/react';

/**
 * Central motion vocabulary (Motion for React): `reveal` = enter + stagger + exit, `expand`.
 * `reduced` swaps every value for a short, transform-free fade. CSS micro-interactions
 * (hover, press, ambient drift) use the matching tokens in design/tokens.css.
 */
const DURATION_BASE = 0.32;
const DURATION_EXIT = 0.14;
const DURATION_REDUCED = 0.12;
const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const DISTANCE_PX = 14;
const SCALE_FROM = 0.97;
const STAGGER_STEP = 0.055;
const STAGGER_MAX_ITEMS = 8;

export const MOTION_ATTRIBUTE = 'data-motion';

export interface MotionPresets {
  /** Variants `hidden` → `visible` → `exit`. Pass the item index as `custom` to stagger. */
  reveal: Variants;
  /** Spread onto a motion element inside <AnimatePresence> for height expand/collapse. */
  expand: {
    initial: { height: number; opacity: number };
    animate: { height: 'auto'; opacity: number };
    exit: { height: number; opacity: number };
    transition: Transition;
  };
}

export function createMotionPresets(reduced: boolean): MotionPresets {
  const distance = reduced ? 0 : DISTANCE_PX;
  const scale = reduced ? 1 : SCALE_FROM;
  const duration = reduced ? DURATION_REDUCED : DURATION_BASE;
  const step = reduced ? 0 : STAGGER_STEP;

  return {
    reveal: {
      hidden: { opacity: 0, y: distance, scale },
      visible: (index: number = 0) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration, ease: EASE_OUT, delay: Math.min(index, STAGGER_MAX_ITEMS) * step },
      }),
      exit: {
        opacity: 0,
        y: -distance,
        scale,
        transition: { duration: reduced ? DURATION_REDUCED : DURATION_EXIT, ease: EASE_OUT },
      },
    },
    expand: {
      initial: { height: 0, opacity: 0 },
      animate: { height: 'auto', opacity: 1 },
      exit: { height: 0, opacity: 0 },
      transition: { duration, ease: EASE_OUT },
    },
  };
}
