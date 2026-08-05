/**
 * Make a print.
 *
 * Type "print" anywhere and the visible page is captured to a PNG and
 * downloaded — the darkroom equivalent of pulling a sheet. Nothing announces
 * it; it's the site's easter egg.
 *
 * The capture library loads on demand, so visitors who never type it pay
 * nothing for it.
 *
 * Note on fonts: html-to-image inlines webfonts by walking
 * document.styleSheets and reading cssRules, which throws a SecurityError on
 * a cross-origin sheet — and ours come from fonts.googleapis.com. So we embed
 * the font CSS ourselves when we can, and fall back to a font-less capture
 * rather than failing outright.
 */

const WORD = 'print';

function toast(text: string) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.dataset.noPrint = 'true';
  el.textContent = text;
  el.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:14vh', 'transform:translateX(-50%)',
    'z-index:9999', 'pointer-events:none', 'max-width:80vw', 'text-align:center',
    'font-family:"Space Mono",ui-monospace,monospace', 'font-size:11px',
    'letter-spacing:.2em', 'text-transform:uppercase',
    'padding:10px 18px', 'border-radius:100px',
    'background:rgba(58,8,16,.9)', 'color:#D7E3EE',
    'opacity:0', 'transition:opacity .3s ease',
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  return el;
}
function fade(el: HTMLElement, after = 2400) {
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, after);
}

/** Fetch the Google Fonts CSS and inline the font files as data URIs. */
async function buildFontCss(): Promise<string> {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')
  );
  const sheets = await Promise.all(links.map(async (l) => {
    try {
      const res = await fetch(l.href);
      if (!res.ok) return '';
      return await res.text();
    } catch { return ''; }
  }));

  let css = sheets.join('\n');
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com[^)"']+/g) ?? [])];

  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      css = css.split(url).join(`data:font/woff2;base64,${btoa(bin)}`);
    } catch { /* leave the remote url in place */ }
  }));

  return css;
}

const skip = (node: Node) =>
  !(node instanceof HTMLElement && node.dataset.noPrint === 'true');

async function makePrint() {
  const note = toast('developing…');
  const slug = location.pathname.replace(/\/+$/, '').split('/').pop() || 'index';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const bg = getComputedStyle(document.body).backgroundColor || undefined;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  try {
    const { toPng } = await import('html-to-image');

    let dataUrl = '';
    try {
      // preferred: real typography, fonts inlined by us
      const fontEmbedCSS = await buildFontCss();
      dataUrl = await toPng(document.body, { pixelRatio, backgroundColor: bg, filter: skip, fontEmbedCSS });
    } catch (inner) {
      console.warn('[print] font-embedded capture failed, retrying without fonts', inner);
      dataUrl = await toPng(document.body, { pixelRatio, backgroundColor: bg, filter: skip, skipFonts: true });
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `karendettmar-${slug}-${stamp}.png`;
    a.click();

    note.textContent = 'print made';
    fade(note);
  } catch (err) {
    console.error('[print] capture failed', err);
    const msg = err instanceof Error ? err.message : String(err);
    note.textContent = `print failed — ${msg.slice(0, 90)}`;
    fade(note, 6000);
  }
}

export function initPrintEgg() {
  let buf = '';
  let busy = false;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-WORD.length);
    if (buf === WORD && !busy) {
      busy = true;
      makePrint().finally(() => { busy = false; });
    }
  });
}
