import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Source SVG (public/logo.svg) is rasterised into the icons referenced by
 * the manifest. Run once via `npx pwa-assets-generator` and commit the
 * generated PNGs — no build-time cost.
 *
 * The minimal-2023 preset produces:
 *   - favicon.ico (multi-size)
 *   - apple-touch-icon-180.png
 *   - pwa-64x64.png, pwa-192x192.png, pwa-512x512.png
 *   - maskable-icon-512.png
 */
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
});
