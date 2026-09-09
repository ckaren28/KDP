/* ── READING THE SYSTEM OFF THE SYSTEM ─────────────────────────────
   Every value on /system is parsed out of the real `tokens.css` at
   build time, never retyped into a docs page. A design system page
   that keeps its own copy of the palette is a design system page
   that is wrong within a month, and the failure is silent: the docs
   keep looking right while the site drifts away from them.

   The parse is deliberately dumb. It reads declarations and the
   comment that sits beside them, and it does not resolve `var()`
   or evaluate `clamp()`, because the point is to show what an author
   actually wrote, not what a browser computes.
   ───────────────────────────────────────────────────────────────── */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Token {
  /** Custom property name, without the leading `--`. */
  name: string;
  value: string;
  /** The trailing `/* … *\/` on the same line, if the author left one. */
  note?: string;
}

/** One `:root`-ish block, keyed by the selector that opened it. */
interface Block {
  selector: string;
  tokens: Token[];
}

const DECL = /^\s*--([\w-]+)\s*:\s*([^;]+?)\s*;(?:\s*\/\*\s*(.*?)\s*\*\/)?/;

function parseBlocks(css: string): Block[] {
  // Strip block comments that sit on their own lines, so the section banners
  // in tokens.css don't get mistaken for declarations. Trailing comments are
  // captured by DECL before this ever runs, since we work line by line.
  const blocks: Block[] = [];
  let current: Block | null = null;
  let depth = 0;

  for (const raw of css.split('\n')) {
    const line = raw.replace(/\/\*(?![^*]*--)[\s\S]*?\*\//g, (m) =>
      // keep trailing comments attached to a declaration, drop banner comments
      /^\s*\/\*/.test(raw) ? '' : m,
    );

    const open = line.indexOf('{');
    if (open !== -1 && depth === 0) {
      const selector = line.slice(0, open).trim();
      // A selector can repeat: tokens.css opens `:root` three times, once for
      // color, once for the type scale, once for space. Merge them.
      current = blocks.find((b) => b.selector === selector) ?? null;
      if (!current) {
        current = { selector, tokens: [] };
        blocks.push(current);
      }
      depth++;
      continue;
    }
    if (line.includes('{')) depth++;
    if (line.includes('}')) {
      depth--;
      if (depth <= 0) {
        depth = 0;
        current = null;
      }
      continue;
    }

    const m = DECL.exec(line);
    if (m && current) {
      current.tokens.push({ name: m[1], value: m[2], note: m[3] || undefined });
    }
  }

  return blocks;
}

/** Read a tokens.css relative to this repo and split it by selector. */
export function readTokens(relativePath: string): Block[] {
  const path = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
  return parseBlocks(readFileSync(path, 'utf8'));
}

/**
 * Read the first of `candidates` that exists, and say which one it was.
 *
 * The studio palette lives in a separate repo, and Netlify checks out one
 * repo, so a build there cannot see the sibling working tree. Any local build
 * can, and should prefer it. The page prints the source it got, because a
 * snapshot presented as live would be exactly the silent drift this whole
 * page argues against.
 */
export function readTokensPreferring(
  candidates: { path: string; label: string; live: boolean }[],
): { blocks: Block[]; source: { label: string; live: boolean } } {
  for (const c of candidates) {
    try {
      return { blocks: readTokens(c.path), source: { label: c.label, live: c.live } };
    } catch {
      continue;
    }
  }
  throw new Error(`No tokens file found. Tried: ${candidates.map((c) => c.path).join(', ')}`);
}

export function tokensFor(blocks: Block[], selector: string): Token[] {
  return blocks.find((b) => b.selector === selector)?.tokens ?? [];
}

export function byName(tokens: Token[], name: string): Token | undefined {
  return tokens.find((t) => t.name === name);
}

/** Tokens whose value is a literal color we can actually measure. */
export function colorTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => /^(#|rgba?\()/.test(t.value));
}

/* ── CONTRAST ──────────────────────────────────────────────────────
   WCAG 2.1 relative luminance. Computed here rather than checked once
   by hand and written down, so that changing a hex in tokens.css moves
   the number on the page. A pair that stops passing starts failing in
   public, which is the only version of this page worth publishing.
   ───────────────────────────────────────────────────────────────── */

/** Parse #rgb, #rrggbb, rgb() and rgba() into 0-255 channels plus alpha. */
export function parseColor(input: string): { r: number; g: number; b: number; a: number } | null {
  const v = input.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const fn = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (fn) {
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  return null;
}

/**
 * Flatten a translucent color onto an opaque backdrop. `--border` and
 * `--text-body` are both rgba in at least one theme, and a ratio computed
 * against their raw channels would describe a color nobody ever sees.
 */
export function composite(
  fg: { r: number; g: number; b: number; a: number },
  bg: { r: number; g: number; b: number; a: number },
) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

export function luminance(c: { r: number; g: number; b: number }): number {
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
}

/** WCAG contrast ratio, 1 to 21, with any alpha flattened onto `bg` first. */
export function contrast(foreground: string, background: string): number | null {
  const bg = parseColor(background);
  const fgRaw = parseColor(foreground);
  if (!bg || !fgRaw) return null;
  const fg = fgRaw.a < 1 ? composite(fgRaw, bg) : fgRaw;
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export type Grade = 'AAA' | 'AA' | 'AA Large' | 'Fail';

/**
 * Grade a ratio against the threshold for the role the token actually plays.
 * `large` is 18.66px+ regular or 14px+ bold. The studio site's tokens.css
 * records why this distinction matters there: `--muted` and `--sienna` both
 * carry 10px uppercase labels, so they are held to 4.5:1 and not 3:1.
 */
export function grade(ratio: number, large = false): Grade {
  if (large) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA Large';
    return 'Fail';
  }
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

export const fmt = (ratio: number) => `${ratio.toFixed(2)}:1`;
