const FLY_MS = 560;
const SPIN_MS = 700;

/** A modal dialog sits in the top layer and covers the body: a flight from inside it stays in it. */
const layerOf = (from: Element): Element => from.closest('dialog') ?? document.body;

/** Spins the tray's reel by `deg` (negative winds it back). */
export function spinReel(reel: Element | null, deg: number): void {
  if (!reel || typeof reel.animate !== 'function') return; // jsdom has no Web Animations
  reel.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${deg}deg)` }], {
    duration: SPIN_MS,
    easing: 'cubic-bezier(.2,.8,.3,1)',
  });
}

/**
 * Flies a small copy of `from` into the reel, then spins it. `round` is a filter's lens (a disc of
 * `colour`); otherwise a frame (outlined in `colour`). Callers skip this under reduced motion.
 */
export function flyToReel(
  from: Element,
  reel: Element | null,
  { round = false, colour }: { round?: boolean; colour: string },
): void {
  if (!reel || typeof from.animate !== 'function') return;
  const s = from.getBoundingClientRect();
  const t = reel.getBoundingClientRect();
  const clone = document.createElement('div');
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${s.left}px`,
    top: `${s.top}px`,
    width: `${s.width}px`,
    height: `${s.height}px`,
    zIndex: '9',
    pointerEvents: 'none',
    borderRadius: round ? '50%' : '4px',
    background: round ? colour : '#3a2f7a',
    border: round ? 'none' : `1px solid ${colour}`,
  });
  layerOf(from).append(clone);
  const dx = t.left + t.width / 2 - s.left - s.width / 2;
  const dy = t.top + t.height / 2 - s.top - s.height / 2;
  const flight = clone.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 0.95 },
      {
        transform: `translate(${dx}px,${dy}px) scale(.1) rotate(${round ? 0 : -25}deg)`,
        opacity: 0.4,
      },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(.3,.7,.3,1)' },
  );
  flight.onfinish = () => {
    clone.remove();
    spinReel(reel, round ? 360 : 240);
  };
  flight.oncancel = () => clone.remove();
}

/** With no target on screen, a kept card flies this far up and away. */
const LIBRARY_FALLBACK_PX = -340;

/**
 * Flies a copy of a kept card into `target` (the library link) or up and away. The caller keeps the
 * returned flight to cancel it on unmount; the copy is removed on finish and on cancel.
 */
export function flyToLibrary(
  from: Element,
  target: Element | null,
  colour: string,
): Animation | undefined {
  if (typeof from.animate !== 'function') return undefined;
  const s = from.getBoundingClientRect();
  const layer = layerOf(from);
  // A target under the dialog can't be seen, so the card flies up and away instead.
  const t = target && layer.contains(target) ? target.getBoundingClientRect() : undefined;
  const clone = document.createElement('div');
  clone.setAttribute('aria-hidden', 'true');
  clone.dataset.flight = 'library';
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${s.left}px`,
    top: `${s.top}px`,
    width: `${s.width}px`,
    height: `${s.height}px`,
    zIndex: '9',
    pointerEvents: 'none',
    borderRadius: '16px',
    background: '#221d4a',
    border: `2px solid ${colour}`,
  });
  layer.append(clone);
  const dx = t ? t.left + t.width / 2 - s.left - s.width / 2 : 0;
  const dy = t ? t.top + t.height / 2 - s.top - s.height / 2 : LIBRARY_FALLBACK_PX;
  const flight = clone.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(.1) rotate(-8deg)`, opacity: 0.3 },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(.3,.7,.3,1)' },
  );
  flight.onfinish = () => clone.remove();
  flight.oncancel = () => clone.remove();
  return flight;
}
