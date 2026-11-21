import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useMotionPresets } from '../../motion/useMotionPresets';

/**
 * The state and moves of the card maker's paper page (PaperPage.tsx): which section shows, and
 * the unfold, turn-over and fold. The moves use Web Animations: under reduced motion, and where
 * there are none (jsdom), each one is skipped and its end state comes at once.
 */

type Move = 'unfold' | 'fold' | 'out' | 'in';

/** Where the page opens out beside the pass; below this it flips down as a flap. */
const BESIDE = '(min-width: 64rem)';
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function keyframes(move: Move, beside: boolean): [Keyframe[], KeyframeAnimationOptions] {
  const shut = beside ? 'rotateY(-178deg)' : 'rotateX(178deg)';
  const over = beside ? 'rotateY(6deg)' : 'rotateX(-6deg)';
  switch (move) {
    case 'unfold':
      return [
        [{ transform: shut }, { transform: over, offset: 0.65 }, { transform: 'none' }],
        { duration: 700, easing: EASE, fill: 'backwards' },
      ];
    case 'fold':
      return [[{ transform: 'none' }, { transform: shut }], { duration: 420, easing: 'ease-in' }];
    // The sheet turns over to its other side.
    case 'out':
      return [
        [
          { transform: 'none', transformOrigin: '50% 50%' },
          { transform: 'rotateY(90deg)', transformOrigin: '50% 50%' },
        ],
        { duration: 220, easing: 'ease-in', fill: 'forwards' },
      ];
    case 'in':
      return [
        [
          { transform: 'rotateY(-90deg)', transformOrigin: '50% 50%' },
          { transform: 'none', transformOrigin: '50% 50%' },
        ],
        { duration: 280, easing: 'ease-out', fill: 'backwards' },
      ];
  }
}

function play(el: HTMLElement | null, move: Move, reduced: boolean): Promise<void> {
  if (!el || reduced || typeof el.animate !== 'function') return Promise.resolve();
  const beside = typeof window.matchMedia === 'function' && window.matchMedia(BESIDE).matches;
  // A held end state (the turn-out stays edge-on) must not outlive its move.
  el.getAnimations?.().forEach((held) => held.cancel());
  const animation = el.animate(...keyframes(move, beside));
  return new Promise((resolve) => {
    animation.onfinish = () => resolve();
    animation.oncancel = () => resolve();
  });
}

export interface PaperPageState<S extends string> {
  /** The section showing, or null while folded away. */
  side: S | null;
  pageRef: RefObject<HTMLElement | null>;
  /** Opens the page on `side` (or turns it over to it); `from` gets focus back on fold. */
  show: (side: S, from?: HTMLElement | null) => void;
  /** Folds it back behind the pass. */
  fold: () => void;
  /** Gone at once, no move: the flow moved to another step. */
  close: () => void;
}

export function usePaperPage<S extends string>(): PaperPageState<S> {
  const { reduced } = useMotionPresets();
  const [side, setSideState] = useState<S | null>(null);
  const [entering, setEntering] = useState<'unfold' | 'in' | null>(null);
  const pageRef = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  // The side as of the last request, ahead of React's render: queued requests read it.
  const current = useRef<S | null>(null);
  // A move is playing: the newest request waits for it, then runs.
  const moving = useRef(false);
  const queued = useRef<(() => void) | null>(null);
  // Bumped by close(): a move still playing then finds its page already gone.
  const generation = useRef(0);
  // Kept true across StrictMode's remount; false once the flow is really gone.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setSide = (next: S | null) => {
    current.current = next;
    setSideState(next);
  };

  /** A move ended: run the request that came in while it played, if any. */
  const settle = () => {
    moving.current = false;
    const next = queued.current;
    queued.current = null;
    next?.();
  };

  // Runs before paint, so the page never flashes open before it unfolds.
  useLayoutEffect(() => {
    if (!entering) return;
    moving.current = true;
    const run = generation.current;
    void play(pageRef.current, entering, reduced).then(() => {
      if (!alive.current || run !== generation.current) return;
      setEntering(null);
      // Settle (refs only): run the request that came in while it played.
      moving.current = false;
      const next = queued.current;
      queued.current = null;
      next?.();
    });
  }, [entering, side, reduced]);

  const show = (target: S, from?: HTMLElement | null) => {
    if (from) opener.current = from;
    if (moving.current) {
      queued.current = () => show(target);
      return;
    }
    if (target === current.current) return;
    if (current.current === null) {
      setSide(target);
      setEntering('unfold');
      return;
    }
    moving.current = true;
    const run = generation.current;
    void play(pageRef.current, 'out', reduced).then(() => {
      if (!alive.current || run !== generation.current) return;
      // Still moving: the turn-in that follows settles it.
      setSide(target);
      setEntering('in');
    });
  };

  const fold = () => {
    if (moving.current) {
      queued.current = fold;
      return;
    }
    if (current.current === null) return;
    moving.current = true;
    const run = generation.current;
    void play(pageRef.current, 'fold', reduced).then(() => {
      if (!alive.current || run !== generation.current) return;
      setSide(null);
      if (opener.current?.isConnected) opener.current.focus();
      settle();
    });
  };

  const close = () => {
    generation.current += 1;
    moving.current = false;
    queued.current = null;
    setEntering(null);
    setSide(null);
  };

  return { side, pageRef, show, fold, close };
}

