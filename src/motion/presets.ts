import type { Transition, Variants } from 'motion/react';

/**
 * Central motion vocabulary (Motion for React): `reveal` = enter + stagger + exit, `deal` = a card
 * reaching the screen, `expand`, `sheet` = a modal sheet opening, `tray` = a side tray opening.
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
/** Cards dealt onto Browse: slow enough to notice, one after another along a row. */
const DEAL_DURATION = 0.9;
const DEAL_DISTANCE_PX = 48;
const DEAL_SCALE_FROM = 0.92;
const DEAL_TILT_DEG = -1.5;
const DEAL_STEP = 0.11;

export const MOTION_ATTRIBUTE = 'data-motion';

export interface MotionPresets {
  /** The reader's motion setting (or their device's) asks for less movement. */
  reduced: boolean;
  /** Variants `hidden` → `visible` → `exit`. Pass the item index as `custom` to stagger. */
  reveal: Variants;
  /** Variants `hidden` → `visible` for a card reaching the screen. Pass its column as `custom`. */
  deal: Variants;
  /** Spread onto a motion element inside <AnimatePresence> for height expand/collapse. */
  expand: {
    initial: { height: number; opacity: number };
    animate: { height: 'auto'; opacity: number };
    exit: { height: number; opacity: number };
    transition: Transition;
  };
  /** A modal sheet: slides up from the bottom on a phone, scales in elsewhere. */
  sheet: (phone: boolean) => SheetMotion;
  /** A tray (the account tray): slides in from the right edge and back out. */
  tray: SheetMotion;
}

export interface SheetMotion {
  hidden: { opacity?: number; x?: string; y?: string; scale?: number };
  visible: { opacity: number; x?: number; y?: number; scale?: number };
  transition: Transition;
}

export function createMotionPresets(reduced: boolean): MotionPresets {
  const distance = reduced ? 0 : DISTANCE_PX;
  const scale = reduced ? 1 : SCALE_FROM;
  const duration = reduced ? DURATION_REDUCED : DURATION_BASE;
  const step = reduced ? 0 : STAGGER_STEP;

  return {
    reduced,
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
    deal: {
      hidden: reduced
        ? { opacity: 0 }
        : { opacity: 0, y: DEAL_DISTANCE_PX, scale: DEAL_SCALE_FROM, rotate: DEAL_TILT_DEG },
      visible: (column: number = 0) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        rotate: 0,
        transition: reduced
          ? { duration: DURATION_REDUCED }
          : { duration: DEAL_DURATION, ease: EASE_OUT, delay: column * DEAL_STEP },
      }),
    },
    expand: {
      initial: { height: 0, opacity: 0 },
      animate: { height: 'auto', opacity: 1 },
      exit: { height: 0, opacity: 0 },
      transition: { duration, ease: EASE_OUT },
    },
    sheet: (phone) =>
      reduced
        ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
            transition: { duration: DURATION_REDUCED },
          }
        : {
            hidden: phone ? { y: '100%' } : { opacity: 0, scale: SCALE_FROM },
            visible: { opacity: 1, y: 0, scale: 1 },
            transition: { duration: DURATION_BASE, ease: EASE_OUT },
          },
    tray: reduced
      ? {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
          transition: { duration: DURATION_REDUCED },
        }
      : {
          hidden: { x: '100%' },
          visible: { opacity: 1, x: 0 },
          transition: { duration: DURATION_BASE, ease: EASE_OUT },
        },
  };
}
