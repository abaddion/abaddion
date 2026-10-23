# Phase 1 — Board Stack Report

## Implemented

- Five-floor `BoardStack` (5× InstancedMesh 64 + 5× edge LineSegments ≈ **10 scene draw calls**)
- Content-driven cards from `/content.json`
- History routes + Vercel rewrites
- On-demand `RenderLoop` (1.5s idle stop)
- Transition glitch spikes only (UberGlitch idle 0.02 / rgb 0.004)
- `prefers-reduced-motion` + `no-webgl` document fallback
- Draft filtering (`approved: false`) off localhost/LAN

## Measured (local, 127.0.0.1:8777)

| Criterion | Result |
|-----------|--------|
| Post-processing passes | **4** (Render → UberGlitch → Datamosh* → Output) |
| Stack GPU objects | **7** geometries baseline; **7** after 20 open/close cycles |
| App JS (gzip) | **~14 KB** |
| `three.module.js` (gzip) | **~258 KB** |
| Three + app JS ≤ 200 KB gzip | **Not met** (full vendor build) |
| Screen recordings | **Not captured** (owner device) |
| Phone 45 fps | **Not measured** on hardware |

## Deferred

- `/canvas/:slug`, `/code/:slug` item routes (Phase 2)
- Contact form POST API
- Career x-ray teaser interaction
- Three.js bundle diet (tree-shake / custom slim build) for 200 KB budget
- Screen recordings desktop + phone

## Verify locally

```bash
./start.sh
# Routes: /, /canvas, /code, /career-pages, /about, /contact
# dentalbros visible on localhost; hidden on production hostname
```
