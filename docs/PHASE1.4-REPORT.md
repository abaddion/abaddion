# Phase 1.4 — Nova + Gallery Wall

Builds on Phase 1.3 (stack, state machine, router, rail, input, smoke) — unchanged core reliability.

## A. Pixel atlas on slabs

- `js/modules/atlas-builder.js` — idle-chunked 512×512 canvas atlas (one row per floor); thumbs grid for canvas/code, blocky text for other floors.
- `js/shaders/slab-material.js` — `uAtlas` + instanced `aAtlasRect`, ~48×32 pixel sampling, focus-driven mix (static vs content; ~3% snow when focused).
- `js/modules/stack.js` — `setAtlasTexture()`, `setContentCollapse()` for nova collapse.

## B. Nova collapse transition

- `js/modules/floor-transition.js` — tilt → collapse (180 ms) → nova (200 ms) → expand (250 ms); reverse on close; reduced motion = 200 ms crossfade.
- `js/shaders/nova-pass.js` + `post-processing.fireNova()` — lazy composer pass; never blocks.
- `js/modules/nova-fallback.js` — CSS line + radial flash if composer not ready.

## C. Full-screen floor views

- `js/modules/card-layer.js` — `.floor-view` 100vw×100dvh, `← stack`, scrollable `.floor-view-scroll` (max ~72ch).
- Canvas floor DOM is minimal (hint + back); corridor is WebGL.

## D. Canvas corridor (3D)

- `js/modules/canvas-corridor.js` — right wall, size-scaled paintings, lazy thumbs (max 8), damped dolly, hover lift + spotlight, click → detail.
- Wired in `webgl-app.js` (wheel when corridor active, ←/→ step paintings).

## E. Detail + annotations

- `js/modules/canvas-detail.js` — full-viewport detail, SVG leaders, dimension line, inquire CTA → glass form (validate only).
- Deep link `/canvas/:slug` opens detail after floor open.
- Images use existing full JPEG placeholders (WebP conversion deferred).

## F. Content

- `content.json` — `size` in cm (e.g. `110×110 cm`), optional `price` / `availability` on every 5th canvas item.

## G. QA

**Smoke (2026-10-23): PASSED** — includes corridor wheel, 5 aspect-ratio details, inquire + Esc chain, nova interrupt path from 1.3.

```bash
node scripts/smoke.mjs
```

Screenshots: `docs/screens/smoke-*`.

### Perf (local smoke session)

| Check | Notes |
|--------|--------|
| Stack draw calls | Still 2 meshes + lines (instanced slabs) |
| Corridor | ~paintings + wall + spots; target ≤30 draws — verify on device with `?debug` HUD |
| Idle freeze | Render loop `getMode` includes corridor/detail |
| Lighthouse ≥90 | Re-run `scripts/run-lighthouse-preview.mjs` post-deploy (not gated in smoke) |

## Deploy

Run after smoke:

```bash
npx vercel@54.7.1 --prod --yes
```

**2026-10-23 production (1.4a):** https://www.abaddion.com · `dpl_3KThvUqhJ2B3kqKnncjLDANSccbq`

**Instant rollback:** `dpl_dKLSQfHxesQohSLyb6dq5KunC4Ce` (Phase 1.4).

## Addendum 1.4a (mobile + labels)

- `content.json`: per-floor `index` + `label` (technical annotation copy).
- `labels.js`: SVG leaders (`02 ———— art / canvas`), focus `--signal`, collision + rail clip on mobile.
- Hint: `click` vs `tap` via `(pointer: fine|coarse)`; positioned under focused label.
- Cursor removed when `maxTouchPoints > 0` or non-fine pointer (`no-custom-cursor`).
- Mobile framing: `100dvh`, wider floor gap (portrait), camera bias ~45% effective height, slab neighbor fade.
- Bottom rail: 13px type, horizontal scroll, `scrollIntoView` on active link.
- Smoke: 390×844 + 430×932 overlap/cursor/floor screenshots.

## Deferred

- Screen recording (desktop + mobile) — capture manually: slab → nova → corridor → detail → inquire → back.
- WebP 2048 + decode-before-swap pipeline (detail uses JPEG full assets today).
- Painting “fly to center” 500 ms WebGL handoff (detail opens DOM directly).
- Floor gloss mirrors on high tier only (basic gloss plane on high; omitted on low).
- Automated Lighthouse ≥90 in smoke.
