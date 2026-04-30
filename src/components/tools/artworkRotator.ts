export function init(): void {
  const MET_SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=painting';
  const MET_OBJ    = (id: number) => `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
  const TARGET     = 5;
  const POOL       = 20;

  const stage          = document.getElementById('artworkStage')        as HTMLElement | null;
  const loader         = document.getElementById('artworkLoading')      as HTMLElement | null;
  const caption        = document.getElementById('artworkCaption')      as HTMLElement | null;
  const frameWrap      = document.getElementById('artworkFrameWrap')    as HTMLElement | null;
  const pauseIndicator = document.getElementById('artworkPauseIndicator') as HTMLElement | null;

  const imgA = document.createElement('img');
  const imgB = document.createElement('img');
  for (const img of [imgA, imgB]) {
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 0.9s ease;opacity:0;';
    stage?.appendChild(img);
  }
  let front = imgA;
  let back  = imgB;

  interface Artwork { url: string; title: string; artist: string; date: string; medium: string; }
  let artworks: Artwork[] = [];
  let current  = 0;
  let timer: number | null = null;
  let paused      = false;
  let clickPaused = false;

  function setPaused(state: boolean) {
    paused = state;
    if (pauseIndicator) pauseIndicator.style.opacity = state ? '1' : '0';
  }

  function captionText(a: Artwork): string {
    const meta = [a.artist, a.date].filter(Boolean).join(', ');
    return [a.title, meta].filter(Boolean).join(' — ');
  }

  function updateHeaderCard(a: Artwork) {
    const wlcTitle = document.getElementById('wlc-title');
    const wlcMeta  = document.getElementById('wlc-meta');
    if (wlcTitle) wlcTitle.textContent = a.title || 'Untitled';
    if (wlcMeta) {
      const parts = [a.artist, a.date, a.medium].filter(Boolean);
      wlcMeta.textContent = parts.length ? parts.join(' · ') : 'Artist unknown';
    }
  }

  function showArtwork(index: number, instant = false) {
    const a = artworks[index];
    if (!a) return;
    back.src = a.url;

    function reveal() {
      front.style.opacity = '0';
      back.style.opacity  = '1';
      if (caption) {
        caption.style.opacity = '0';
        setTimeout(() => {
          caption!.textContent = captionText(a);
          caption!.style.opacity = '1';
        }, 450);
      }
      updateHeaderCard(a);
      [front, back] = [back, front];
    }

    if (instant || back.complete) {
      reveal();
    } else {
      back.addEventListener('load',  reveal, { once: true });
      back.addEventListener('error', reveal, { once: true });
    }
  }

  function advance() {
    if (paused || artworks.length < 2) return;
    current = (current + 1) % artworks.length;
    showArtwork(current);
  }

  function startCycle() {
    if (timer !== null) clearInterval(timer);
    timer = window.setInterval(advance, 4000);
  }

  frameWrap?.addEventListener('mouseenter', () => { if (!clickPaused) paused = true; });
  frameWrap?.addEventListener('mouseleave', () => { if (!clickPaused) paused = false; });
  frameWrap?.addEventListener('click',    () => { clickPaused = true;  setPaused(true);  });
  frameWrap?.addEventListener('dblclick', () => { clickPaused = false; setPaused(false); });

  async function fetchArtwork(id: number): Promise<Artwork> {
    const resp = await fetch(MET_OBJ(id));
    if (!resp.ok) throw new Error(`${resp.status}`);
    const d = await resp.json();
    if (!d.primaryImage) throw new Error('no image');
    return {
      url:    d.primaryImage       as string,
      title:  (d.title             || 'Untitled') as string,
      artist: (d.artistDisplayName || '')         as string,
      date:   (d.objectDate        || '')         as string,
      medium: (d.medium            || '')         as string,
    };
  }

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function startFetching() {
    let pool: number[] = [];
    try {
      const sr = await fetch(MET_SEARCH);
      const sd = await sr.json();
      pool = shuffle((sd.objectIDs as number[]) || []).slice(0, POOL);
    } catch {
      return;
    }

    for (const id of pool) {
      if (artworks.length >= TARGET) break;
      try {
        const a = await fetchArtwork(id);
        artworks.push(a);
        if (artworks.length === 1) {
          loader?.setAttribute('data-hidden', '');
          showArtwork(0, true);
        }
      } catch {
        // skip failed fetches
      }
    }

    if (artworks.length >= 2) startCycle();
  }

  startFetching();
}
