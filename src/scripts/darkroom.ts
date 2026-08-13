/**
 * Darkroom — the landing page interaction.
 *
 * A cursor-driven photographic reveal: moving over the field develops the
 * image beneath in powder blue, and going back over already-developed ground
 * tones it warm, the way a second pass in the bath would.
 *
 * The name is real DOM text — never drawn into the canvas — so it stays
 * legible, selectable, crawlable and reachable by a screen reader. The canvas
 * is decorative and marked aria-hidden.
 */

type Palette = { ox: string; oxDeep: string; print: string; tone: string };

const PAL: Record<'pos' | 'neg', Palette> = {
  // `ox` is the middle of the ground's vignette and `oxDeep` its outer edge —
  // both kept in step with --ox / --ox-deep in darkroom.css. The edge is
  // already the site's dark ground exactly; the middle now sits just above it
  // rather than at the full oxblood accent.
  pos: { ox: '#4A121C', oxDeep: '#3A0810', print: '#A6C8E8', tone: '#C9A227' },
  // the negative's outer edge matches --off-white site-wide
  neg: { ox: '#C5D6E6', oxDeep: '#D7E3EE', print: '#7A2230', tone: '#3B5BA8' },
};

/* name hover ramp — the negative set is a true inversion of the positive one */
const HEAT: Record<'pos' | 'neg', [string, string, string]> = {
  pos: ['#C4DCF2', '#C9E85F', '#F6A85C'],
  neg: ['#6B1621', '#36179F', '#0957A3'],
};

interface Letter {
  el: HTMLElement;
  li: number; i: number;
  x: number; y: number;
  vx: number; vy: number;
  tx: number; ty: number;
  ux: number; uy: number;
  /* each letter drifts on its own clock so the word never reads as a wave */
  ph: number; sp: number; am: number;
  phx: number; spx: number; amx: number;
}

export function initDarkroom(root: HTMLElement) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const view = root.querySelector<HTMLCanvasElement>('.dk-stage');
  const nameEl = root.querySelector<HTMLElement>('.dk-name');
  const curEl = root.querySelector<HTMLElement>('.dk-cur');
  const hintEl = root.querySelector<HTMLElement>('.dk-hint');
  const cardEl = root.querySelector<HTMLElement>('.dk-card');
  const shutter = root.querySelector<HTMLAnchorElement>('.dk-shutter');
  const revealBtn = root.querySelector<HTMLButtonElement>('.dk-reveal');
  if (!view || !nameEl || !curEl || !hintEl || !cardEl || !shutter || !revealBtn) return;

  // Past the guard, so a replacement cursor is guaranteed to be drawn. Only
  // now is it safe for the stylesheet to hide the real one — if this module
  // never loads, or bailed above, the visitor keeps their pointer.
  root.classList.add('dk-live');

  const ctx = view.getContext('2d')!;
  const mk = () => document.createElement('canvas');
  const uPrint = mk(), up = uPrint.getContext('2d')!;
  const uTone = mk(), ut = uTone.getContext('2d')!;
  const mExpo = mk(), me = mExpo.getContext('2d')!;
  const mTone = mk(), mt = mTone.getContext('2d')!;
  const layer = mk(), lc = layer.getContext('2d')!;
  const comp = mk(), cc = comp.getContext('2d')!;

  let pal = PAL.pos, negative = false;
  let W = 0, H = 0, DPR = 1;
  let px = -9999, py = -9999, lx = -9999, ly = -9999, moved = false, idle = 0;
  let heat = 0, heatTarget = 0;

  const CELL = 46;
  let cols = 0, rows = 0;
  let expo = new Float32Array(0), tone = new Float32Array(0);
  let toneShown = false, totalExpo = 0;
  const TONE_GATE = 0.85;

  /* ── letters as spring bodies ──
     The spans are rendered by index.astro, not built here, so the name is real
     text in the served HTML. This only adopts them as physics bodies. */
  const L: Letter[] = [];
  nameEl.querySelectorAll<HTMLElement>('.dk-line').forEach((line) => {
    const li = Number(line.dataset.l) || 0;
    line.querySelectorAll<HTMLElement>('.dk-ltr').forEach((el, i) => {
      L.push({
        el, li, i, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ux: 0, uy: 0,
        ph: Math.random() * Math.PI * 2,
        sp: 0.62 + Math.random() * 0.85,
        am: 1.9 + Math.random() * 1.5,
        phx: Math.random() * Math.PI * 2,
        spx: 0.44 + Math.random() * 0.6,
        amx: 0.7 + Math.random() * 1.1,
      });
    });
  });

  const K = 0.16, D = 0.74;
  const STRETCH = 190;
  const COUPLE_SAME = 0.52, COUPLE_OTHER = 0.16, FALLOFF = 2.3;
  const REVEAL_AT = 78;

  let grabbed: Letter | null = null;
  let originX = 0, originY = 0, startX = 0, startY = 0;
  let revealed = false, lineGap = 0, lineGapTarget = 0;
  /* until someone grabs a letter, the whole word drifts a little so it
     reads as a set of physical objects rather than a headline */
  let hinting = !reduced, bob = 0;

  const softCap = (v: number, max: number) => max * Math.tanh(v / max);

  function pickLetterWithin(cx: number, cy: number, max: number): Letter | null {
    let best: Letter | null = null, bd = Infinity;
    for (const l of L) {
      const r = l.el.getBoundingClientRect();
      const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
      if (d < bd) { bd = d; best = l; }
    }
    return bd < max ? best : null;
  }
  const pickLetter = (cx: number, cy: number) => pickLetterWithin(cx, cy, 220);

  function reveal(on: boolean) {
    revealed = on;
    // Wide enough to clear the card that sits in the gap. It stacks and gets
    // taller on narrow screens, so measure it rather than trusting one number
    // — 58 was tuned on a desktop width and the card overlapped both lines of
    // the name on a phone.
    lineGapTarget = on ? Math.max(58, cardEl!.offsetHeight / 2 + 30) : 0;
    // The cue sits under the name and the card pushes the lines apart around
    // it, so once the introduction is open the cue has both been answered and
    // been landed on. Same class the first pull uses.
    if (on) nameEl!.classList.add('touched');
    cardEl!.style.opacity = on ? '1' : '0';
    cardEl!.style.pointerEvents = on ? 'auto' : 'none';
    cardEl!.setAttribute('aria-hidden', on ? 'false' : 'true');
    // The card is a container now, so the tab stop belongs to the shutter
    // inside it rather than to the card itself.
    shutter!.tabIndex = on ? 0 : -1;
    revealBtn!.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  nameEl.addEventListener('pointerdown', (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.dk-card')) return;
    const l = pickLetter(e.clientX, e.clientY);
    if (!l) return;
    e.preventDefault();
    grabbed = l;
    originX = e.clientX; originY = e.clientY;
    startX = l.x; startY = l.y;

    // unit vector toward the centre of the name, so an inward pull is
    // distinguishable from an outward one
    const nr = nameEl.getBoundingClientRect();
    const lr = l.el.getBoundingClientRect();
    const vx = (nr.left + nr.width / 2) - (lr.left + lr.width / 2 - l.x);
    const vy = (nr.top + nr.height / 2) - (lr.top + lr.height / 2 - l.y);
    const m = Math.hypot(vx, vy) || 1;
    l.ux = vx / m; l.uy = vy / m;

    // Touch has no hover, so the ramp rides the drag instead: holding a letter
    // warms it, letting go cools it. Mouse keeps the pointerenter path below.
    if (e.pointerType !== 'mouse') heatTarget = 1;

    hinting = false;
    nameEl.classList.add('touched');
    curEl.classList.add('grabbing');
    nameEl.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointermove', (e: PointerEvent) => {
    if (!grabbed) return;
    grabbed.tx = softCap(startX + (e.clientX - originX), STRETCH);
    grabbed.ty = softCap(startY + (e.clientY - originY), STRETCH);
    const inward = grabbed.tx * grabbed.ux + grabbed.ty * grabbed.uy;
    if (!revealed && Math.hypot(grabbed.tx, grabbed.ty) > REVEAL_AT && inward < REVEAL_AT * 0.5) {
      reveal(true);
    } else if (revealed && inward > REVEAL_AT) {
      reveal(false);
    }
  });

  function release(e: PointerEvent) {
    if (!grabbed) return;
    try { nameEl!.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    grabbed.vx += grabbed.tx * 0.06;
    grabbed.vy += grabbed.ty * 0.06;
    grabbed = null;
    curEl!.classList.remove('grabbing');
    if (e.pointerType !== 'mouse') heatTarget = 0;
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Keyboard path: a real button, so Enter/Space come for free and the h1
  // keeps its heading role. Focus moves to the shutter once it's revealed.
  revealBtn.addEventListener('click', () => {
    reveal(!revealed);
    if (revealed) shutter.focus();
  });

  // "Press enter to enter" has to be true for the visitor who pulled a letter
  // with the mouse and never focused anything. Enter already means something to
  // whatever does have focus, though — a nav link, the theme switch, the reveal
  // button, the shutter itself — so this only claims the key when nothing
  // interactive holds it. Otherwise tabbing to About and pressing Enter would
  // land on the work page instead.
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !revealed || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const held = document.activeElement as HTMLElement | null;
    if (held?.closest('a[href], button, input, select, textarea, [contenteditable]')) return;
    e.preventDefault();
    shutter.click();
  });
  // Hover ramp — pointer events gated on pointerType, not mouseenter/mouseleave.
  // iOS synthesises a mouseenter on tap but never a matching mouseleave, so the
  // old mouse-event pair lit the ramp on first touch and left it stuck there
  // until you tapped elsewhere — while the same tap was also grabbing a letter.
  // pointerenter with pointerType 'mouse' simply doesn't fire for a touch.
  nameEl.addEventListener('pointerenter', (e: PointerEvent) => {
    if (e.pointerType === 'mouse') heatTarget = 1;
  });
  nameEl.addEventListener('pointerleave', (e: PointerEvent) => {
    if (e.pointerType === 'mouse') heatTarget = 0;
  });
  revealBtn.addEventListener('focus', () => { heatTarget = 1; });
  revealBtn.addEventListener('blur', () => { heatTarget = 0; });

  function stepLetters() {
    bob += 0.022;
    lineGap += (lineGapTarget - lineGap) * 0.12;
    for (const l of L) {
      if (l === grabbed) {
        l.x += (l.tx - l.x) * 0.30;   // sticky follow — lags the pointer
        l.y += (l.ty - l.y) * 0.30;
        l.vx = l.vy = 0;
      } else {
        let tx = 0, ty = 0;
        if (grabbed) {
          const same = l.li === grabbed.li;
          const dist = same ? Math.abs(l.i - grabbed.i) : Math.abs(l.i - grabbed.i) + 1.6;
          const w = (same ? COUPLE_SAME : COUPLE_OTHER) * Math.exp(-dist / FALLOFF);
          tx = grabbed.x * w; ty = grabbed.y * w;
        }
        l.vx += (tx - l.x) * K; l.vx *= D; l.x += l.vx;
        l.vy += (ty - l.y) * K; l.vy *= D; l.y += l.vy;
      }
      // independent phase, speed and amplitude per letter — drift, not a wave.
      // Amplitude is small and the x component tiny, so tight pairs like the
      // double T in DETTMAR never overlap.
      const idleY = hinting ? Math.sin(bob * l.sp + l.ph) * l.am : 0;
      const idleX = hinting ? Math.sin(bob * l.spx + l.phx) * l.amx : 0;
      const gap = l.li === 0 ? -lineGap : lineGap;
      l.el.style.transform =
        `translate(${(l.x + idleX).toFixed(2)}px, ${(l.y + gap + idleY).toFixed(2)}px)`;
    }
  }

  function mixHex(a: string, b: string, t: number) {
    const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = p(a), B = p(b);
    return A.map((v, i) => Math.round(v + (B[i] - v) * t));
  }
  function stepHeat() {
    heat += (heatTarget - heat) * 0.026;
    if (Math.abs(heatTarget - heat) < 0.004) heat = heatTarget;
    if (heat > 0.002) {
      const s = negative ? HEAT.neg : HEAT.pos;
      const c = heat < .5 ? mixHex(s[0], s[1], heat / .5) : mixHex(s[1], s[2], (heat - .5) / .5);
      nameEl!.style.color = `rgb(${c.join(',')})`;
    } else {
      nameEl!.style.color = '';
    }
  }

  /* ── what develops underneath ──
     Karen's botanical scans: the meadow rises behind the name, ferns bank up
     in both bottom corners. They're printed as flat silhouettes in the palette
     color rather than in their own — the develop pass prints in `print` and a
     second pass tones it gold, and that two-layer mechanism needs a
     single-color source to work against. */
  const meadow = new Image(), fern = new Image(), lace = new Image();
  for (const [im, file] of [
    [meadow, 'meadow-grasses.svg'], [fern, 'ferns.svg'], [lace, 'queen-annes-lace.svg'],
  ] as const) {
    // Same-origin out of /public, so the composite canvas stays untainted and
    // the print egg can still read it back.
    im.addEventListener('load', () => repaintUnder(), { once: true });
    im.src = `/images/botanicals/${file}`;
  }

  // Heights lead and widths follow the artwork's own ratio, so nothing is
  // stretched; the caller clamps against W for narrow screens.
  const MEADOW_RATIO = 1014.43 / 1355.04;
  const FERN_RATIO = 755.04 / 1091.71;
  const LACE_RATIO = 594.24 / 1025.61;
  const pad = mk(), pc = pad.getContext('2d')!;

  /* One silhouette: rasterize the scan into the scratch canvas at device
     resolution, flood it with the palette color through `source-in` so only
     the drawn pixels take the ink, then stamp that onto the layer. */
  /* `x`/`y`/`w`/`h` describe the upright box, as they always did; `rot` turns
     the stamp about that box's middle, so a rotated scan is positioned by where
     you want its center rather than by solving for a corner. */
  function stamp(
    c: CanvasRenderingContext2D, im: HTMLImageElement, color: string,
    x: number, y: number, w: number, h: number, alpha: number,
    flip = false, rot = 0,
  ) {
    if (!im.complete || !im.naturalWidth) return;
    const pw = Math.max(1, Math.round(w * DPR)), ph = Math.max(1, Math.round(h * DPR));
    // Resizing the canvas clears it; sizing it the same twice running does not.
    if (pad.width !== pw || pad.height !== ph) { pad.width = pw; pad.height = ph; }
    else pc.clearRect(0, 0, pw, ph);
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

  function drawUnderTo(c: CanvasRenderingContext2D, color: string) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W * DPR, H * DPR);
    c.scale(DPR, DPR);

    // All three are rooted just past the bottom edge, so the stems run off the
    // page rather than ending in mid-air.
    const base = H * 1.04;

    // Meadow, centered and topping out above the name. Deliberately fainter
    // than the ferns: the h1 sits directly over it. On a narrow screen it may
    // take most of the width — the ferns shrink into the corners there, so
    // there's nothing beside it to crowd, and the tighter cap would otherwise
    // strand it in the bottom third.
    let mh = H * 0.94, mw = mh * MEADOW_RATIO;
    const mwMax = W * (W < 720 ? 0.80 : 0.54);
    if (mw > mwMax) { mw = mwMax; mh = mw / MEADOW_RATIO; }
    stamp(c, meadow, color, (W - mw) / 2, base - mh, mw, mh, 0.20);

    // Ferns at two scales and one flipped, so the corners don't read as a
    // mirrored pair. Each runs off its own edge.
    let lh = H * 0.50, lw = lh * FERN_RATIO;
    if (lw > W * 0.40) { lw = W * 0.40; lh = lw / FERN_RATIO; }
    stamp(c, fern, color, W * 0.05 - lw * 0.32, base - lh, lw, lh, 0.34);

    let rh = H * 0.42, rw = rh * FERN_RATIO;
    if (rw > W * 0.36) { rw = W * 0.36; rh = rw / FERN_RATIO; }
    stamp(c, fern, color, W * 0.95 - rw * 0.68, base - rh, rw, rh, 0.30, true);

    // Lace laid in from the sides rather than hung from the top: turned about a
    // quarter turn so the stems run off the left and right edges and the heads
    // reach in toward the name, tilted a little past horizontal so they lift
    // instead of lying flat. Sat below the nav band, and fainter than the ferns.
    //
    // Once rotated, it's the scan's HEIGHT that spans the screen horizontally,
    // so the reach is capped against W on `h`, not on `w` as it was upright.
    const laceTilt = 0.20;            // radians past horizontal; 0 is dead flat
    const laceDrop = 0.19;            // how far down the pair sits, as a share of H
    const laceIn = 0.065;             // how far in from each edge the middles sit

    let tlh = H * 0.36, tlw = tlh * LACE_RATIO;
    if (tlh > W * 0.34) { tlh = W * 0.34; tlw = tlh * LACE_RATIO; }
    // +90° swings the head to the right and the stem off the left edge; backing
    // off by the tilt lifts the head. Centered just inside the edge, so half the
    // length is already off-screen.
    stamp(
      c, lace, color, W * laceIn - tlw / 2, H * laceDrop - tlh / 2,
      tlw, tlh, 0.26, false, Math.PI / 2 - laceTilt,
    );

    let trh = H * 0.30, trw = trh * LACE_RATIO;
    if (trh > W * 0.29) { trh = W * 0.29; trw = trh * LACE_RATIO; }
    // The mirror of it, a little smaller and a little lower so the two don't
    // read as a pair — the same reason the ferns are at two scales. The rotation
    // is negated, not flipped: `flip` mirrors across the stem, which varies the
    // silhouette but would leave this one's head pointing right as well.
    stamp(
      c, lace, color, W * (1 - laceIn) - trw / 2, H * (laceDrop + 0.07) - trh / 2,
      trw, trh, 0.23, true, -(Math.PI / 2 - laceTilt),
    );

    c.globalAlpha = 1;
  }
  const repaintUnder = () => { drawUnderTo(up, pal.print); drawUnderTo(ut, pal.tone); };

  function bump(grid: Float32Array, x: number, y: number, amt: number, reach: number) {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) {
      const gx = cx + i, gy = cy + j;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      const d = Math.hypot(i, j);
      if (d > reach + .4) continue;
      grid[gy * cols + gx] += amt * (1 - d / (reach + 1));
    }
  }
  function at(grid: Float32Array, x: number, y: number) {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return 0;
    return grid[cy * cols + cx];
  }

  function develop(x: number, y: number, strength: number) {
    const r = 112;
    const g = me.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.30 * strength})`);
    g.addColorStop(0.5, `rgba(255,255,255,${0.13 * strength})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    me.fillStyle = g;
    me.beginPath(); me.arc(x, y, r, 0, Math.PI * 2); me.fill();
    bump(expo, x, y, strength * 0.075, 2);
    totalExpo += strength * 0.075;
  }
  function toneStroke(x: number, y: number, strength: number) {
    const r = 78;
    const g = mt.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.15 * strength})`);
    g.addColorStop(0.6, `rgba(255,255,255,${0.06 * strength})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    mt.fillStyle = g;
    mt.beginPath(); mt.arc(x, y, r, 0, Math.PI * 2); mt.fill();
    bump(tone, x, y, strength * 0.05, 1);
  }

  function clearPrint() {
    for (const c of [me, mt]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W * DPR, H * DPR);
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    expo.fill(0); tone.fill(0);
    totalExpo = 0; toneShown = false;
    if (reduced) {
      // fully resolved without requiring motion
      me.setTransform(1, 0, 0, 1, 0, 0);
      me.fillStyle = '#fff'; me.fillRect(0, 0, mExpo.width, mExpo.height);
      me.setTransform(DPR, 0, 0, DPR, 0, 0);
      expo.fill(4);
    } else {
      // Placed over the scans — the meadow, both ferns, both laid-in stems — so
      // the opening state hints at something there rather than at bare ground.
      ([[0.50, 0.34], [0.47, 0.68], [0.09, 0.74], [0.16, 0.92],
        [0.90, 0.78], [0.84, 0.94], [0.14, 0.14], [0.87, 0.11]] as const)
        .forEach(([fx, fy]) => develop(W * fx, H * fy, 0.85));
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    for (const cv of [view!, uPrint, uTone, mExpo, mTone, layer, comp]) { cv.width = W * DPR; cv.height = H * DPR; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    me.setTransform(DPR, 0, 0, DPR, 0, 0);
    mt.setTransform(DPR, 0, 0, DPR, 0, 0);
    repaintUnder();
    cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1;
    expo = new Float32Array(cols * rows);
    tone = new Float32Array(cols * rows);
    clearPrint();
  }

  /* ── theme ──
     Same typed commands as the rest of the site. Here "light" is the negative
     print — pale mint ground, oxblood image — and "dark" is the darkroom. */
  function setNegative(on: boolean) {
    if (on === negative) return;
    negative = on;
    pal = on ? PAL.neg : PAL.pos;
    root.classList.toggle('neg', on);
    repaintUnder();
  }
  setNegative(document.documentElement.getAttribute('data-theme') === 'light');
  window.addEventListener('themechange', (e) => {
    setNegative((e as CustomEvent<string>).detail === 'light');
  });

  function frame() {
    const dx = px - lx, dy = py - ly, speed = Math.hypot(dx, dy);
    if (!moved && !reduced) {
      idle += 0.011;
      px = W / 2 + Math.cos(idle * 1.15) * W * 0.30;
      py = H / 2 + Math.sin(idle * 1.9) * H * 0.21;
    }
    if (px > -9998 && !reduced) {
      const s = Math.min(1, 0.42 + speed * 0.02);
      const already = at(expo, px, py);
      develop(px, py, s);
      if (already > TONE_GATE) toneStroke(px, py, s);
    }
    lx = px; ly = py;

    stepLetters();
    stepHeat();
    const overName = !grabbed && !!pickLetterWithin(px, py, 90);
    curEl!.classList.toggle('overname', overName);
    curEl!.classList.toggle('toning', !grabbed && !overName && at(expo, px, py) > TONE_GATE);

    if (!toneShown && totalExpo > 26) {
      toneShown = true;
      hintEl!.textContent = 'Go back over it to tone';
      hintEl!.classList.remove('gone');
      setTimeout(() => hintEl!.classList.add('gone'), 4200);
    }

    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.clearRect(0, 0, comp.width, comp.height);
    cc.drawImage(uPrint, 0, 0);
    cc.globalCompositeOperation = 'destination-in';
    cc.drawImage(mExpo, 0, 0);
    cc.globalCompositeOperation = 'source-over';

    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, layer.width, layer.height);
    lc.drawImage(uTone, 0, 0);
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(mTone, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    cc.drawImage(layer, 0, 0);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.80);
    bg.addColorStop(0, pal.ox);
    bg.addColorStop(1, pal.oxDeep);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(comp, 0, 0);

    requestAnimationFrame(frame);
  }

  function pointer(x: number, y: number) {
    if (!moved) { moved = true; hintEl!.classList.add('gone'); }
    px = x; py = y;
    curEl!.style.left = x + 'px'; curEl!.style.top = y + 'px';
  }
  window.addEventListener('mousemove', e => pointer(e.clientX, e.clientY));
  window.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) pointer(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('resize', resize);

  document.fonts.ready.then(() => { resize(); frame(); });
}
