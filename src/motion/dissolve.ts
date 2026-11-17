/**
 * The snap: a card crumbles into dust, left to right, when it leaves a list. It animates copies of
 * the card in an overlay of its own, so the card itself can be removed at once; the dust finishes
 * by itself. With reduced motion the copy only fades.
 */
export interface Dust {
  /** The removal failed: show the card again. */
  restore: () => void;
}

const COLUMNS = 10;
const ROWS = 6;
const TILE_MS = 900;
/** How long the crumbling takes to cross the card, left to right. */
const SWEEP_MS = 650;
const JITTER_MS = 220;
const FADE_MS = 200;

const NO_DUST: Dust = { restore: () => {} };

export function dissolve(element: HTMLElement | null | undefined, reduced: boolean): Dust {
  // jsdom has no Web Animations: nothing to show, and nothing to hide.
  if (!element || typeof element.animate !== 'function') return NO_DUST;

  const rect = element.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  // Not reachable by Tab either: the copies keep the card's links and buttons.
  overlay.inert = true;
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none',
    zIndex: '950',
  });

  const copy = (clip?: string) => {
    const clone = element.cloneNode(true) as HTMLElement;
    // Copies are pictures of the card, never a second set of its ids, links and buttons.
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    Object.assign(clone.style, {
      position: 'absolute',
      inset: '0',
      margin: '0',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      clipPath: clip ?? 'none',
    });
    overlay.append(clone);
    return clone;
  };

  const animations: Animation[] = [];
  if (reduced) {
    animations.push(
      copy().animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, fill: 'forwards' }),
    );
  } else {
    const width = rect.width / COLUMNS;
    const height = rect.height / ROWS;
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const left = column * width;
        const top = row * height;
        // A hair of overlap so no seams show before the tiles move.
        const tile = copy(
          `inset(${top}px ${rect.width - left - width - 0.5}px ${rect.height - top - height - 0.5}px ${left}px)`,
        );
        const dx = 30 + Math.random() * 70;
        const dy = -(20 + Math.random() * 60);
        const turn = (Math.random() - 0.5) * 60;
        animations.push(
          tile.animate(
            [
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
              {
                transform: `translate(${dx * 0.4}px, ${dy * 0.4}px) rotate(${turn / 2}deg)`,
                opacity: 0.8,
                offset: 0.4,
              },
              { transform: `translate(${dx}px, ${dy}px) rotate(${turn}deg)`, opacity: 0 },
            ],
            {
              duration: TILE_MS,
              delay: (column / COLUMNS) * SWEEP_MS + Math.random() * JITTER_MS,
              easing: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
              fill: 'both',
            },
          ),
        );
      }
    }
  }

  document.body.append(overlay);
  const previousVisibility = element.style.visibility;
  element.style.visibility = 'hidden';
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(() =>
    overlay.remove(),
  );

  return {
    restore: () => {
      animations.forEach((animation) => animation.cancel());
      overlay.remove();
      if (element.isConnected) element.style.visibility = previousVisibility;
    },
  };
}
