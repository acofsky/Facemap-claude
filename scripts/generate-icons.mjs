#!/usr/bin/env node
/**
 * Renders brand/membr-icon.svg to the PNGs the iOS app + web manifest need.
 * Run on demand when the brand SVG changes:
 *   npm run build:icons
 *
 * Codemagic does NOT run this — the resulting PNGs are checked into git.
 * That keeps `sharp` out of the production install path.
 */
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = join(ROOT, 'brand', 'membr-icon.svg');

const TARGETS = [
  { path: join(ROOT, 'public', 'app-icon.png'), size: 1024 },
  { path: join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'), size: 1024 },
];

const svg = await fs.readFile(SOURCE);

for (const { path, size } of TARGETS) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    // iOS icons must be RGB (no alpha). Flatten onto the icon's own black bg.
    .flatten({ background: '#000000' })
    .png({ compressionLevel: 9 })
    .toFile(path);
  const stat = await fs.stat(path);
  console.log(`  ${path}  (${size}×${size}, ${(stat.size / 1024).toFixed(1)} KB)`);
}

console.log(`\nDone. ${TARGETS.length} icons generated from ${SOURCE.replace(ROOT + '/', '')}`);
