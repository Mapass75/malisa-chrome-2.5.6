#!/usr/bin/env node
/**
 * Regenerate extension icons from the master source image.
 * Requires: npm install   (sharp is a devDependency)
 *
 *   node scripts/generate-icons.mjs
 *
 * Reads assets/malisa-source.png and writes PNGs at the sizes declared in
 * manifest.json (16/32/48/128). Output is deterministic for a given source.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'malisa-source.png');
const SIZES = [16, 32, 48, 128];

for (const size of SIZES) {
  const out = join(ROOT, 'icons', `icon${size}.png`);
  mkdirSync(dirname(out), { recursive: true });
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`icons/icon${size}.png`);
}
