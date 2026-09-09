/* ── COMPONENT INVENTORY ───────────────────────────────────────────
   Counted at build time by scanning the source tree, not maintained
   by hand. A hand-kept inventory is a second source of truth about
   the first one, and it rots the same way a hand-copied palette does:
   silently, while continuing to look authoritative.

   The count is deliberately blunt. It asks how many files mention the
   component's filename, which catches every import path without
   needing to parse them, and it cannot tell a real use from a mention
   in a comment. That is the right tradeoff for a page whose job is to
   say "these five are unreferenced, go look", not to be a linter.
   ───────────────────────────────────────────────────────────────── */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

/** Files that may reference a component. */
const SCANNABLE = /\.(astro|ts|tsx|mdx|js|mjs)$/;

export interface ComponentRecord {
  name: string;
  /** Path relative to src/, e.g. "components/global/Footer.astro". */
  path: string;
  uses: number;
  /** Files that reference it, relative to src/. */
  usedBy: string[];
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Inventory every `.astro` under `src/components`.
 *
 * `ignore` exists for one reason: /system imports components in order to
 * demonstrate them, and a demo is not a use. Counting it would quietly promote
 * a component the moment this page put it in a gallery, which is the inventory
 * measuring itself.
 */
export function componentInventory(ignore: string[] = []): ComponentRecord[] {
  const all = walk(SRC);
  const components = all.filter(
    (f) => f.includes(`${join('src', 'components')}`) && f.endsWith('.astro'),
  );
  const scannable = all.filter((f) => SCANNABLE.test(f));

  return components
    .map((file) => {
      const name = basename(file, '.astro');
      const self = relative(SRC, file);
      const usedBy = scannable
        .map((f) => relative(SRC, f))
        .filter((f) => f !== self && !ignore.includes(f))
        .filter((f) => readFileSync(join(SRC, f), 'utf8').includes(`${name}.astro`));
      return { name, path: self, uses: usedBy.length, usedBy };
    })
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}
