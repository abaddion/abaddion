# Phase 1.7 — About inside-the-ball (default)

Branch: `phase-1.7-sphere-when-ready` → PR to `main` (PR B after #9).

## Behavior

- **Default:** WebGL inner-sphere crawl when `webglPhase === 'ready'` + motion OK (desktop and mobile). Flat until ready, then auto-promote unless user chose “read as text”.
- **Preview QA:** `?loop=short` (~14s loop) for tail + dim proof on protected previews.
- **Escape:** “read as text” → flat HTML crawl; “inside the ball” → sphere again.
- **Debug:** `?about=flat` forces flat on load.
- **Fallback:** `prefers-reduced-motion`, `no-webgl` → flat only.

## Implementation notes

- Text band: meridian at θ = 3π/2 (−Z), φ = 0…π, ±35° (desktop) / ±26° (mobile) width.
- Scroll along φ via `uScroll`; opacity falloff overhead vs front-lower arc.
- Tail CTAs after first full loop; crawl dims to ~40% (`uDim`).
- Contact form remains Phase 2 (removed in #7).

## QA

- `npm run check:static`, CI smoke-boot
- Manual: About open → moving bone text on inner wall; wheel + vertical swipe scrub; tail after ~78s loop; toggle flat/sphere
- Screenshots 390 + 1440 for PR body
