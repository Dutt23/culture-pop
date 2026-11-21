import { useEffect, useState } from 'react';

/** Owner choice (D69): the room's moving drawings rest after 20 s without a touch or scroll. */
export const REST_AFTER_MS = 20_000;

const WAKE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * True once the reader has done nothing for `afterMs`, false again on their next touch, key,
 * wheel or scroll. One timer at a time: an event only notes the time, so a fast scroll costs
 * nothing extra.
 */
export function useResting(afterMs: number = REST_AFTER_MS, enabled = true): boolean {
  const [resting, setResting] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let lastActive = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const quietFor = Date.now() - lastActive;
      if (quietFor >= afterMs) {
        timer = undefined;
        setResting(true);
      } else timer = setTimeout(check, afterMs - quietFor);
    };
    const wake = () => {
      lastActive = Date.now();
      setResting(false);
      timer ??= setTimeout(check, afterMs);
    };
    timer = setTimeout(check, afterMs);
    for (const type of WAKE_EVENTS) {
      window.addEventListener(type, wake, { passive: true, capture: true });
    }
    return () => {
      clearTimeout(timer);
      for (const type of WAKE_EVENTS) {
        window.removeEventListener(type, wake, { capture: true });
      }
      setResting(false);
    };
  }, [afterMs, enabled]);
  return resting;
}
