/**
 * The aperture shutter's transition.
 *
 * A round iris: the ground, masked by a hole whose radius is the one number the
 * animation drives. (It was six rotating half-planes first, which made a
 * hexagonal opening — true to the blades in the icon, but Karen wanted the
 * circle, so the shape of the opening and the shape of the button now say
 * different things on purpose.)
 *
 * Deliberately not Astro's View Transitions. Every page here bootstraps with a
 * plain module script that runs once on load — the theme typing, the print egg,
 * the darkroom itself — and turning on client-side navigation would silently
 * stop all of them on the second page. So the iris closes over the landing
 * page, the browser navigates the way it always has, and the work page plays
 * the opening half off a sessionStorage flag.
 */

declare global {
  interface Window {
    /** Raised by MainLayout's inline guard when the visitor came in through the shutter. */
    __dkArrive?: boolean;
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Set as the landing page leaves; read exactly once by the page that arrives. */
export const ARRIVE_KEY = 'dk:shutter';

const CLOSE_MS = 440;
const OPEN_MS = 560;
/** The iris must never outlive the navigation it was drawn for. */
const STRAND_MS = 2600;

/** A restore from bfcache brings the closed shutter back with the page. */
window.addEventListener('pageshow', (e) => {
  if (e.persisted) document.querySelectorAll('.dk-iris').forEach((n) => n.remove());
});

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Iris {
  /** Hole radius at which the opening clears the furthest corner. */
  max: number;
  /** 0 is shut; `max` is wide open. */
  set(r: number): void;
  mount(): void;
  destroy(): void;
}

function makeIris(): Iris {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Half the diagonal: the distance from the middle of the screen to a corner,
  // so at `max` the opening has cleared the last of the page.
  const max = Math.hypot(w, h) / 2;
  const span = max * 2;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'dk-iris');
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
  // slice, not none: a resize mid-animation would otherwise stretch the hole
  // into an ellipse, which is a worse tell than a little overscan.
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;z-index:9995;pointer-events:none';

  // The ground is read, not hardcoded: one overlay then serves both themes and
  // both pages, and it can't drift from whatever the page is actually painted
  // on the way a second copy of the palette would.
  const ground = getComputedStyle(document.body).backgroundColor;

  // Unique per overlay — two could briefly coexist if a press landed during an
  // arrival, and a duplicate id would have them masking each other.
  const maskId = `dk-iris-${Math.random().toString(36).slice(2, 9)}`;

  const mask = document.createElementNS(SVG_NS, 'mask');
  mask.setAttribute('id', maskId);
  // Both units in user space, and the region stated outright: the default is a
  // percentage of the bounding box, which crops the mask at the edges.
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
  mask.setAttribute('x', String(-span));
  mask.setAttribute('y', String(-span));
  mask.setAttribute('width', String(span * 2));
  mask.setAttribute('height', String(span * 2));

  // White paints the ground, black punches the opening through it.
  const lit = document.createElementNS(SVG_NS, 'rect');
  lit.setAttribute('x', String(-span));
  lit.setAttribute('y', String(-span));
  lit.setAttribute('width', String(span * 2));
  lit.setAttribute('height', String(span * 2));
  lit.setAttribute('fill', '#fff');

  const hole = document.createElementNS(SVG_NS, 'circle');
  hole.setAttribute('cx', '0');
  hole.setAttribute('cy', '0');
  hole.setAttribute('fill', '#000');

  mask.appendChild(lit);
  mask.appendChild(hole);

  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.appendChild(mask);

  const cover = document.createElementNS(SVG_NS, 'rect');
  cover.setAttribute('x', String(-span));
  cover.setAttribute('y', String(-span));
  cover.setAttribute('width', String(span * 2));
  cover.setAttribute('height', String(span * 2));
  cover.setAttribute('fill', ground);
  cover.setAttribute('mask', `url(#${maskId})`);

  svg.appendChild(defs);
  svg.appendChild(cover);

  function set(r: number) {
    hole.setAttribute('r', String(Math.max(0, r)));
  }

  set(max);

  return {
    max,
    set,
    mount() { document.body.appendChild(svg); },
    destroy() { svg.remove(); },
  };
}

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function run(
  iris: Iris,
  from: number,
  to: number,
  ms: number,
  ease: (t: number) => number,
  done: () => void,
) {
  const t0 = performance.now();
  function frame(now: number) {
    const t = Math.min(1, (now - t0) / ms);
    iris.set(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(frame);
    else done();
  }
  requestAnimationFrame(frame);
}

/**
 * Shut the iris over the current page, then navigate. Reduced motion gets a
 * plain cut — the same rule the develop effect follows — not a slower version
 * of the same animation.
 */
export function closeAndGo(href: string) {
  if (reducedMotion()) {
    window.location.href = href;
    return;
  }

  const iris = makeIris();
  iris.mount();

  let left = false;
  function leave() {
    if (left) return;
    left = true;
    window.clearTimeout(strand);
    // Private mode throws here; the work page simply won't play the opening
    // half, which is a lesser failure than not going anywhere.
    try { sessionStorage.setItem(ARRIVE_KEY, '1'); } catch { /* no storage */ }
    window.location.href = href;
    // And if the navigation doesn't take — offline, blocked — the visitor is
    // not left staring at a closed shutter.
    window.setTimeout(() => iris.destroy(), 4000);
  }

  // If the frames never come, the trip still happens; it just isn't animated.
  const strand = window.setTimeout(leave, STRAND_MS);
  run(iris, iris.max, 0, CLOSE_MS, easeIn, leave);
}

/**
 * The other half, on the page being entered: open from shut, but only for a
 * visitor who actually pressed the shutter. Also lifts the pre-paint cover that
 * MainLayout's inline guard put up — including when there's nothing to play, so
 * the cover can never strand a page.
 */
export function playArrival() {
  // MainLayout's inline guard already spent the flag — it has to, to raise the
  // cover before paint — and left this behind for us.
  const flagged = window.__dkArrive === true;
  delete window.__dkArrive;

  const uncover = () => document.documentElement.classList.remove('dk-arriving');

  if (!flagged || reducedMotion()) {
    uncover();
    return;
  }

  const iris = makeIris();
  iris.set(0);   // shut, exactly as the landing page left it
  iris.mount();
  uncover();     // cover hands off to the iris within the one frame

  run(iris, 0, iris.max, OPEN_MS, easeOut, () => iris.destroy());
}
