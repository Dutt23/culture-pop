import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { connectSrc } from './src/services/retrieval/hosts';

/**
 * Production-only CSP: same-origin everything, no inline scripts or styles, no plugins.
 * connect-src lists exactly the retrieval hosts in `src/services/retrieval/hosts.ts`, the same
 * list the HTTP client enforces, so the two can't drift.
 * Dev is excluded because Vite's dev server injects inline styles and an HMR socket.
 */
// Motion's AnimatePresence `popLayout` appends an EMPTY <style> and fills it via CSSOM insertRule
// (which CSP does not police). This hash is SHA-256 of the empty string: it allows only empty
// inline <style> elements, so any inline CSS with content stays blocked.
const EMPTY_INLINE_STYLE_HASH = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  `style-src 'self' ${EMPTY_INLINE_STYLE_HASH}`,
  "img-src 'self' data:",
  "font-src 'self'",
  // Verified retrieval providers only (docs/SOURCE_INVENTORY.md).
  connectSrc(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    contentSecurityPolicy(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Pop Culture Decoder',
        short_name: 'Decoder',
        description: 'Plain-language, spoiler-free explanations of pop-culture references.',
        start_url: '/discover',
        scope: '/',
        display: 'standalone',
        background_color: '#0d0b1f',
        theme_color: '#0d0b1f',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The on-device model's worker bundles WebLLM (~7 MB): fetched only after consent, never precached.
        globIgnores: ['**/llm.worker-*.js'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  // Matches `new Worker(…, { type: 'module' })` in src/services/llm/client.ts.
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.js'],
  },
});
