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
  pos: { ox: '#6B1621', oxDeep: '#3A0810', print: '#A6C8E8', tone: '#C9A227' },
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
  const msgEl = root.querySelector<HTMLElement>('.dk-msg');
  const linkEl = root.querySelector<HTMLAnchorElement>('.dk-link');
  if (!view || !nameEl || !curEl || !hintEl || !msgEl || !linkEl) return;

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

  /* ── letters as spring bodies ── */
  const L: Letter[] = [];
  ['KAREN', 'DETTMAR'].forEach((word, li) => {
    const line = nameEl.querySelector<HTMLElement>(`.dk-line[data-l="${li}"]`);
    if (!line) return;
    [...word].forEach((ch, i) => {
      const el = document.createElement('span');
      el.className = 'dk-ltr';
      el.textContent = ch;
      // Adjacent flat-topped letters (the TT in DETTMAR) run their crossbars
      // together into one horizontal bar — give the pair a little air.
      if (i > 0 && ch === 'T' && word[i - 1] === 'T') el.style.marginLeft = '0.06em';
      line.appendChild(el);
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
    lineGapTarget = on ? 42 : 0;
    linkEl!.style.opacity = on ? '1' : '0';
    linkEl!.style.pointerEvents = on ? 'auto' : 'none';
    linkEl!.tabIndex = on ? 0 : -1;
    linkEl!.setAttribute('aria-hidden', on ? 'false' : 'true');
    nameEl!.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  nameEl.addEventListener('pointerdown', (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.dk-link')) return;
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
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  nameEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(!revealed); }
  });
  nameEl.addEventListener('mouseenter', () => { heatTarget = 1; });
  nameEl.addEventListener('mouseleave', () => { heatTarget = 0; });
  nameEl.addEventListener('focus', () => { heatTarget = 1; });
  nameEl.addEventListener('blur', () => { heatTarget = 0; });

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
     Placeholder botanicals. These are meant to be replaced with photograms of
     Karen's own objects — swap this for a drawImage of an SVG/PNG when they exist. */
  function drawUnderTo(c: CanvasRenderingContext2D, color: string) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W * DPR, H * DPR);
    c.scale(DPR, DPR);
    c.lineCap = 'round';
    const stems = [
      { x: W * 0.110, h: 0.50, lean: 22, n: 6, r: 26 },
      { x: W * 0.200, h: 0.36, lean: -14, n: 5, r: 19 },
      { x: W * 0.055, h: 0.28, lean: 10, n: 5, r: 16 },
      { x: W * 0.880, h: 0.54, lean: -20, n: 6, r: 28 },
      { x: W * 0.945, h: 0.38, lean: 15, n: 5, r: 20 },
      { x: W * 0.795, h: 0.26, lean: -8, n: 5, r: 15 },
    ];
    for (const s of stems) {
      const y0 = H * 1.03, y1 = H * (1 - s.h);
      c.strokeStyle = color; c.fillStyle = color;
      c.globalAlpha = .40; c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(s.x, y0);
      c.quadraticCurveTo(s.x + s.lean * 2.2, (y0 + y1) / 2, s.x + s.lean, y1);
      c.stroke();
      c.globalAlpha = .30;
      [0.34, 0.58].forEach((t, li) => {
        const lxp = s.x + s.lean * t, lyp = y0 + (y1 - y0) * t, dir = li % 2 ? 1 : -1;
        c.beginPath();
        c.ellipse(lxp + dir * 17, lyp, 21, 7, dir * 0.5, 0, Math.PI * 2);
        c.fill();
      });
      const bx = s.x + s.lean, by = y1;
      c.globalAlpha = .34;
      for (let p = 0; p < s.n; p++) {
        const a = (p / s.n) * Math.PI * 2 + s.lean;
        c.beginPath();
        c.ellipse(bx + Math.cos(a) * s.r * .62, by + Math.sin(a) * s.r * .62, s.r * .56, s.r * .30, a, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = .46;
      c.beginPath(); c.arc(bx, by, s.r * .28, 0, Math.PI * 2); c.fill();
    }
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
      ([[0.13, 0.62], [0.09, 0.80], [0.19, 0.72], [0.88, 0.60], [0.93, 0.78], [0.81, 0.84]] as const)
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
