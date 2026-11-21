import { domAnimation, LazyMotion, MotionConfig, useReducedMotion } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import type { MotionPreference } from '../domain/settings';
import { createMotionPresets } from './presets';
import { MotionPresetsContext } from './useMotionPresets';

interface MotionPreferenceProviderProps {
  preference: MotionPreference;
  children: ReactNode;
}

/** Resolves the user's motion setting against the device preference for every Motion element. */
export function MotionPreferenceProvider({ preference, children }: MotionPreferenceProviderProps) {
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = preference === 'reduce' || (preference === 'system' && deviceReduced);
  const presets = useMemo(() => createMotionPresets(reduced), [reduced]);

  // `m` elements with only the animation features the app uses (fades, slides, presence; no layout
  // or drag), instead of the full `motion` bundle.
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
        <MotionPresetsContext.Provider value={presets}>{children}</MotionPresetsContext.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}
