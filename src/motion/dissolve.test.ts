import { afterEach, describe, expect, it, vi } from 'vitest';
import { dissolve } from './dissolve';

/** jsdom has no Web Animations: a stand-in that finishes when told to. */
function withAnimate(element: HTMLElement) {
  const finish: (() => void)[] = [];
  const animate = vi.fn(() => {
    let done: () => void = () => {};
    const finished = new Promise<void>((resolve) => (done = resolve));
    finish.push(done);
    return { finished, cancel: vi.fn() } as unknown as Animation;
  });
  // Copies are made with cloneNode, so the stand-in has to live on every element.
  vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(animate);
  return { finishAll: () => finish.forEach((done) => done()), animate, element };
}

function card() {
  const element = document.createElement('div');
  const title = document.createElement('span');
  title.id = 'title';
  title.textContent = 'The snap';
  element.append(title);
  document.body.append(element);
  return element;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('dissolve', () => {
  it('hides the card at once and crumbles copies of it in an overlay that clears itself', async () => {
    HTMLElement.prototype.animate ??= () => ({}) as Animation;
    const { finishAll, animate, element } = withAnimate(card());

    dissolve(element, false);
    expect(element.style.visibility).toBe('hidden');
    const overlay = document.body.lastElementChild as HTMLElement;
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(animate.mock.calls.length).toBeGreaterThan(20);
    // The copies never repeat the card's ids.
    expect(document.querySelectorAll('#title')).toHaveLength(1);

    finishAll();
    await vi.waitFor(() => expect(overlay.isConnected).toBe(false));
  });

  it('fades a single copy with reduced motion', () => {
    HTMLElement.prototype.animate ??= () => ({}) as Animation;
    const { animate, element } = withAnimate(card());
    dissolve(element, true);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('puts the card back when the removal fails', () => {
    HTMLElement.prototype.animate ??= () => ({}) as Animation;
    const { element } = withAnimate(card());
    const dust = dissolve(element, false);
    dust.restore();
    expect(element.style.visibility).toBe('');
    expect(document.body.children).toHaveLength(1);
  });

  it('does nothing where animations are unavailable', () => {
    const element = card();
    const original = HTMLElement.prototype.animate;
    // @ts-expect-error: simulating a browser without Web Animations.
    delete HTMLElement.prototype.animate;
    try {
      dissolve(element, false).restore();
      expect(element.style.visibility).toBe('');
    } finally {
      if (original) HTMLElement.prototype.animate = original;
    }
  });
});
