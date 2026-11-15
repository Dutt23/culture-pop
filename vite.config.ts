import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Production-only CSP: same-origin everything, no inline scripts or styles, no plugins.
 * Phase 2 must add each verified retrieval origin to connect-src explicitly.
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
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.js'],
  },
});
