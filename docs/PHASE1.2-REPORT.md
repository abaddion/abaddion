# Phase 1.2 — LCP + measurement report

**Preview deploy:** https://glitch-portfolio-1otd0l4fv-abaddions-projects.vercel.app  
(Production not promoted.)

## What changed

- Static `#identity-hero` in HTML (name, headline, intro) + static rail links — paints without WebGL.
- Shell: `js/bootstrap.js` → `content.json` + router/cards → deferred `import('./webgl-app.js')`.
- Canvas opacity 0 → 1 after first WebGL frame (~400 ms; instant with reduced motion).
- Post-processing composer lazy-loaded on first card open / chaos.
- Measurement: `docs/PHASE1.2-MEASUREMENT.md`, `scripts/run-lighthouse-preview.mjs`, `.env.local.example`.

## Lighthouse mobile ×3

### Preview URL (requires `.env.local`)

No `VERCEL_AUTOMATION_BYPASS_SECRET` in this environment — **preview Lighthouse not run here**. After you add the secret:

```bash
node scripts/run-lighthouse-preview.mjs https://glitch-portfolio-hx1vi7m5g-abaddions-projects.vercel.app
```

### TBT pass (idle WebGL + stepped init + lazy cards)

- `requestIdleCallback` (1500 ms cap) before `import('./webgl-app.js')`
- WebGL init: renderer → stack → labels → systems, `yieldToMain()` between steps
- `renderer.compileAsync(scene, camera)` before first frame
- Card DOM built per floor on first visit (boot floor only)
- Hero `hero-handoff` cross-fade with canvas; identity 3D label after dismiss

### Local — `npx serve` (compressed), median of 3 (post-TBT fix)

| Metric | Target | Median |
|--------|--------|--------|
| Performance | ≥ 90 | **~96** |
| LCP | < 2.0 s | **~1.22 s** |
| TBT | < 200 ms | **~130 ms** |
| CLS | < 0.1 | **0** |
| JS transfer (scripts) | ≤ 220 KB | **~189 KB** |

### Preview — automation bypass, median of 3 (latest deploy)

| Metric | Target | Median |
|--------|--------|--------|
| Performance | ≥ 90 | **~97** (one cold run ~77) |
| LCP | < 2.0 s | **~1.08 s** |
| TBT | < 200 ms | **~205 ms** (one run ~1.1 s compile spike) |
| JS transfer | ≤ 220 KB | **~191 KB** |

- **LCP:** Subpart breakdown (run 3): TTFB ~15 ms, element render delay ~125 ms — LCP is the static hero text (`h1.identity-name` / headline), not the canvas.
- **TBT miss:** Main-thread cost from shell + deferred WebGL chunk after first paint (run 1 outlier ~976 ms; medians 261–308 ms). Next lever: defer more shell work or shrink WebGL entry if preview still misses TBT.

Individual runs: perf 78 / 93 / 95; LCP 1.31 / 1.26 / 1.27 s; JS transfer 193 107 B all runs.

## Runtime (Phase 1.1 behavior preserved)

Not re-run on this deploy in CI; prior verification still applies: 2 draw calls, 8 s freeze, ~60 fps @ 4× CPU on floor/card interactions. Re-check after deploy if needed:

```bash
./start.sh
# then existing puppeteer scripts against http://127.0.0.1:8799
```

## Owner action

1. Copy `.env.local.example` → `.env.local` with Vercel **Protection Bypass for Automation** secret.
2. Run preview Lighthouse script against the URL above and compare to local medians (preview should be similar; CDN compression matches `serve`).
