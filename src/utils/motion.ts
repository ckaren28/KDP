/* ── MOTION CENSUS ─────────────────────────────────────────────────
   Colour, type, space and line are tokens. Motion is not: it is a
   convention held by hand across the stylesheets, and conventions held
   by hand drift. Rather than assert that on /system, this counts it,
   so the number moves when the code does and the claim cannot go stale
   in the direction that flatters it.
   ───────────────────────────────────────────────────────────────── */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const SCANNABLE = /\.(astro|css|ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCANNABLE.test(full)) out.push(full);
  }
  return out;
}

const corpus = () => walk(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');

export interface EasingRecord {
  /** Canonical form, spaces stripped and leading zeros restored. */
  canonical: string;
  /** Every literal spelling found, with its own count. */
  spellings: { text: string; count: number }[];
  total: number;
}

/** Normalize `.2` to `0.2` and drop whitespace, so spellings of one curve group. */
function canonicalize(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/(^|[(,])\./g, '$10.');
}

export function easingCensus(): EasingRecord[] {
  const text = corpus();
  const found = text.match(/cubic-bezier\([^)]*\)/g) ?? [];

  const groups = new Map<string, Map<string, number>>();
  for (const raw of found) {
    const key = canonicalize(raw);
    if (!groups.has(key)) groups.set(key, new Map());
    const spellings = groups.get(key)!;
    spellings.set(raw, (spellings.get(raw) ?? 0) + 1);
  }

  return [...groups.entries()]
    .map(([canonical, spellings]) => ({
      canonical,
      spellings: [...spellings.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count),
      total: [...spellings.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Distinct transition/animation durations, most used first. */
export function durationCensus(): { value: string; count: number }[] {
  const found = corpus().match(/(?<![\w.])\d*\.?\d+s(?=\s|,|;|\)|$)/gm) ?? [];
  const counts = new Map<string, number>();
  for (const raw of found) {
    const v = raw.replace(/^\./, '0.');
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Every place the reduced-motion preference is honored, found by scanning.
 *
 * This file and /system are excluded: both mention the query only in order to
 * talk about it, and a census that counts its own prose is measuring itself.
 */
const NOT_A_SITE = ['utils/motion.ts', 'pages/system.astro'];

export function reducedMotionSites(): { path: string; kind: 'CSS' | 'JS' }[] {
  return walk(SRC)
    .filter((f) => !NOT_A_SITE.includes(f.slice(SRC.length + 1)))
    .filter((f) => readFileSync(f, 'utf8').includes('prefers-reduced-motion'))
    .map((f) => ({
      path: f.slice(SRC.length + 1),
      kind: f.endsWith('.css') ? ('CSS' as const) : ('JS' as const),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
}
