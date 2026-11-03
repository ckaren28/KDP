/**
 * Develop hero, the homepage's interaction (Nov 2026).
 *
 * The darkroom's develop pass, cut down to a band: moving over the hero brings
 * Karen's meadow scan up in the print color, and going back over developed
 * ground tones it warm. Unlike the darkroom on /about, nothing is hidden behind
 * it. The name, the intro and the work below are ordinary DOM text, readable
 * from the first frame, and the canvas is decorative and aria-hidden.
 *
 * The canvas is transparent: it only ever draws the developed print, so the
 * page's own ground shows through and the theme switch keeps working without
 * a second background to keep in step.
 */

const PRINT = { dark: '#A6C8E8', light: '#7A2230' };
const TONE = { dark: '#C9A227', light: '#3B5BA8' };
const CELL = 18;
const TONE_GATE = 0.55;

export function initDevelopHero(hero: HTMLElement) {
  const view = hero.querySelector<HTMLCanvasElement>('.dh-stage');
  if (!view) return;
  const ctx = view.getContext('2d')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mk = () => document.createElement('canvas');
  const uPrint = mk(), uTone = mk(), mExpo = mk(), mTone = mk(), layer = mk(), pad = mk();
  const up = uPrint.getContext('2d')!, ut = uTone.getContext('2d')!;
  const me = mExpo.getContext('2d')!, mt = mTone.getContext('2d')!;
  const lc = layer.getContext('2d')!, pc = pad.getContext('2d')!;

  let W = 0, H = 0, DPR = 1, cols = 0, rows = 0;
  // The section rule the stems grow from: its left and right edges inside the
  // band. Falls back to the full width when there is no rule.
  let L = 0, R = 0;
  const rule = hero.querySelector<HTMLElement>('.dh-label');
  let expo = new Float32Array(0), tone = new Float32Array(0);
  let px = -9999, py = -9999, lx = -9999, ly = -9999;
  let moved = false, idle = 0, visible = true;

  const theme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  const meadow = new Image();
  for (const [im, file] of [
    [meadow, 'meadow-grasses.svg'],
  ] as const) {
    im.addEventListener('load', () => { repaintUnder(); if (reduced) draw(); }, { once: true });
    im.src = `/images/botanicals/${file}`;
  }
  const MEADOW_RATIO = 1014.43 / 1355.04;

  function stamp(c: CanvasRenderingContext2D, im: HTMLImageElement, color: string,
    x: number, y: number, w: number, h: number, alpha: number, flip = false, rot = 0) {
    if (!im.complete || !im.naturalWidth) return;
    const pw = Math.max(1, Math.round(w * DPR)), ph = Math.max(1, Math.round(h * DPR));
    pad.width = pw; pad.height = ph;
    pc.globalCompositeOperation = 'source-over';
    pc.drawImage(im, 0, 0, pw, ph);
    pc.globalCompositeOperation = 'source-in';
    pc.fillStyle = color;
    pc.fillRect(0, 0, pw, ph);
    c.save();
    c.globalAlpha = alpha;
    c.translate(x + w / 2, y + h / 2);
    if (rot) c.rotate(rot);
    if (flip) c.scale(-1, 1);
    c.drawImage(pad, -w / 2, -h / 2, w, h);
    c.restore();
  }

  // The meadow grows up out of the section rule at the bottom of the band,
  // right of the text, so the name and intro stay on clean ground.
  function drawUnderTo(c: CanvasRenderingContext2D, color: string) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W * DPR, H * DPR);
    c.scale(DPR, DPR);
    const narrow = W < 720;
    let mh = H * 1.05, mw = mh * MEADOW_RATIO;
    if (mw > W * (narrow ? 0.9 : 0.42)) { mw = W * (narrow ? 0.9 : 0.42); mh = mw / MEADOW_RATIO; }
    const ax = (f: number) => L + (R - L) * f;
    // Pushed a little past the bottom so the stems run into the rule rather
    // than stopping just short of it (the scan has a margin under the stems).
    stamp(c, meadow, color, narrow ? ax(0.5) - mw / 2 : ax(0.76) - mw / 2, H - mh * 0.96, mw, mh, 0.22);
    c.globalAlpha = 1;
  }
  const repaintUnder = () => {
    const t = theme();
    drawUnderTo(up, PRINT[t]);
    drawUnderTo(ut, TONE[t]);
  };

  function bump(grid: Float32Array, x: number, y: number, amt: number, reach: number) {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) {
      const gx = cx + i, gy = cy + j;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      const d = Math.hypot(i, j);
      if (d > reach + 0.4) continue;
      grid[gy * cols + gx] += amt * (1 - d / (reach + 1));
    }
  }
  const at = (grid: Float32Array, x: number, y: number) => {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    return cx < 0 || cy < 0 || cx >= cols || cy >= rows ? 0 : grid[cy * cols + cx];
  };

  function develop(x: number, y: number, s: number) {
    const r = 112;
    const g = me.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.30 * s})`);
    g.addColorStop(0.5, `rgba(255,255,255,${0.13 * s})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    me.fillStyle = g;
    me.beginPath(); me.arc(x, y, r, 0, Math.PI * 2); me.fill();
    bump(expo, x, y, s * 0.075, 2);
  }
  function toneStroke(x: number, y: number, s: number) {
    const r = 78;
    const g = mt.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.15 * s})`);
    g.addColorStop(0.6, `rgba(255,255,255,${0.06 * s})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    mt.fillStyle = g;
    mt.beginPath(); mt.arc(x, y, r, 0, Math.PI * 2); mt.fill();
    bump(tone, x, y, s * 0.05, 1);
  }

  function resize() {
    const r = hero.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width);
    // The band ends at the rule, so the stems' base is the line itself.
    const rr = rule?.getBoundingClientRect();
    H = rr ? Math.round(rr.bottom - r.top) : Math.round(r.height);
    L = rr ? rr.left - r.left : 0; R = rr ? rr.right - r.left : W;
    for (const cv of [view!, uPrint, uTone, mExpo, mTone, layer]) { cv.width = W * DPR; cv.height = H * DPR; }
    me.setTransform(DPR, 0, 0, DPR, 0, 0);
    mt.setTransform(DPR, 0, 0, DPR, 0, 0);
    repaintUnder();
    cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1;
    expo = new Float32Array(cols * rows); tone = new Float32Array(cols * rows);
    if (reduced) {
      // No motion: show the print already developed, still and quiet.
      me.setTransform(1, 0, 0, 1, 0, 0);
      me.fillStyle = 'rgba(255,255,255,0.75)'; me.fillRect(0, 0, mExpo.width, mExpo.height);
      me.setTransform(DPR, 0, 0, DPR, 0, 0);
    } else {
      // A few seed exposures so the band never looks empty before anyone moves.
      ([[0.76, 0.72], [0.7, 0.4], [0.82, 0.55]] as const).forEach(([fx, fy]) => develop(L + (R - L) * fx, H * fy, 0.8));
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, view!.width, view!.height);
    ctx.drawImage(uPrint, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mExpo, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, layer.width, layer.height);
    lc.drawImage(uTone, 0, 0);
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(mTone, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);
  }

  function frame() {
    if (visible && !reduced) {
      if (!moved) {
        // Before the first move, the exposure drifts slowly on its own over
        // the right half, so the band hints at what it does.
        idle += 0.009;
        px = L + (R - L) * 0.7 + Math.cos(idle * 1.1) * (R - L) * 0.2;
        py = H * 0.55 + Math.sin(idle * 1.7) * H * 0.3;
      }
      if (px > -9998) {
        const s = Math.min(1, 0.42 + Math.hypot(px - lx, py - ly) * 0.02);
        const already = at(expo, px, py);
        develop(px, py, s);
        if (already > TONE_GATE) toneStroke(px, py, s);
      }
      lx = px; ly = py;
      draw();
    }
    requestAnimationFrame(frame);
  }

  function pointer(cx: number, cy: number) {
    const r = hero.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return;
    moved = true;
    px = x; py = y;
  }
  hero.addEventListener('mousemove', (e) => pointer(e.clientX, e.clientY));
  // Passive, and no touch-action change: a finger dragging over the band still
  // scrolls the page, and develops the print along the way.
  hero.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) pointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) pointer(t.clientX, t.clientY); }, { passive: true });

  // Stop drawing once the band has scrolled away.
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(hero);
  new ResizeObserver(() => resize()).observe(hero);

  // The site's theme switch dispatches this; repaint the scans in the new ink.
  window.addEventListener('themechange', () => { repaintUnder(); if (reduced) draw(); });

  resize();
  if (reduced) { draw(); }
  requestAnimationFrame(frame);
}
