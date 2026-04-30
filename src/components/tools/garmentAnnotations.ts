export type Annotation = { anchor: string; label: string; reason: string };

const KEYWORD_ORDER: [string, string][] = [
  ['slip',    'slip-dress'],
  ['bias',    'slip-dress'],
  ['cowl',    'slip-dress'],
  ['blazer',  'blazer'],
  ['jacket',  'cropped-jacket'],
  ['coat',    'oversized-coat'],
  ['trouser', 'trousers'],
  ['pant',    'trousers'],
  ['skirt',   'a-line-skirt'],
  ['dress',   'shirt-dress'],
];

export function init(): void {}

export function clearAnnotations(): void {
  document.querySelectorAll('.gd-annotation-overlay').forEach(el => el.remove());
  document.querySelectorAll('.gd-annotation-labels').forEach(el => el.remove());
}

export function renderAnnotations(annotations: Annotation[]): void {
  const panel = document.querySelector('[data-silhouette-panel]');
  if (!panel) return;

  const activeWrap = Array.from(
    panel.querySelectorAll<HTMLElement>('[data-silhouette]')
  ).find(w => w.style.display !== 'none') as HTMLElement | undefined;
  if (!activeWrap) return;

  activeWrap.querySelector('.gd-annotation-overlay')?.remove();
  activeWrap.querySelectorAll('.gd-annotation-labels').forEach(el => el.remove());
  if (!annotations?.length) return;

  const garmentSvg = activeWrap.querySelector('svg');
  if (!garmentSvg) return;

  const svgRect = garmentSvg.getBoundingClientRect();
  if (!svgRect.width) return;

  // Scale: SVG user units → CSS px. Fonts specified in user units render at target px size.
  const scale = 300 / svgRect.width;
  const lSize = (11 * scale).toFixed(2);
  const rSize = (9.5 * scale).toFixed(2);

  // Dynamic truncation: fit text within the 118-unit label area (x=-128 to x=-10).
  // 0.55 = conservative avg char-width-to-font-size ratio.
  const maxLChars = Math.max(8, Math.floor(118 / (11 * scale * 0.55)));
  const maxRChars = Math.max(8, Math.floor(118 / (9.5 * scale * 0.55)));

  // Resolve and sort anchors top-to-bottom
  type Resolved = Annotation & { cx: number; cy: number };
  const resolved: Resolved[] = [];
  for (const ann of annotations) {
    const circle = activeWrap.querySelector<SVGCircleElement>('#' + ann.anchor);
    if (!circle) continue;
    resolved.push({
      ...ann,
      cx: parseFloat(circle.getAttribute('cx') || '0'),
      cy: parseFloat(circle.getAttribute('cy') || '0'),
    });
  }
  resolved.sort((a, b) => a.cy - b.cy);
  if (!resolved.length) return;

  // Overlay: viewBox extends 130 SVG units left of x=0 (the garment's left edge).
  // width=143.33% (=430/300) keeps the 0–300 range pixel-aligned with the garment SVG.
  // right:0 anchors the overlay's right edge to the wrap's right edge (x=300).
  // preserveAspectRatio xMaxYMin meet places x=300 at SVG element right, x=-130 at left.
  const NS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(NS, 'svg') as SVGSVGElement;
  overlay.setAttribute('viewBox', '-130 0 430 500');
  overlay.setAttribute('preserveAspectRatio', 'xMaxYMin meet');
  overlay.setAttribute('class', 'gd-annotation-overlay');
  overlay.style.cssText =
    'position:absolute;top:0;right:0;width:143.33%;pointer-events:none;opacity:0;transition:opacity 0.3s ease';

  // Label column: text right-edge at x=-10, stacking starts at y=60 with 20-unit gaps
  const LX = -10;
  let labelY = 60;

  for (const ann of resolved) {
    const { cx, cy } = ann;

    // Dot at anchor point
    const dot = document.createElementNS(NS, 'circle') as SVGCircleElement;
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    dot.setAttribute('r', '2.5');
    dot.setAttribute('style', 'fill: var(--muted); opacity: 0.7');
    overlay.appendChild(dot);

    // Leader line from anchor leftward to label column
    const line = document.createElementNS(NS, 'line') as SVGLineElement;
    line.setAttribute('x1', String(cx));
    line.setAttribute('y1', String(cy));
    line.setAttribute('x2', String(LX + 2));
    line.setAttribute('y2', String(labelY));
    line.setAttribute('stroke-width', '0.5');
    line.setAttribute('style', 'stroke: var(--muted); opacity: 0.5');
    overlay.appendChild(line);

    // Label text — right-aligned
    const labelText = ann.label.length > maxLChars
      ? ann.label.slice(0, maxLChars - 1) + '…'
      : ann.label;
    const lEl = document.createElementNS(NS, 'text') as SVGTextElement;
    lEl.setAttribute('x', String(LX));
    lEl.setAttribute('y', String(labelY));
    lEl.setAttribute('font-size', lSize);
    lEl.setAttribute('text-anchor', 'end');
    lEl.setAttribute('style', 'fill: var(--black); font-family: var(--font-body)');
    lEl.textContent = labelText;
    overlay.appendChild(lEl);

    // Reason text — right-aligned, smaller and more muted
    const reasonText = ann.reason.length > maxRChars
      ? ann.reason.slice(0, maxRChars - 1) + '…'
      : ann.reason;
    const rEl = document.createElementNS(NS, 'text') as SVGTextElement;
    rEl.setAttribute('x', String(LX));
    rEl.setAttribute('y', String(labelY + 12));
    rEl.setAttribute('font-size', rSize);
    rEl.setAttribute('text-anchor', 'end');
    rEl.setAttribute('style', 'fill: var(--muted); opacity: 0.6; font-family: var(--font-body)');
    rEl.textContent = reasonText;
    overlay.appendChild(rEl);

    labelY += 20;
  }

  activeWrap.prepend(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => { overlay.style.opacity = '1'; }));
}

export function updateSilhouette(text: string): void {
  const lower = text.toLowerCase();
  let match: string | null = null;
  for (const [kw, sil] of KEYWORD_ORDER) {
    if (lower.includes(kw)) { match = sil; break; }
  }
  const panel = document.querySelector('[data-silhouette-panel]');
  if (!panel) return;
  const placeholder = panel.querySelector<HTMLElement>('[data-silhouette-placeholder]');
  if (placeholder) placeholder.style.display = match ? 'none' : '';
  panel.querySelectorAll<HTMLElement>('[data-silhouette]').forEach(w => {
    w.style.display = w.dataset.silhouette === match ? '' : 'none';
  });
}
