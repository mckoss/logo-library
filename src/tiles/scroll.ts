// Going to another program scrolls the program's letter and the strip:
// the new one comes in as the old one goes, up when going down to a later
// program (`by` 1) and down when going up. Svelte transitions for a
// {#key} block: the old element is laid over the new one where it was,
// out of the page's flow, and both move by the height of the box they're
// in. (Nothing moves for those who'd rather it didn't.)
import { sineInOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

export interface ScrollParams {
  by: number;
  // For the strip: the old one is renamed (so it isn't taken for the
  // strip) and hidden from screen readers.
  rename?: [string, string];
}

const DURATION = 280;
const still = self.matchMedia && self.matchMedia('(prefers-reduced-motion: reduce)').matches;

// (Deferred: Svelte calls the function returned once the old and the new
// are both in place, so the box has its new height.)
function slide(node: Element, by: number, from: number, to: number): () => TransitionConfig {
  return () => {
    if (still || !by) return { duration: 0 };
    const far = (node.parentElement as HTMLElement).clientHeight * by;
    return {
      duration: DURATION,
      easing: sineInOut,
      css: t => `transform: translateY(${(from + (to - from) * t) * far}px)`,
    };
  };
}

export function scrollIn(node: Element, { by }: ScrollParams) {
  return slide(node, by, 1, 0);
}

export function scrollOut(node: Element, { by, rename }: ScrollParams) {
  const el = node as HTMLElement;
  Object.assign(el.style, {
    position: 'absolute', left: el.offsetLeft + 'px', top: el.offsetTop + 'px',
    width: el.offsetWidth + 'px', margin: '0',
  });
  if (rename) el.classList.replace(...rename);
  el.removeAttribute('role');
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  // (An outro's t runs from 1 down to 0.)
  return slide(node, by, -1, 0);
}
