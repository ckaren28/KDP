/**
 * Develop: hidden prints across a whole page that only appear where the cursor
 * has been, and stay (like the meadow print on the old homepage).
 *
 * The page keeps its normal light or dark ground. A transparent canvas sits
 * behind the content; each "asset" is turned into a print in the accent color
 * (shadows dense, highlights clear, a little paper grain) and the cursor
 * paints an exposure mask that reveals it. Phones have no cursor, so assets
 * develop on their own as they scroll into view.
 */

export interface DevelopAsset {
  /** Returns the source image (any canvas or loaded image). */
  source: () => HTMLCanvasElement | HTMLImageElement | null;
  /** Horizontal center as a fraction of the container width (0..1). */
  x: number;
  /** Top edge in px from the top of the container. */
  top: number;
  /** Width in px (scaled down on narrow screens). */
  width: number;
  /** Optional placement for narrow screens (under 760px), worked out when the
      page lays out, so prints can move out from under the text on phones. */
  narrow?: () => { x: number; top: number; width: number } | null;
}

const BRUSH = 110;     // px radius of the light
const STRENGTH = 0.16; // how much one pass develops

export interface DevelopHandle {
  /** Where asset i sits, in px relative to the container (null until its source exists). */
  box(i: number): { x: number; y: number; w: number; h: number } | null;
  /** Develop asset i a little, as a hint that something is there. */
  hint(i: number): void;
}

export function initDevelop(container: HTMLElement, assets: DevelopAsset[]): DevelopHandle {
  const view = document.createElement('canvas');
  view.className = 'develop-layer';
  view.setAttribute('aria-hidden', 'true');
  container.prepend(view);
  const ctx = view.getContext('2d')!;

  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d')!;
  const print = document.createElement('canvas');
  const pctx = print.getContext('2d')!;

  const DPR = Math.min(devicePixelRatio || 1, 1.5);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = matchMedia('(hover: hover)').matches;
  let W = 0, H = 0, dirty = true;
  const sources = assets.map((a) => a.source());

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--sienna').trim() || '#5730D0';

  // Turn a render into a one-color print: density follows darkness.
  function toPrint(src: HTMLCanvasElement | HTMLImageElement, w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * DPR)); c.height = Math.max(1, Math.round(h * DPR));
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    const hex = accent().replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      if (!a) continue;
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      const density = 0.22 + 0.78 * Math.pow(1 - lum, 0.9);
      d[i] = r; d[i + 1] = gg; d[i + 2] = b;
      d[i + 3] = Math.round(255 * a * density * (0.86 + Math.random() * 0.14));
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function layout() {
    const r = container.getBoundingClientRect();
    const nw = Math.round(r.width), nh = Math.round(container.scrollHeight);
    if (nw === W && nh === H) return;
    // keep what has been developed when the page resizes
    const old = document.createElement('canvas');
    old.width = mask.width; old.height = mask.height;
    if (mask.width) old.getContext('2d')!.drawImage(mask, 0, 0);
    W = nw; H = nh;
    for (const c of [view, mask, print]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    view.style.width = W + 'px'; view.style.height = H + 'px';
    if (old.width) mctx.drawImage(old, 0, 0, mask.width, mask.height);
    if (reduced) { mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mask.width, mask.height); }
    rebuildPrint();
  }

  function placed(a: DevelopAsset, src: HTMLCanvasElement | HTMLImageElement) {
    const ratio = (src as HTMLImageElement).naturalHeight
      ? (src as HTMLImageElement).naturalHeight / (src as HTMLImageElement).naturalWidth
      : (src as HTMLCanvasElement).height / (src as HTMLCanvasElement).width;
    const n = W < 760 && a.narrow ? a.narrow() : null;
    if (n) return { x: n.x * W - n.width / 2, y: n.top, w: n.width, h: n.width * ratio };
    const scale = W < 760 ? 0.62 : 1;
    const w = a.width * scale;
    return { x: a.x * W - w / 2, y: a.top * (W < 760 ? 0.9 : 1), w, h: w * ratio };
  }

  function rebuildPrint() {
    pctx.clearRect(0, 0, print.width, print.height);
    assets.forEach((a, i) => {
      const src = sources[i];
      if (!src) return;
      const p = placed(a, src);
      pctx.drawImage(toPrint(src, p.w, p.h), p.x * DPR, p.y * DPR);
    });
    dirty = true;
  }

  // ---------- exposure ----------
  let lx: number | null = null, ly: number | null = null;
  function expose(x: number, y: number) {
    const steps = lx === null ? 1 : Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly!) / (BRUSH * 0.35)));
    for (let s = 1; s <= steps; s++) {
      const px = lx === null ? x : lx + ((x - lx) * s) / steps;
      const py = ly === null ? y : ly + ((y - ly) * s) / steps;
      const grd = mctx.createRadialGradient(px * DPR, py * DPR, 0, px * DPR, py * DPR, BRUSH * DPR);
      grd.addColorStop(0, `rgba(0,0,0,${STRENGTH})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = grd;
      mctx.fillRect((px - BRUSH) * DPR, (py - BRUSH) * DPR, BRUSH * 2 * DPR, BRUSH * 2 * DPR);
    }
    lx = x; ly = y; dirty = true;
  }

  if (hover && !reduced) {
    container.addEventListener('pointermove', (e) => {
      const r = container.getBoundingClientRect();
      expose(e.clientX - r.left, e.clientY - r.top);
    });
    container.addEventListener('pointerleave', () => { lx = ly = null; });
  } else if (!reduced) {
    // no cursor: each print develops by itself once it is on screen
    const io = new IntersectionObserver(() => {
      if (!sources.length) return;
      let t0 = 0;
      const run = (now: number) => {
        if (!t0) t0 = now;
        const k = Math.min(1, (now - t0) / 1600);
        mctx.globalAlpha = 0.06; mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mask.width, mask.height); mctx.globalAlpha = 1;
        dirty = true;
        if (k < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      io.disconnect();
    }, { threshold: 0.2 });
    io.observe(container);
  }

  // ---------- draw ----------
  function draw() {
    if (dirty) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, view.width, view.height);
      ctx.drawImage(print, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      dirty = false;
    }
    requestAnimationFrame(draw);
  }

  new ResizeObserver(layout).observe(container);
  layout();
  requestAnimationFrame(draw);
  // the print color follows the theme
  new MutationObserver(rebuildPrint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const box = (i: number) => {
    const src = sources[i];
    return src ? placed(assets[i], src) : null;
  };
  return {
    box,
    hint(i) {
      const b = box(i);
      if (!b) return;
      // a soft, partial exposure over the whole print: enough to see a shape
      let n = 0;
      const step = () => {
        const grd = mctx.createRadialGradient(
          (b.x + b.w / 2) * DPR, (b.y + b.h / 2) * DPR, 0,
          (b.x + b.w / 2) * DPR, (b.y + b.h / 2) * DPR, Math.max(b.w, b.h) * 0.62 * DPR);
        grd.addColorStop(0, 'rgba(0,0,0,0.05)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd;
        mctx.fillRect(b.x * DPR, b.y * DPR, b.w * DPR, b.h * DPR);
        dirty = true;
        if (++n < 6) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
  };
}
