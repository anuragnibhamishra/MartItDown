# v1.0 Release Checklist

- [ ] `npm ci`, `npm run check`, and `npm audit` complete without errors or unresolved production advisories.
- [ ] Review the generated ZIP and JSON backups in a clean browser profile; verify front matter, manifest, tags, IDs, and conflict choices.
- [ ] Verify note/history storage survives reload and quota errors leave the current editor usable.
- [ ] Verify math, Mermaid, print, Copy HTML, and first-use offline caching in a production build.
- [ ] Confirm mobile drawer, Write/Preview tabs, keyboard focus, and light/dark/system themes.
- [ ] Replace the demo URL in README and capture the four documented screenshots.
- [ ] Set the repository Pages URL/base, confirm the deployed service-worker scope, and test an installed PWA update.
- [ ] Run Lighthouse on desktop and mobile; target Performance 90+, Accessibility 95+, Best Practices 95+, PWA 90+.
- [ ] Review generated dependency advisories, license obligations, and the release changelog.
- [ ] Tag `v1.0.0` after the deployment smoke test.