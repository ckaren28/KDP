/**
 * Click-to-copy on every email link.
 *
 * The address is easier to paste than to retype, and a mail client opening
 * unasked is rarely what someone wants from a portfolio. So a plain click
 * copies and says so, while the href stays `mailto:`, which means the link
 * still works with no JavaScript, still opens in a mail client from the context
 * menu, and still reads as an email address to a screen reader.
 *
 * If the clipboard isn't available (an insecure context, an old browser) none of
 * this is wired at all and the link is left exactly as it was. A decorative
 * enhancement never removes the thing it decorates.
 */

const HOLD_MS = 1700;

let tip: HTMLElement | null = null;
let live: HTMLElement | null = null;
let hideTimer = 0;
let current: HTMLAnchorElement | null = null;

function build() {
  tip = document.createElement('div');
  tip.id = 'copyEmailTip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  tip.style.cssText = [
    'position:fixed',
    'z-index:9994',
    'pointer-events:none',
    'padding:7px 11px 8px',
    'border-radius:4px',
    'text-align:center',
    'line-height:1.35',
    'white-space:nowrap',
    'opacity:0',
    'transform:translateY(3px)',
    'transition:opacity .16s ease, transform .16s ease',
  ].join(';');
  document.body.appendChild(tip);

  // The tooltip is decoration a screen reader shouldn't have to poll; the
  // outcome of a copy is what actually needs announcing.
  live = document.createElement('p');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
  document.body.appendChild(live);
}

/** Read the page's own colors each time, so it follows the theme and the two
    very different grounds this site has without a second copy of the palette. */
function paint() {
  if (!tip) return;
  const cs = getComputedStyle(document.body);
  tip.style.background = cs.backgroundColor;
  tip.style.color = cs.color;
  tip.style.fontFamily = cs.fontFamily;
  tip.style.border = `1px solid color-mix(in srgb, ${cs.color} 26%, transparent)`;
  tip.style.boxShadow = '0 6px 20px rgba(0,0,0,.22)';
}

function show(link: HTMLAnchorElement, label: string, address: string) {
  if (!tip) return;
  window.clearTimeout(hideTimer);
  current = link;

  tip.innerHTML = '';
  const line = document.createElement('span');
  line.textContent = label;
  line.style.cssText = 'display:block;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase';
  const addr = document.createElement('span');
  addr.textContent = address;
  addr.style.cssText = 'display:block;font-size:11.5px;letter-spacing:.01em;opacity:.66;margin-top:3px';
  tip.appendChild(line);
  tip.appendChild(addr);

  paint();
  tip.hidden = false;
  link.setAttribute('aria-describedby', 'copyEmailTip');

  // Measure after it's in flow, then place it above the link, or below when
  // the link is close enough to the top of the window that above would clip.
  const r = link.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  let top = r.top - t.height - 9;
  if (top < 8) top = r.bottom + 9;
  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;

  requestAnimationFrame(() => {
    if (!tip) return;
    tip.style.opacity = '1';
    tip.style.transform = 'translateY(0)';
  });
}

function hide() {
  if (!tip) return;
  window.clearTimeout(hideTimer);
  tip.style.opacity = '0';
  tip.style.transform = 'translateY(3px)';
  current?.removeAttribute('aria-describedby');
  current = null;
  hideTimer = window.setTimeout(() => { if (tip) tip.hidden = true; }, 180);
}

export function initCopyEmail() {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]'),
  );
  if (!links.length) return;
  // No clipboard, no enhancement, so the mailto is left to do its job.
  if (!navigator.clipboard?.writeText) return;

  build();

  for (const link of links) {
    const address = decodeURIComponent(
      (link.getAttribute('href') || '').replace(/^mailto:/i, '').split('?')[0],
    );
    if (!address) continue;

    const enter = () => show(link, 'Click to copy', address);
    link.addEventListener('pointerenter', (e) => {
      // Touch has no hover; a tap should just copy, not park a tooltip.
      if ((e as PointerEvent).pointerType === 'mouse') enter();
    });
    link.addEventListener('pointerleave', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') hide();
    });
    link.addEventListener('focus', enter);
    link.addEventListener('blur', hide);

    link.addEventListener('click', (e) => {
      // The browser keeps the modified clicks, and anything that wants the mail
      // client can still get it from the context menu.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();

      navigator.clipboard.writeText(address).then(
        () => {
          show(link, 'Copied', address);
          if (live) live.textContent = `${address} copied to the clipboard`;
          window.clearTimeout(hideTimer);
          hideTimer = window.setTimeout(hide, HOLD_MS);
        },
        () => {
          // Denied or unavailable at the last moment, so fall back to what the
          // link said it would do rather than silently doing nothing.
          window.location.href = link.href;
        },
      );
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) hide();
  });
  // A tooltip pinned to a viewport position goes stale the moment the page moves.
  window.addEventListener('scroll', () => { if (current) hide(); }, { passive: true });
  window.addEventListener('themechange', paint);
}
