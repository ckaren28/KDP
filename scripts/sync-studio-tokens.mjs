/* Refresh src/data/studio-tokens.css from the sibling fashion-studio checkout.
 *
 *   npm run sync:studio-tokens          refresh the snapshot
 *   npm run sync:studio-tokens -- --check   exit 1 if it is stale
 *
 * The --check form is the useful one: it turns silent drift between the two
 * repos into a failure someone has to look at. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE   = fileURLToPath(new URL('../../fashion-studio/src/styles/tokens.css', import.meta.url));
const SNAPSHOT = fileURLToPath(new URL('../src/data/studio-tokens.css', import.meta.url));
const check    = process.argv.includes('--check');

if (!existsSync(SOURCE)) {
  console.error(`No sibling checkout at ${SOURCE}\nClone ckaren28/fashion-studio beside this repo to sync.`);
  process.exit(check ? 0 : 1); // in CI there is nothing to check against
}

const header = readFileSync(SNAPSHOT, 'utf8').split('*/')[0] + '*/\n\n';
const next   = header + readFileSync(SOURCE, 'utf8');
const now    = readFileSync(SNAPSHOT, 'utf8');

if (next === now) {
  console.log('studio-tokens.css is current.');
  process.exit(0);
}
if (check) {
  console.error('studio-tokens.css is STALE. Run: npm run sync:studio-tokens');
  process.exit(1);
}
writeFileSync(SNAPSHOT, next);
console.log('studio-tokens.css refreshed from the sibling checkout.');
