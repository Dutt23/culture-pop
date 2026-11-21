import { createContext, useContext } from 'react';
import { createMotionPresets, type MotionPresets } from './presets';

export const MotionPresetsContext = createContext<MotionPresets>(createMotionPresets(false));

export function useMotionPresets(): MotionPresets {
  return useContext(MotionPresetsContext);
}
