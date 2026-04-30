import { clearAnnotations, renderAnnotations, updateSilhouette } from './garmentAnnotations';
import { getImageBase64, getImageMediaType } from './garmentImageUpload';

const $ = (id: string) => document.getElementById(id);

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
    if (loadingEl) loadingEl.style.display = 'block';
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

      if (loadingEl) loadingEl.style.display = 'none';
      if (outputEl)  outputEl.style.display  = 'grid';
      renderAnnotations(data.annotations || []);

    } catch (e) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl)   emptyEl.style.display   = 'block';
      if (errEl) {
        errEl.textContent = (e as Error)?.message || 'Something went wrong.';
        errEl.style.display = 'block';
      }
    }
  });

  return { validate };
}
