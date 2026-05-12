import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const isGhPages = !!process.env.GITHUB_ACTIONS;
const base = isGhPages ? '/rubik-cube/' : './';
// scope must be an absolute path; SW glob patterns assume absolute base.
const scope = isGhPages ? '/rubik-cube/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Auto-register the service worker and silently fetch updates on each load.
      // Since the app is fully client-side, an updated SW means new bundle next visit.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: "Cubist — Rubik's Cube Solver & Tutor",
        short_name: 'Cubist',
        description:
          "Solve and learn 2x2 and 3x3 Rubik's cubes with step-by-step visual guides, animations, and a built-in beginner method tutor.",
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: scope,
        scope,
        lang: 'en',
        categories: ['education', 'games', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache every built asset so the app is installable + fully offline.
        // woff (legacy) is intentionally excluded — every SW-capable browser supports woff2.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The static-host fallback (404.html → index.html) handles deep-link
        // refreshes on first load; once the SW has cached index.html, navigation
        // requests resolve from cache directly.
        navigateFallback: scope + 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // The three.js vendor chunk is ~1 MB unminified; raise the precache size limit.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          solver: ['cubejs'],
        },
      },
    },
  },
});
