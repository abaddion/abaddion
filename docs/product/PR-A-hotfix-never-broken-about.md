# PR A — Hotfix: never broken About + WebGL boot

## WebGL / Three.js investigation (2026-10-28)

**Symptom:** `__APP_STATE.webglBootError` referencing failed dynamic import of `/vendor/three/build/three.module.min.js` while About UI stayed in `is-sphere` (flat panel hidden).

**Production curl (2026-10-28):**

- `HTTP 200`
- `Content-Type: application/javascript; charset=utf-8`
- `Cache-Control: public, max-age=31536000, immutable`
- File tracked in git: `vendor/three/build/three.module.min.js`

**Likely causes (not mutually exclusive):**

1. **Race:** About crawl mounts in sphere mode before `initAsync` completes or fails; flat panel hidden with no WebGL text.
2. **Boot error path:** `failWebGL` did not force flat About; partial `shell.webgl` without `renderer` still ran `openFloor` transition.
3. **Stale immutable cache:** Possible bad cached response on a client (mitigation: explicit `Content-Type` on `/vendor/*.js` in `vercel.json` + `modulepreload` in `index.html`).

**Fixes in this PR:** fail-safe flat About, hero hidden on `floor-open`, init try/catch, `openFloor` HTML fallback without renderer, MIME header + modulepreload.

**Proof required on preview:** Browser Network tab — `three.module.min.js` 200 + JS MIME; `__APP_STATE.webglPhase === 'ready'` after load.
