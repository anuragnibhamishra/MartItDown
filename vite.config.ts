import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' ? '/MarkItDown/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512.png', 'apple-touch-icon.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        globIgnores: [
          '**/assets/mermaid*.js',
          '**/assets/*Diagram-*.js',
          '**/assets/diagram-*.js',
          '**/assets/*definition-*.js',
          '**/assets/elk-*.js',
          '**/assets/cytoscape*.js',
          '**/assets/rough*.js',
          '**/assets/dagre-*.js',
          '**/assets/graphlib-*.js',
          '**/assets/*parser*.js',
          '**/assets/swimlanes-*.js',
          '**/assets/katex-*',
          '**/assets/rehype-katex-*',
          '**/assets/remark-math-*',
          '**/assets/KaTeX_*',
        ],
        manifestTransforms: [(entries) => ({
          manifest: entries.filter(({ url }) => !url.startsWith('assets/')
            || /^assets\/(?:index-[^/]+\.(?:js|css)|workbox-window[^/]*\.js|[^/]+\.svg)$/.test(url)),
          warnings: [],
        })],
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/assets\/(?:.*(?:mermaid|katex|diagram|rehype|remark|KaTeX).*|.*(?:mermaid|katex|diagram|rehype|remark|KaTeX).*\.js)/.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'markitdown-lazy-renderers',
            expiration: { maxEntries: 140, maxAgeSeconds: 30 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        }],
      },
      manifest: {
        name: 'MarkItDown',
        short_name: 'MarkItDown',
        description: 'Write Markdown and see the result instantly.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        categories: ['productivity', 'utilities'],
        theme_color: '#17181c',
        background_color: '#17181c',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
