# Phase 1.3 — Reliability + responsiveness

## A. Freeze — root cause

**Symptom:** After opening a card (e.g. canvas), the slab stayed mid-tilt, the card overlapped it, rail/wheel/keys appeared dead, HUD could show very low FPS.

**Primary cause (logic, not GPU):**

1. **`goToFloor` / rail did not cancel `OPENING`** — `bootstrap` only called `closeFloor()` when `isOpen()` was true. During `OPENING`, `isOpen()` is false, so rail clicks called `goToFloor` while `FloorTransition.open()` hit `if (phase === 'opening') return;` and ignored further navigation.
2. **No watchdog** — if the render loop stalled or an async step desynced, `OPENING` could persist indefinitely with input handlers assuming a half-finished transition.
3. **Card vs slab desync** — card could appear (fade-only / route) before the slab finished tilting; no forced completion path.

**Lazy post-processing (Phase 1.2):** `transitionBurst()` is fire-and-forget (`ensureComposer().then(...)`). It does **not** block the state machine. Failures there skip glitch only; they were **not** the direct lock. Unhandled rejections during WebGL boot could still break the app — now caught with HTML fallback.

**Secondary cause (rail dead after WebGL attach):** `attachWebGL` defined `window.app.goToFloor` as `(i,r) => shell.goToFloor(i,r)`, which **shadowed** the `ShellApp` instance method. Rail clicks call `this.goToFloor` on the app instance → infinite recursion → `Maximum call stack size exceeded` and a frozen UI. Fixed by binding `Object.getPrototypeOf(shell).goToFloor` before exposing on `window.app`.

**Fixes shipped:**

- Single **`InteractionState`** machine (`BOOT` → `FOCUS` → `OPENING` → `OPEN` → `CLOSING`) with **1500 ms watchdog** forcing terminal states.
- **`interruptToFocus()`** on every rail navigation and input cancel — transitions are interruptible.
- **`safeGlitch()`** try/catch; never await composer for transition progress.
- Card opens only after tilt completes (or fade-only when projected rect is invalid); slab **backdrop dim** when using centered card.
- Global **`error` / `unhandledrejection`** → `failWebGL()` → `no-webgl` HTML shell.

## B–D (summary)

- Wheel: 150 ms idle tail, one floor per gesture; open card scrolls inner content; edge + second gesture closes and changes floor.
- Rail always navigates via `navigateToFloor()` (interrupt + focus).
- HUD hidden unless `?debug`; FPS shows **IDLE** when render loop frozen.
- Viewport-aware camera (`~70%` / `~90%` slab width).
- 20 local picsum JPEG placeholders + lazy canvas grid + lightbox + `/canvas/:slug`.
- Long about body for overflow testing.

## E. Smoke test

**2026-10-23 — PASSED** (`node scripts/smoke.mjs`; script starts its own static server with SPA rewrites).

Viewports: 390×844, 1440×900, 2560×1400 — routes, wheel, open/close, rail click during transition, 20-event wheel spam. No stuck transitions >1.5 s; rail inside viewport.

Screenshots: `docs/screens/smoke-{390x844,1440x900,2560x1400}-{home,final}.png`

Run before deploy:

```bash
node scripts/smoke.mjs
# optional: SMOKE_URL=http://127.0.0.1:8799 node scripts/smoke.mjs
```

## F. Deploy

**Rollback target (production before Phase 1.3):** `glitch-portfolio-concac9w5-abaddions-projects.vercel.app` (Instant Rollback in Vercel dashboard).

Production deploy: run after smoke passes:

```bash
npx vercel@54.7.1 --prod --yes
```

**2026-10-23 production:** https://www.abaddion.com (alias) · deployment `dpl_EkuYvHQPWmewWZgLDiBrJEdTHGwn` · https://glitch-portfolio-k6fjjxqdg-abaddions-projects.vercel.app

**Instant rollback to pre–1.3:** `dpl_*` for `glitch-portfolio-concac9w5-abaddions-projects.vercel.app` (previous production).

## Deferred

- WebP conversion pipeline (JPEG placeholders committed; add `sharp` script later).
- Full Lighthouse ≥90 gate in smoke (manual `run-lighthouse-preview.mjs` still recommended).
