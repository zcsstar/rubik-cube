// pwa-assets-generator writes its outputs next to the source image
// (store-assets/app-icon-master.png), but our PWA manifest references
// them from public/. Move them across after generation. Cross-platform
// Node so the npm script works on Windows / mac / linux.
import { renameSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'store-assets';
const DST = 'public';
const FILES = [
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon-180x180.png',
  'favicon.ico',
];

if (!existsSync(DST)) mkdirSync(DST, { recursive: true });

for (const f of FILES) {
  const from = join(SRC, f);
  const to = join(DST, f);
  if (existsSync(from)) {
    renameSync(from, to);
    console.log(`moved ${from} -> ${to}`);
  }
}
