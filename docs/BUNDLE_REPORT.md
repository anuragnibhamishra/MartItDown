# Bundle Report

Measured from the Vite production build before the final documentation-only edits:

| Chunk | Raw | Gzip | Loading |
| --- | ---: | ---: | --- |
| App entry (`index-*.js`) | 626.5 kB | 194.4 kB | Initial |
| Phase 3 reference entry | 602.2 kB | 186.5 kB | Initial |
| Entry growth | 24.3 kB | 7.9 kB | Within the 10 kB gzip target for math/diagram support |
| KaTeX runtime | 258.7 kB | 77.4 kB | Lazy, math notes only |
| rehype-katex | 264.0 kB | 79.4 kB | Lazy, math notes only |
| Mermaid core | 84.9 kB | 29.4 kB | Lazy, Mermaid blocks only |
| Largest Mermaid grammar (ELK) | 1,462.9 kB | 455.8 kB | Lazy, runtime-cached after request |
| PWA precache | 9 entries | 656.6 kB total | App shell and icons |

Mermaid’s full grammar set is intentionally not bundled into the initial chunk. Its first rendered diagram may request multiple async chunks; Workbox caches `/assets/` responses CacheFirst after use and does not precache them. KaTeX JS/CSS is imported only if the note passes the math precheck. The Workbox precache is filtered to the app shell, entry JS/CSS, and SVG/PNG icons.

To remeasure after a change:

```bash
npm run build
npx vite-bundle-visualizer
```

Compare the `index-*.js` gzip size against this baseline. Large renderer chunks are expected to remain separate and should not be added to the initial entry.