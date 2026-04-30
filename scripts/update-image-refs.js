import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = new URL('..', import.meta.url).pathname;
const MAP_FILE = new URL('./cloudinary-map.json', import.meta.url).pathname;
const SRC_DIR  = join(ROOT, 'src');
const CLOUD    = 'deqij2maw';
const APPLY    = process.argv.includes('--apply');

const rawMap = JSON.parse(readFileSync(MAP_FILE, 'utf-8'));

// Build replacement map: local path → full Cloudinary URL with transforms.
// Encode each path segment individually to handle spaces and special chars.
function toCloudinaryUrl(publicId) {
  const encodedId = publicId
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_1600/${encodedId}`;
}

// rawMap values are already full URLs (without transforms); extract the public ID.
// Value format: https://res.cloudinary.com/deqij2maw/image/upload/portfolio/...
function extractPublicId(url) {
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : null;
}

const replacements = new Map();
for (const [localPath, cloudUrl] of Object.entries(rawMap)) {
  const publicId = extractPublicId(cloudUrl);
  if (publicId) {
    replacements.set(localPath, toCloudinaryUrl(publicId));
  }
}

// Collect all .mdx and .astro files under src/
function walkSrc(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walkSrc(full));
    } else if (['.mdx', '.astro'].includes(extname(name))) {
      files.push(full);
    }
  }
  return files;
}

const srcFiles = walkSrc(SRC_DIR);
let totalReplacements = 0;
let affectedFiles = 0;

for (const file of srcFiles) {
  const original = readFileSync(file, 'utf-8');
  let updated = original;

  const fileReplacements = [];

  for (const [localPath, cdnUrl] of replacements) {
    if (updated.includes(localPath)) {
      const count = (updated.split(localPath).length - 1);
      fileReplacements.push({ localPath, cdnUrl, count });
      updated = updated.replaceAll(localPath, cdnUrl);
    }
  }

  if (fileReplacements.length === 0) continue;

  const relPath = file.replace(ROOT, '');
  affectedFiles++;
  totalReplacements += fileReplacements.reduce((s, r) => s + r.count, 0);

  if (APPLY) {
    writeFileSync(file, updated);
    console.log(`✓ ${relPath}`);
    for (const r of fileReplacements) {
      console.log(`    ${r.localPath} (×${r.count})`);
    }
  } else {
    console.log(`[dry-run] ${relPath}`);
    for (const r of fileReplacements) {
      console.log(`    ${r.localPath} → ${r.cdnUrl}`);
    }
  }
}

console.log(
  `\n${APPLY ? 'Applied' : 'Dry-run'}: ${totalReplacements} replacement(s) across ${affectedFiles} file(s).`
);
if (!APPLY) {
  console.log('Run with --apply to write changes.');
}
