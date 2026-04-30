import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const IMAGES_DIR = new URL('../public/images', import.meta.url).pathname;
const MAP_FILE   = new URL('./cloudinary-map.json', import.meta.url).pathname;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else if (IMAGE_EXTS.has(extname(name).toLowerCase())) {
      entries.push(full);
    }
  }
  return entries;
}

function toPublicPath(absPath) {
  // absPath: /…/public/images/traveller/Look1.png → /images/traveller/Look1.png
  const rel = relative(join(IMAGES_DIR, '..'), absPath);
  return '/' + rel.replace(/\\/g, '/');
}

function toPublicId(absPath) {
  // e.g. /…/public/images/blockprint/Portugal tiles.jpg → portfolio/blockprint/portugal-tiles-jpg
  // Spaces → hyphens; extension dot → hyphen suffix to prevent collisions across formats.
  const rel = relative(IMAGES_DIR, absPath).replace(/\\/g, '/');
  const normalized = rel
    .replace(/ /g, '-')
    .replace(/\.([^/.]+)$/, (_, ext) => `-${ext.toLowerCase()}`);
  return `portfolio/${normalized}`;
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Missing Cloudinary env vars. Copy .env.example and fill in credentials.');
    process.exit(1);
  }

  const map = existsSync(MAP_FILE)
    ? JSON.parse(readFileSync(MAP_FILE, 'utf-8'))
    : {};

  const files = walk(IMAGES_DIR);
  console.log(`Found ${files.length} images. ${Object.keys(map).length} already uploaded.`);

  let uploaded = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const file of files) {
    const publicPath = toPublicPath(file);
    const publicId   = toPublicId(file);

    if (map[publicPath]) {
      skipped++;
      continue;
    }

    try {
      const result = await cloudinary.uploader.upload(file, {
        public_id:     publicId,
        overwrite:     false,
        resource_type: 'image',
      });
      const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`;
      map[publicPath] = url;
      writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
      console.log(`✓ ${publicPath}`);
      uploaded++;
    } catch (err) {
      console.error(`✗ ${publicPath}: ${err.message}`);
      failed++;
    }
  }

  writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
  console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Map written to scripts/cloudinary-map.json`);
}

main();
