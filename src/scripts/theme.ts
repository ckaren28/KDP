/**
 * Theme, switched by typing.
 *
 * There is no visible toggle — type "light" or "dark" anywhere on the site.
 * The choice persists in localStorage and wins over a page's own default,
 * so once you've picked, every page follows.
 */

export type Theme = 'light' | 'dark';

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: t }));
}

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function initThemeTyping() {
  let buf = '';
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-5);
    if (buf.endsWith('light')) applyTheme('light');
    else if (buf.endsWith('dark')) applyTheme('dark');
  });
}
