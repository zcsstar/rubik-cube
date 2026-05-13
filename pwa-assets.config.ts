import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Source raster (store-assets/app-icon-master.png — the same 1024+ master
 * @capacitor/assets uses) is downsampled into the PWA icons referenced by
 * the manifest. Run via `npx pwa-assets-generator` and commit the
 * generated PNGs — no build-time cost.
 *
 * The minimal-2023 preset produces, in public/:
 *   - favicon.ico (multi-size)
 *   - apple-touch-icon-180x180.png
 *   - pwa-64x64.png, pwa-192x192.png, pwa-512x512.png
 *   - maskable-icon-512x512.png
 *
 * Keeping the PWA source in sync with assets/icon-only.png means web and
 * native installs share the same icon — no drift between platforms.
 */
export default defineConfig({
  preset: minimal2023Preset,
  images: ['store-assets/app-icon-master.png'],
});
