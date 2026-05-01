import { clearAnnotations, renderAnnotations, updateSilhouette } from './garmentAnnotations';
import { getImageBase64, getImageMediaType, getImagePreviewUrl } from './garmentImageUpload';

const $ = (id: string) => document.getElementById(id);

type ImageAnnotation = {
  x: number;
  y: number;
  label: string;
  reason?: string;
};

const presets: Record<string, { garmentType: string; fabric: string; description: string }> = {
  shirtdress: {
    garmentType: 'Shirt dress',
    fabric: 'Cotton poplin',
    description: 'A relaxed shirt dress with a collar, button-front placket, patch pockets, and a self-tie belt. Knee length with a slightly oversized fit through the body.',
  },
  blazer: {
    garmentType: 'Blazer',
    fabric: 'Medium-weight wool suiting',
    description: 'A structured single-breasted blazer with notch lapels, two welt pockets, a chest pocket, and a two-button front. Fully lined with a back vent.',
  },
  'bias-skirt': {
    garmentType: 'Skirt',
    fabric: 'Silk charmeuse',
    description: 'A floor-length bias-cut skirt with a side seam invisible zipper and minimal ease. The bias cut allows the fabric to drape and cling to the body.',
  },
  trousers: {
    garmentType: 'Trousers',
    fabric: 'Lightweight wool crepe',
    description: 'Tailored wide-leg trousers with a flat front, side pockets, and a concealed zip fly with a hook-and-bar closure. Mid-rise with a clean, pressed centre crease.',
  },
};

export function init(): { validate: () => void } {
  const descEl     = $('gd-description')  as HTMLTextAreaElement | null;
  const garmentEl  = $('gd-garment-type') as HTMLInputElement    | null;
  const fabricEl   = $('gd-fabric')       as HTMLInputElement    | null;
  const travelerEl = $('gd-traveler')     as HTMLInputElement    | null;
  const btn        = $('gd-generate')     as HTMLButtonElement   | null;
  const errEl      = $('gd-error');
  const emptyEl    = $('gd-empty');
  const loadingEl  = $('gd-loading');
  const outputEl   = $('gd-output');
  const noteEl     = $('gd-note');

  function setLoading(message?: string): void {
    if (!loadingEl) return;
    const loader = loadingEl.querySelector('[data-loading-state]') as HTMLElement | null;
    const messageEl = loadingEl.querySelector('[data-loading-message]');
    const cleanMessage = message?.trim() || '';
    if (loader) loader.dataset.variant = cleanMessage ? 'progress' : 'stitch';
    if (messageEl) messageEl.textContent = cleanMessage;
    loadingEl.style.display = 'block';
  }

  function loadingMessage(): string {
    const garment = (garmentEl?.value || '').trim();
    const fabric = (fabricEl?.value || '').trim();
    const subject = [fabric, garment].filter(Boolean).join(' ');
    return subject ? `Analyzing construction for ${subject}...` : '';
  }

  function setSilhouetteUpload(isVisible: boolean): void {
    const panel = document.querySelector('[data-silhouette-panel]');
    if (!panel) return;

    const upload = panel.querySelector<HTMLElement>('[data-silhouette-upload]');
    const uploadImage = panel.querySelector<HTMLImageElement>('[data-silhouette-upload-image]');
    const placeholder = panel.querySelector<HTMLElement>('[data-silhouette-placeholder]');
    const previewUrl = getImagePreviewUrl();

    if (isVisible && previewUrl && upload && uploadImage) {
      uploadImage.src = previewUrl;
      upload.style.display = 'flex';
      if (placeholder) placeholder.style.display = 'none';
      panel.querySelectorAll<HTMLElement>('[data-silhouette]').forEach(w => {
        w.style.display = 'none';
      });
      return;
    }

    if (upload) upload.style.display = 'none';
    if (uploadImage) uploadImage.src = '';
    clearImageAnnotations();
    updateSilhouette(garmentEl?.value || '');
  }

  function clearImageAnnotations(): void {
    document.querySelector('[data-image-annotations]')?.replaceChildren();
  }

  function renderImageAnnotations(annotations: ImageAnnotation[]): void {
    const layer = document.querySelector<HTMLElement>('[data-image-annotations]');
    if (!layer) return;
    layer.replaceChildren();

    annotations
      .filter((ann) => Number.isFinite(ann.x) && Number.isFinite(ann.y) && ann.label)
      .slice(0, 5)
      .forEach((ann) => {
        const x = Math.max(4, Math.min(96, ann.x));
        const y = Math.max(4, Math.min(96, ann.y));
        const marker = document.createElement('div');
        const label = document.createElement('span');
        marker.className = 'image-annotation';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        if (x > 72) marker.dataset.edge = 'right';
        if (y > 82) marker.dataset.edge = 'bottom';
        label.textContent = ann.label;
        if (ann.reason) marker.title = ann.reason;
        marker.appendChild(label);
        layer.appendChild(marker);
      });
  }

  function hasLabeledSilhouette(): boolean {
    const panel = document.querySelector('[data-silhouette-panel]');
    if (!panel) return false;
    const activeSilhouette = Array.from(
      panel.querySelectorAll<HTMLElement>('[data-silhouette]')
    ).some(w => w.style.display !== 'none');
    return activeSilhouette && Boolean(panel.querySelector('.gd-annotation-overlay'));
  }

  function validate(): void {
    if (btn) btn.disabled = (descEl?.value || '').trim().length < 20 && !getImageBase64();
  }

  document.querySelector('[data-presets-list]')?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button[data-preset]');
    if (!b) return;
    const p = presets[b.getAttribute('data-preset') || ''];
    if (!p) return;
    if (garmentEl) garmentEl.value = p.garmentType;
    if (fabricEl)  fabricEl.value  = p.fabric;
    if (descEl)    descEl.value    = p.description;
    validate();
    updateSilhouette(p.garmentType);
  });

  descEl?.addEventListener('input', validate);
  garmentEl?.addEventListener('input', () => updateSilhouette(garmentEl.value));
  validate();

  btn?.addEventListener('click', async () => {
    if (errEl)    { errEl.style.display    = 'none'; errEl.textContent = ''; }
    if (emptyEl)   emptyEl.style.display   = 'none';
    if (outputEl)  outputEl.style.display  = 'none';
    setLoading(loadingMessage());
    setSilhouetteUpload(Boolean(getImageBase64()));
    clearImageAnnotations();
    clearAnnotations();

    try {
      const resp = await fetch('/.netlify/functions/garment-decoder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description:    descEl?.value,
          garmentType:    garmentEl?.value,
          fabricType:     fabricEl?.value,
          travelerMode:   travelerEl?.checked,
          imageBase64:    getImageBase64()    ?? undefined,
          imageMediaType: getImageMediaType() ?? undefined,
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      const rawText = await resp.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        if (resp.status === 404) throw new Error("Function not found (404). Make sure you're running `netlify dev` not `astro dev`.");
        if (resp.status === 502 || resp.status === 504) throw new Error('Request timed out — try a shorter description.');
        throw new Error(`Server error ${resp.status}: ${rawText.slice(0, 120)}`);
      }
      if (!resp.ok) throw new Error(data?.error || 'Request failed.');

      if (loadingEl) loadingEl.style.display = 'none';
      if (outputEl)  outputEl.style.display  = 'grid';
      setSilhouetteUpload(false);

      const fbEl = $('gd-fabric-behavior');
      if (fbEl) fbEl.textContent = data.fabric_behavior || '';

      const lining   = data.lining || {};
      const badgeEl  = $('gd-lining-badge');
      const typeEl   = $('gd-lining-type');
      const reasonEl = $('gd-lining-reason');
      if (badgeEl) {
        badgeEl.textContent = lining.recommended ? 'Recommended' : 'Not required';
        badgeEl.className = 'badge ' + (lining.recommended ? 'badge-yes' : 'badge-no');
      }
      if (typeEl)   typeEl.textContent   = lining.type   || '';
      if (reasonEl) reasonEl.textContent = lining.reason || '';

      const seamsEl = $('gd-seams');
      if (seamsEl) {
        seamsEl.innerHTML = '';
        (data.seam_types || []).forEach((s: { name: string; description: string; where_used: string }) => {
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `<div class="card-name">${s.name}</div>
            <div class="card-detail">${s.description}</div>
            <div class="card-meta">${s.where_used}</div>`;
          seamsEl.appendChild(div);
        });
      }

      const interfEl = $('gd-interfacing');
      if (interfEl) {
        interfEl.innerHTML = '';
        (data.interfacing || []).forEach((i: { location: string; weight: string; type: string; reason: string }) => {
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `<div class="card-name">${i.location}</div>
            <div class="card-detail">${i.weight} — ${i.type}</div>
            <div class="card-meta">${i.reason}</div>`;
          interfEl.appendChild(div);
        });
      }

      const closuresEl = $('gd-closures');
      if (closuresEl) {
        closuresEl.innerHTML = '';
        (data.closure_options || []).forEach((c: { type: string; pros: string; cons: string; best_for: string }) => {
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `<div class="card-name">${c.type}</div>
            <div class="card-detail">↑ ${c.pros}</div>
            <div class="card-detail">↓ ${c.cons}</div>
            <div class="card-meta">Best for: ${c.best_for}</div>`;
          closuresEl.appendChild(div);
        });
      }

      const orderEl = $('gd-order');
      if (orderEl) {
        orderEl.innerHTML = '';
        (data.construction_order || []).forEach((step: string) => {
          const li = document.createElement('li');
          li.textContent = step;
          orderEl.appendChild(li);
        });
      }

      const notesEl = $('gd-notes');
      if (notesEl) {
        notesEl.innerHTML = '';
        (data.construction_notes || []).forEach((n: string) => {
          const li = document.createElement('li');
          li.textContent = n;
          notesEl.appendChild(li);
        });
      }

      const travelerSection = $('gd-traveler-section');
      const travelerNotesEl = $('gd-traveler-notes');
      const tNotes = data.traveler_notes || [];
      if (travelerSection) {
        travelerSection.style.display = tNotes.length > 0 ? 'block' : 'none';
      }
      if (travelerNotesEl) {
        travelerNotesEl.innerHTML = '';
        tNotes.forEach((n: string) => {
          const li = document.createElement('li');
          li.textContent = n;
          travelerNotesEl.appendChild(li);
        });
      }

      if (noteEl) {
        if (data.note) {
          noteEl.textContent = data.note;
          noteEl.style.display = 'block';
        } else {
          noteEl.style.display = 'none';
        }
      }

      renderAnnotations(data.annotations || []);
      if (getImageBase64() && !hasLabeledSilhouette()) {
        setSilhouetteUpload(true);
        renderImageAnnotations(data.image_annotations || []);
      }

    } catch (e) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl)   emptyEl.style.display   = 'block';
      setSilhouetteUpload(false);
      if (errEl) {
        errEl.textContent = (e as Error)?.message || 'Something went wrong.';
        errEl.style.display = 'block';
      }
    }
  });

  return { validate };
}
