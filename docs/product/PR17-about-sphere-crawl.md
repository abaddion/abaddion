# PR 1.7 — About “inside the ball” crawl

Branch: `phase-1.7-about-sphere` (base `main`, independent of PR #3).

## Summary

Lazy-loaded WebGL inner-sphere text band replaces the CSS perspective crawl when WebGL is available. `content.json` about shape unchanged. Flat / reduced-motion / no-WebGL unchanged behavior.

## Compare

- Open About floor → sphere crawl + tail after first loop
- **read as text** → flat HTML + tail + form
- **inside the ball** → return to sphere

## Files

- `js/modules/about-sphere.js`, `js/shaders/about-sphere-band.js`, `js/modules/about-text-texture.js`
- `js/modules/about-crawl.js` — orchestration + SEO hidden copy
- `js/webgl-app.js` — lazy load, render loop, floor open/close
- `css/main.css` — sphere-active chrome, tail glass dock

## QA

- `npm run check:static` + `npm run smoke:boot`
- Manual / smoke-full: wheel scrub, read-as-text toggle, form validation
