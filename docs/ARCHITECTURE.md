# abaddion.com — Master Architecture

Nov 11, 2026 · @Barush Jensik

## 1. How to use this document

This is the single source of truth for building abaddion.com. Paste it (or the relevant sections) at the start of any new chat with the architect model. **Canonical paths:** `docs/ARCHITECTURE.md` (Cursor) and this file `docs/ARCHITECTURE` (same content; keep in sync when editing).

### Three roles

| Role | Who | Does | Never does |
| --- | --- | --- | --- |
| Product owner | Barush | Sets goals, reviews previews on real devices, says "merge #N" | Debug code |
| Architect | Claude in chat (Sonnet for routine phases, Opus for shader-heavy ones) | Turns goals into one phase brief at a time, reviews Cursor's reports, decides trade-offs | Claims anything about the code it has not seen in a Cursor report |
| Builder | Cursor (full repo access) | Implements, tests, opens PRs with visual proof | Merges without "merge #N", changes app code to make a test pass |

### The loop for every phase

1. Barush describes what she wants or what she saw (screenshots help).
2. Architect restates it in one paragraph, then writes ONE brief using the template in section 12.
3. Cursor implements on a branch, opens a PR, puts proof in the PR body.
4. Barush opens the Vercel preview on iPhone and desktop.
5. If it matches: "merge #N". If not: screenshots back to the architect, who writes a fix brief for the same PR.

### Rules for the architect

- One phase per brief. Small PRs. Never bundle a visual redesign with a bug fix.
- If the state of the code is unclear, first ask Cursor for a report with no code changes.
- Every brief ends with acceptance criteria and the proof Cursor must attach.
- When Cursor says "done", check the proof against the spec before telling Barush it is ready.
- Explain to Barush in plain language. Put technical detail in the code block for Cursor.

## 2. Product

abaddion.com is the portfolio of Barbora Jenšík (Barush), shown under the name **abaddion**, headline **creative technologist**. It must prove in one visit that she both paints on canvas and builds advanced web experiences.

### Who it is for and what they do

| Visitor | Arrives from | Should do |
| --- | --- | --- |
| Someone Barush is talking to | A link she sends ("look what I built") | Land directly on a painting or project via deep link |
| A company with a weak careers page | Footer credit on a site she built, LinkedIn | Read the employer-branding offer, contact her |
| Art buyer | Social, word of mouth | Walk the gallery, open a painting, tap "inquire" |
| Peers and recruiters | GitHub, search | Understand who she is in under 10 seconds |

The commercial core is **employer branding / career-page improvement**. The art and the site itself are the proof of craft.

### Principles that never bend

1. **Fast first.** Text is readable before any 3D loads. Nobody waits for an effect.
2. **The art is the hero.** Paintings always show true color, uncropped. Effects never touch artwork or body text.
3. **Glitch is a transition language**, not a permanent filter.
4. **Never broken.** If WebGL fails, every floor still shows its content as plain HTML.
5. **Mobile first.** iPhone Safari is the primary test device.
6. **From scratch.** Vanilla JS, no bundler, no frameworks, dependencies vendored locally.
7. **Proof over claims.** A feature exists only when a screenshot or recording from a preview shows it.

### Language and identity

- English only.
- No logo yet. Colors stay CSS variables so a future logo can re-skin the site.
- Contact address is not shown publicly. Contact goes through forms (Phase 3).

## 3. Experience concept

One continuous world instead of pages: the visitor floats in deep space in front of a stack of five glass platforms, like a 3D glass chess set. Each platform is a floor of the portfolio. Stardust builds the platforms on arrival.

### The first five seconds

1. **0 s** Name, headline and navigation appear as plain HTML over a dark space-tinted background.
2. **\~1 s** The universe fades in behind the text: faint nebula, stars of different sizes.
3. **\~1.2 to 3.4 s** Some of those stars detach, spiral in and land as dust on the outlines of five platforms. The glass materializes where the dust settles.
4. **After** The stack is ready. Any tap, scroll or key skips the build instantly.

### The five floors

| # | Id / route | Label on the platform | What opens | Status |
| --- | --- | --- | --- | --- |
| 01 | `identity` `/` | abaddion / creative technologist | Name, headline, one-line intro | Live, real copy |
| 02 | `canvas` `/canvas`, `/canvas/:slug` | art / canvas | Gallery corridor you walk through; paintings on the right wall only; tap one for the detail view | Live with placeholder images |
| 03 | `code` `/code`, `/code/:slug` | web / code | Projects with screenshot, problem, solution, stack, live link | Placeholder panel |
| 04 | `career-pages` `/career-pages` | employer branding / career pages | The offer, DentalBros before/after, Career Page X-ray | Placeholder panel |
| 05 | `about` `/about` | about abaddion / contact | About text crawling on the inside of a ball; two links and contact at the end | Flat text live; ball in PR #10 |

### How you move

- **Between floors:** scroll, swipe, arrow keys, or the rail (bottom bar on mobile, left on desktop). One floor per gesture.
- **Focus ("tuning in"):** the focused platform clears, brightens and shows its label in the accent color. Others stay frosted and dim.
- **Open:** tap or click the focused platform, or press Enter. The platform tilts toward you, collapses into a thin bright line, a small nova flashes, and the content expands to the full screen. The nova elements are removed once the content is open.
- **Close:** "← stack", Esc, or browser Back. Scrolling past the end of a floor's content closes it and moves to the next floor.
- **Rail links work from every state**, including mid-animation.

### Floor details already decided

**Canvas corridor.** After the nova you stand at the corridor entrance looking down it. Scrolling walks you forward. Paintings approach, pass on your right and leave behind you. Painting size on the wall follows the real size in cm. The nearest painting is "active" and shows its title.

**Painting detail.** The painting fills the screen, never cropped, never scrolled. Thin technical-drawing lines draw in: title + medium + year at top right, a dimension line with the size at the left, optional availability or price, and "inquire →" at bottom right. "inquire" opens a modal form with the painting prefilled. "← corridor", Esc and Back return to the same spot. "‹ prev / next ›" step between paintings.

**About ball.** The viewer sits inside a sphere. Text starts at the front bottom, recedes along the bottom, climbs the back wall, passes overhead stretched and almost invisible, then loops. It auto-scrolls at reading speed; wheel or swipe scrubs it; tap pauses. After one pass, two links (to canvas and career pages) and a closing line appear. "read as text" shows it flat.

**Code floor (proposed, not built).** A curved wall of monitors, each a project screenshot; tap one for the case study.

**Career pages floor (proposed, not built).** Pitch, one before/after case, and the X-ray tool: paste a careers URL, get a short scorecard with three to five fixes, then a contact prompt.

## 4. Design language

Dark, calm, precise: near-black space, bone-white light, one accent. Glass and thin technical lines carry the structure; glitch appears only when something changes state.

### Tokens (`css/main.css :root`)

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0a0a0a` | Background base, glass tint |
| `--bone` | `#ece8df` | Text, lines, dust, most stars |
| `--signal` | `#c6ff00` (default, changeable) | Focused label, active rail item, rare highlights only |
| `--muted` | bone at \~40% | Unfocused labels, secondary text |

- Byline and in-text links use bone, not signal.
- The platforms themselves carry no lime green.
- Nebula brightness stays within about 4 to 6% above ink. Accent tint in space at most 8%.

### Typography

- One monospace for labels, rail, annotations and HUD. One clean sans for body text.
- Self-hosted woff2, Latin subset, `font-display: swap`. Only the label font is preloaded.
- Labels are written as `02 ———— art / canvas`: index, dash, name. No leader line to the platform.

### Materials

- **Platforms:** thick glass slabs with a bright beveled rim, a faint frosted 8x8 chess grid etched in the surface, and a low-resolution glitch mosaic of that floor's content trapped underneath. Content must not be recognizable, only its colors.
- **Panels and modals:** glassmorphism (`backdrop-filter: blur(18px) saturate(140%)`, 1px bone border at \~20%). Only one blurred surface at a time. Solid `rgba(10,10,10,0.85)` fallback on weak devices.
- **Annotations:** 1px bone lines with end ticks, mono text, drawn in with a short stroke animation. The same style everywhere (painting detail, labels).

### Motion rules

| Moment | Motion | Duration |
| --- | --- | --- |
| Arrival | Stardust assembles the platforms | max 2.4 s first visit, 0.8 s repeat, skippable |
| Focus change | Platform clears ("tunes in") | \~400 ms |
| Open floor | Tilt, collapse to line, nova, expand | \~650 ms |
| Close floor | Reverse, dimmer nova | \~500 ms |
| Painting to detail | Fly to center, hand over to a crisp HTML image | \~500 ms |
| Idle | Slow mosaic re-seed, star twinkle | Stops after a few seconds without input |

- Glitch (RGB split, tear, datamosh) only during transitions and the Shift x2 easter egg.
- Never more than 3 flashes per second. Nova brightness ramps over at least 200 ms.
- With reduced motion: no fly-ins, no glitch, no parallax; 200 to 300 ms fades.

### What to avoid

Rainbow nebulae, bloom on everything, lens flares, warp streaks, loading screens with percentages, particle logos, neon cyan/magenta, any effect over a painting or body text.

## 5. System architecture

The site is static files with no build step: what is tracked in git is exactly what Vercel serves. A plain-HTML layer carries all content; a lazily loaded WebGL layer adds the world around it.

### Stack (fixed)

- Vanilla JavaScript ES modules, loaded through a browser **import map**. No bundler, no framework, no GSAP.
- **Three.js r160**, vendored under `vendor/three/` (`build/three.module.min.js` + `examples/jsm` add-ons). No CDN.
- Custom GLSL in `ShaderMaterial`s. WebGL2 through `WebGLRenderer`.
- Hosting: Vercel, Git integration, production branch `main`. Repo `github.com/abaddion/abaddion`.
- Later backend: Vercel `/api` functions, MongoDB, Resend, reCAPTCHA v3, Gemini API (Anthropic as backup).
- Dev-only npm packages: Puppeteer and Sharp, for tests and image conversion.

### Two layers

| Layer | Holds | Why |
| --- | --- | --- |
| DOM (always) | Hero text, rail, labels, floor views, painting detail image and annotations, modals, forms, hidden SEO copy | Sharp text, accessible, indexable, works without WebGL |
| WebGL (lazy) | Space background, stars, dust, platforms, corridor, about ball, transition passes | The experience; never required to read content |

A DOM element fades in at the exact screen rectangle where a 3D object finishes its move, so both read as one object.

### File map

As reported by Cursor through PR #10. Ask Cursor for a fresh tree before relying on a file name.

```
index.html                 static hero + rail, import map, <meta name="build">
content.json               all copy, floors, items (section 5, "Content model")
css/main.css               tokens, layout, glass panels, reduced-motion, no-webgl
vercel.json                SPA rewrites, cache + content-type headers
js/bootstrap.js            content + router + DOM floor views; schedules WebGL import
js/webgl-app.js            stepped WebGL init, frame render, wiring
js/modules/
  content-loader.js        fetch/validate content.json, approved filter
  router.js                History API, deep links, title/description per route
  rail.js  labels.js       navigation links; platform labels (DOM)
  card-layer.js            full-screen floor views (DOM), lazy build per floor
  input.js                 wheel, touch (tap vs swipe), keyboard
  app-state.js             state machine + read-only window.__APP_STATE
  webgl-readiness.js       single definition of "ready"
  render-loop.js           on-demand loop, ambient rate, freeze
  quality.js               DPR caps, adaptive tier
  dispose.js               free geometries/materials/textures
  stack.js                 5 platforms as ONE InstancedMesh + merged edges
  atlas-builder.js         low-res content atlas for the mosaic (built at idle)
  camera-rig.js            overview/focus/open poses, damped moves, parallax
  floor-transition.js      tilt, collapse, nova, expand; interruptible
  post-processing.js       lazy EffectComposer (glitch, datamosh, nova)
  nova-fallback.js         CSS version when the composer is not loaded
  canvas-corridor.js       gallery walk (lazy on first canvas open)
  canvas-detail.js         painting detail, annotations, inquiry modal (lazy)
  detail-fly.js            WebGL fly-to-center before DOM handoff (lazy)
  about-crawl.js           about text controller (flat + sphere modes)
  about-sphere.js          inner-sphere band mesh (lazy)
  about-text-texture.js    renders about copy to a canvas texture
  cursor.js  gyroscope.js  desktop cursor; tilt (permission on tap)
js/shaders/
  slab-material.js         glass + chess grid + mosaic (one material)
  uber-glitch.js  datamosh.js  about-sphere-band.js
vendor/three/              tracked in git (never ignore vendor/**/build)
scripts/
  check-static.mjs  smoke-boot.mjs  smoke-full.mjs
  run-lighthouse-preview.mjs  convert-placeholders-webp.mjs
.github/workflows/         ci.yml (required), preview-asset-check.yml
.cursor/rules/workflow.mdc standing rules for Cursor
docs/                      phase reports, product notes, DEVELOPMENT.md
```

New for the universe phase (section 10): `js/modules/space/nebula-bake.js`, `space/stars.js`, `intro/dust.js`, `intro/sequencer.js`.

### Games (static satellite apps)

Games are **not** part of the portfolio WebGL stack. Each game is its own HTML entry under `games/<slug>/`, served as static files. Only the **`/games` floor route** (no trailing slug) rewrites to `index.html`; **`/games/<slug>/`** is never rewritten.

| Concern | Location |
| --- | --- |
| Discovery / links | `content.json` → floor `id: "games"`, `card-layer.js` `renderGames()` |
| Play URLs | `/games/interactive-ink/`, `/games/interactive-sand/`, `/games/calm-corner/`, `/games/smash-town/` |
| Shared kid/kiosk helpers | `games/kiosk.js`, `games/kiosk.css` (optional per page) |
| Sand chat API | `POST /api/sand-chat` → `api/sand-chat.js` (Vercel only; not used by portfolio shell) |
| Clarity | Build inject `<!-- __CLARITY_SNIPPET__ -->` in each `games/*/index.html` via `scripts/inject-build-meta.mjs` |
| CI | `check-static` walks every game asset from `content.json`; `smoke-boot` loads each route and one real input |

**Isolation rule (binding):** Portfolio visual phases (universe background, star layer, particle intro, `webgl-app.js`, `render-loop.js`, `input.js`, `css/main.css` body/chrome) **must not** change files under `games/`, `api/sand-chat*`, or game-only globals **without** listing those paths and risks in the PR body. Games do not import `js/bootstrap.js` or `vendor/three/build/three.module.min.js`; they use local `main.js` or `games/*/vendor/three.min.js`.

**Coupling points to watch:**

- `content.json` game `url` / `slug` must match `games/<slug>/`.
- `vercel.json` must keep **`/games/:path*`** out of SPA rewrites (only exact `/games` → `index.html`).
- `scripts/inject-build-meta.mjs` rewrites game HTML on deploy — do not remove placeholders without replacement.
- Optional `window.clarity` from the injected snippet (games fire custom events only).

Docs: `docs/GAMES-*.md`, `docs/GAMES-KIOSK.md`.

### State machine (one owner: `app-state.js`)

```
BOOT -> FOCUS(i) -> OPENING(i) -> OPEN(i) -> CLOSING(i) -> FOCUS(i)
                      ^                |
                      +--- rail / key / back from ANY state ---+
```

- Every transition is interruptible. A rail click cancels the running tween and goes to the new target.
- **Watchdog:** any OPENING/CLOSING older than 1500 ms is forced to its end state.
- Every async step is wrapped in try/catch. A missing or slow effect is skipped, never awaited.
- Global `error` and `unhandledrejection` handlers switch to the plain-HTML mode.
- `html.floor-open` hides the static hero whenever a floor is open, with or without WebGL.

### WebGL readiness (one definition)

`webglPhase`: `init -> attached -> ready`. **`ready` means the first frame has rendered and the loop runs.** It is set in one place; nothing may overwrite it. Features that need WebGL (about ball, corridor, intro) check only `isWebGLReady()`. Until then, and on failure, each floor shows its flat DOM version.

### Boot sequence

1. HTML paints hero and rail. This is the LCP. No JS needed.
2. `bootstrap.js`: fetch `content.json` (preloaded), start router, build only the current floor's DOM view.
3. `requestIdleCallback` (1500 ms cap): dynamic `import()` of Three.js and `webgl-app.js`.
4. Stepped init with yields, no task over 50 ms: renderer, background, stars, stack, labels, systems.
5. `renderer.compileAsync()` raced against a 1500 ms timeout.
6. First frame: canvas fades in, `webglPhase = ready`, intro plays, hero cross-fades to the identity floor.
7. Lazy on first use: post-processing, corridor + detail, about sphere.

### Render loop

- Renders only when something changes: camera, transition, input, or an ambient effect.
- Idle with ambient effects: capped near 20 fps. After a few seconds without input: fully frozen, zero frames.
- Paused on `visibilitychange` hidden. All timing from `performance.now()`, never frame counts.
- At rest: direct `renderer.render()`. The composer runs only during transitions, at half resolution.

### Routing

- History API. Each floor and each item has a URL. Deep links open the right view on refresh.
- `vercel.json` rewrites `/canvas`, `/code`, `/career-pages`, `/about`, `/contact` and their `/:slug` children to `/index.html`. Never rewrite `/js`, `/css`, `/vendor`, `/assets`, `/content.json`, `/api`.
- Debug switches via query: `?debug` (HUD), `?about=flat|sphere`, `?slab=a|b`, `?loop=short`. Query switches are for previews; they must not change production defaults.

### Content model (`content.json`)

```json
{
  "site": { "name": "abaddion", "headline": "creative technologist", "intro": "code · math · canvas" },
  "floors": [
    { "id": "identity", "index": "01", "route": "/", "label": "abaddion / creative technologist", "body": "..." },
    { "id": "canvas", "index": "02", "route": "/canvas", "label": "art / canvas",
      "items": [ { "slug": "...", "title": "...", "year": 2025, "medium": "oil on canvas",
                   "size": "110x110 cm", "image": "assets/.../full.webp", "thumb": "assets/.../thumb.webp",
                   "availability": "available", "price": null, "alt": "...",
                   "approved": true, "placeholder": true } ] },
    { "id": "code", "index": "03", "route": "/code", "label": "web / code",
      "items": [ { "slug": "dentalbros", "title": "dentalbros.cz", "url": "...", "summary": "...",
                   "stack": [], "approved": false, "alsoOn": ["career-pages"] } ] },
    { "id": "career-pages", "index": "04", "route": "/career-pages",
      "label": "employer branding / career pages", "caseRefs": ["dentalbros"], "xrayTeaser": true },
    { "id": "about", "index": "05", "route": "/about", "label": "about abaddion / contact",
      "byline": "Barbora Jenšík — Barush", "paragraphs": ["..."],
      "ctaLinks": [ { "text": "...", "href": "/canvas" }, { "text": "...", "href": "/career-pages" } ],
      "closingLine": "Otherwise, enjoy the glitch." }
  ]
}
```

- Items with `"approved": false` are hidden on production hostnames and visible on localhost and LAN.
- Images: WebP, 512 px thumb for 3D, 2048 px full for detail, loaded lazily. Max \~8 corridor textures in memory.
- When the admin arrives, an API returns this same shape from MongoDB. Nothing else changes.

### Test hook

`window.__APP_STATE` is read-only and inert: route, state, floor index, `webglPhase`, corridor painting screen rects, crawl offsets. Tests read it and act only through real input. The app contains no test-only branches.

## 6. Performance and accessibility budgets

Every PR must hold these numbers; a phase that breaks one is not done. Best measured values so far: Lighthouse mobile 97 to 99, LCP about 1.1 s, about 190 KB of JS.

### Loading (Lighthouse mobile on the Vercel preview, median of 3)

| Metric | Budget |
| --- | --- |
| Performance score | at least 93 |
| LCP (must be the static hero text) | under 2.0 s |
| TBT | under 200 ms |
| CLS | under 0.1 |
| JS transfer at boot, compressed | at most 220 KB |
| Longest main-thread task during WebGL init | at most 50 ms |

Measure on a Vercel preview with the protection-bypass header, or locally with `npx serve`. Never with `python http.server` (no compression).

### Runtime

| Metric | Budget |
| --- | --- |
| Draw calls, stack at rest | at most 3 (plus 2 for background and stars) |
| Draw calls, corridor | at most 30 |
| Draw calls, about ball | at most 3 |
| Frame rate during transitions | 60 fps desktop; at least 45 fps mid-range phone; at least 50 fps at 4x CPU throttle |
| Frames rendered when frozen | 0 |
| GPU memory | flat after 20 open/close cycles (`renderer.info.memory`) |
| Device pixel ratio | capped 1.5 mobile, 2 desktop; drops 0.25 if frame time stays over 22 ms |
| Composer | off at rest; half resolution when on |
| Average particle size on phones | at most 4 to 5 device pixels |

### Rules that keep it fast

- Nothing heavy in the boot path. Anything a floor needs loads on first open of that floor.
- One material and one instanced mesh per repeated thing. No real refraction, no real-time lights, no shadows.
- Bake expensive noise once into a small texture; sample it afterwards.
- No per-frame CPU work over particle or vertex buffers. Animate with uniforms.
- Dispose every texture, geometry and material when a floor closes.

### Accessibility and fallbacks

- All content exists as real HTML. Rail items are links; cards are regions with headings; focus moves into an opened view and back on close.
- Full keyboard path: arrows or Page keys between floors, Enter opens, Esc closes, Tab through content.
- `prefers-reduced-motion`: no intro fly-in, no glitch, no crawl, no parallax. Static stars, short fades, flat about text.
- No WebGL or WebGL failure: every floor shows a readable flat version. About is never empty.
- Custom cursor is desktop-only and never hides the native cursor over links, inputs or panels.
- iOS gyroscope permission is requested only from a tap.
- Ambient motion stops within a few seconds of no input. No flashing above 3 per second.
- Each route sets its own title and description. Social preview images come in Phase 5.

## 7. Workflow and QA

Production changes only by merging a pull request into `main`, and only after Barush writes "merge #N" for that PR. These rules live in `.cursor/rules/workflow.mdc`; the architect repeats the relevant ones in every brief.

### Per task

1. Branch from the latest `main`: `phase-<n>-<short-name>` or `fix/<short-name>`.
2. Small, logical commits (`feat:`, `fix:`, `perf:`, `test:`, `docs:`, `chore:`). Never commit secrets or screenshots.
3. Run `npm run check:static && npm run smoke:boot` locally, then `smoke:full` (one process at a time).
4. Open the PR with `gh pr create`, fill the template, add the Vercel preview URL.
5. Attach proof (below). If the result does not match the spec, say so in the PR.
6. Wait. Do not merge.

### CI gates

| Check | What it catches | Required to merge |
| --- | --- | --- |
| `check-static` (\~10 s, no browser) | A referenced file missing or not tracked in git, syntax errors in any module, broken `content.json` | Yes |
| `smoke-boot` (\~1 min, headless Chrome with software WebGL) | Site fails to boot, console errors, a floor cannot open or close, no-WebGL fallback broken | Yes |
| `preview-asset-check` | An asset missing on the deployed preview | No |
| Domain check on push to `main` | Custom domain not serving the newest build (`<meta name="build">` vs commit) | No, but fails loudly |
| `smoke-full` (local, real GPU) | Corridor walk, taps, crawl, aspect ratios, spam input, four viewports | No; results go in the PR body |

Branch protection on `main`: pull request required, zero approvals, squash only, linear history, both required checks, branch up to date, no force pushes.

### Proof required in every PR body

- Screenshots of the feature itself at **390x844 and 1440x900**, taken on the Vercel preview with real input.
- For anything that moves: a short recording, or three frames one second apart that are visibly different.
- `__APP_STATE` values that show the intended mode (for example `webglPhase: ready`).
- Lighthouse numbers when the boot path changed. Draw calls and memory when a scene changed.
- A list of anything deferred or not matching the spec.

### Testing rules

- Tests use real input only: `page.mouse.click`, `page.touchscreen.tap`, wheel events, key presses, `history.back()`.
- A test may read `window.__APP_STATE`; it must not call app functions to skip a user path.
- If real input fails, the app is broken. Fix the app, not the test.
- If CI fails twice for test-infrastructure reasons, stop and send the logs.
- Never describe a build as serving code that it predates. Check the build marker.

### Deploy and rollback

- Merge to `main` deploys production through Vercel's Git integration. Never `vercel --prod`.
- After every merge Cursor reports: new deployment ID, previous ID, that `www.abaddion.com` serves the new build marker, and that `/vendor/three/build/three.module.min.js` returns 200 with a JavaScript content type.
- Emergency: Vercel Instant Rollback. **After a rollback, Vercel stops assigning the domain to new deploys.** Use "Undo Rollback" or `vercel promote <deployment>` once the fix is merged.

### Secrets and backups

- `.env.local` is never committed. Its values live in Barush's password manager.
- Run a secret scan (gitleaks) before pushing rescue or backup branches. A finding means stop, not push.
- Stashes do not survive a lost laptop. Work worth keeping becomes a pushed branch.

## 8. Current state

Confirmed **13 November 2026** (build meta on `https://www.abaddion.com`).

### Production

| Item | Value |
| --- | --- |
| **Build SHA** | `e0258202e29513e5a8bdb6657de936c1e75f2a69` (`e025820` — PR **#16** kiosk mode, merged to `main`) |
| **Open PRs** | **#13** only — `fix/sand-gemini-retired-model` (Gemini model ListModels fallback; supersedes retired `gemini-2.0-flash-lite`) |
| **PR #10 (about sphere)** | **Merged** 12 Nov 2026 (`1ed38a7` on `main` via squash). Not open, not stale. |

**Merged to `main` since 9 Nov 2026** (newest first): #16 kiosk, #15 Smash Town, #14 Calm Corner, #12 sand ESM/Clarity/config, #11 Interactive Sand + API, #10 about sphere (PR B).

Stale remote branches still exist (`phase-1.7-sphere-when-ready`, `feat/games-*`, etc.) but are superseded by merged `main`; safe to delete after verification.

### What is live on www.abaddion.com

| Area | State |
| --- | --- |
| Static hero, rail, routing, deep links | Working |
| Six floors in `content.json` (identity, canvas, code, **games**, career-pages, about) | Working |
| Glass stack, corridor, detail fly, nova transitions | Working |
| About | Sphere crawl when WebGL ready; flat fallback |
| **Games floor** (`/games`) | Lists four plays; links to static `games/<slug>/` |
| **Interactive Ink / Sand / Calm Corner / Smash Town** | Static bundles; Sand uses `POST /api/sand-chat` on Vercel |
| **Kiosk / PWA helpers** | `games/kiosk.js`, per-game `manifest.webmanifest` |
| **Clarity** | Build-injected tag (default project `zcn4aq0rzr` unless env overrides) |
| **API** | `/api/sand-chat` (ESM handler; set `GEMINI_API_KEY` on Vercel) |
| Background (portfolio) | Flat near-black; **Phase 2.0 universe not merged** |
| Content | Real about copy; paintings/projects mostly placeholders |

### Open work (high level)

| Item | Notes |
| --- | --- |
| PR **#13** | Merge when approved — fixes Gemini 404 for new keys |
| Phase **2.0** universe + stardust | Spec in section 10; touches `webgl-app.js`, boot, `css/main.css` body — **games isolated** (see Games section) |
| `fix/smoke-corridor-isolated` | Parked, low urgency |
| Real content, backend, logo | Unchanged from roadmap |

### Known gaps

- No real painting catalog; DentalBros still `approved: false`.
- No contact/X-ray backend; forms validate only.
- Local `npx serve` needed directory `index.html` fix for `games/*/` (in PR `test/protect-games` static-server patch).
- Games screenshots for audits: `docs/product/games-visual-report/` (report captures, Nov 2026).

## 9. Roadmap

Eight steps, in this order: finish the experience with placeholders first, then real content, then the backend. Each phase is one or more small PRs and ends with Barush's review on a preview.

| Phase | Goal | Model for Cursor | Done when |
| --- | --- | --- | --- |
| 1.7 | About text moves inside the ball (finish PR #10) | Opus | Text visibly recedes, climbs and ghosts overhead at 390 and 1440; flat fallback also scrolls; reduced motion is static |
| 1.8 | Pick the slab variant; remove the unused one and the `?slab` switch | Sonnet | One variant in code; Barush chose it on her phone |
| 2.0 | Universe background + stardust intro (section 10) | Opus | Platforms assemble from stars in at most 2.4 s; skip works; Lighthouse unchanged |
| 2.1 | Code floor: monitor wall + project case views | Opus for the wall, Sonnet for the views | Each project opens from the wall and by deep link |
| 2.2 | Career-pages floor layout: pitch, before/after viewer, X-ray teaser | Sonnet | Before/after comparison works by drag and by keyboard |
| 3 | Real content: paintings, projects, DentalBros case, no "PLACEHOLDER" left | Sonnet | Every item real; alt text on every image |
| 4 | Backend: contact + inquiry sending, admin, X-ray (section 11) | Sonnet | A painting can be added without touching code; forms deliver mail |
| 5 | Polish: logo, social preview images, analytics, sound (optional) | Sonnet | Shared links show a preview card; visits are measured |

### Notes per phase

**1.7 About ball.** Brief already written; the three open fixes are in section 8. Do not start 2.0 until this is merged, because both touch WebGL readiness.

**1.8 Slab choice.** Barush opens the home page with `?slab=a` and `?slab=b` on her phone and picks. A small PR deletes the other path.

**2.1 Code floor.** Projects confirmed: vairee.ai, recberry.com, dentalbros.cz (hidden until approved). Candidates to confirm: RecruitShield, Valkyra, Job Seeker Toolkit. The wall is one instanced mesh with screenshots in one atlas. A case view is a DOM panel: screenshot, problem, what was built, stack, result, live link.

**2.2 Career pages.** This floor sells. Order of content: one-sentence promise, who it is for, the before/after case, the X-ray input, contact button. Keep motion minimal here.

**3 Content.** Barush supplies: 15 to 20 painting photos with title, year, medium, size and availability; one paragraph per project; DentalBros before/after screenshots and any numbers. Cursor converts images with `scripts/convert-placeholders-webp.mjs` (rename it), fills `content.json`, removes `"placeholder": true` items and the placeholder assets.

**4 Backend.** Split into three PRs in this order: forms, admin, X-ray.

### Order rules

- A visual phase and a bug fix never share a PR.
- If production is broken, a hotfix PR goes first and everything else waits.
- Real content waits until the experience phases (through 2.2) are stable, so images are prepared once.

## 10. Phase 2.0 spec: universe and stardust

The background becomes baked deep space plus one layer of stars, and the platforms are assembled by about 6,000 to 16,000 dust particles animated entirely in a vertex shader. No GPGPU, no per-frame CPU work, and nothing added to the boot path.

### Why this design

- A one-shot 2-second assembly needs no physics, so particles are a pure function of `(seed, target, uProgress, uTime)`. One uniform drives everything; skip, replay and reverse are free. This is the pattern taught in [Three.js Journey, Particles Morphing](https://threejs-journey.com/lessons/particles-morphing-shader).
- Float render targets have a long history of breaking on iOS ([three.js #9628](https://github.com/mrdoob/three.js/issues/9628), [Apple forum thread](https://developer.apple.com/forums/thread/727443)), and transform feedback is not supported in `WebGLRenderer` ([three.js #30185](https://github.com/mrdoob/three.js/issues/30185)).
- Live procedural nebula costs milliseconds per frame even on laptops ([Casual Effects starfield](http://casual-effects.blogspot.com/2013/08/starfield-shader.html)). Baked once, it costs one texture read.

### Part A: background (PR 2.0a)

**`space/nebula-bake.js`**

- At WebGL init, render an fbm noise shader ONCE into an RGBA8 render target (\~512x1024 portrait, 1024x512 landscape; equirect if camera rotation should shift it). Then dispose the bake material.
- Background pass per frame: fullscreen triangle, one texture sample, vignette, gain uniform `uBgGain`, plus dither of about 1/255 from a 64x64 blue-noise tile to stop banding ([method](https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/)).
- Palette: ink base, bone-tinted dust clouds at 4 to 6% brightness, accent tint at most 8% in one region.
- Re-bake only when the aspect ratio changes a lot, and after `webglcontextrestored`.

**`space/stars.js`**

- One `THREE.Points`, one draw call. Counts: 1,500 low tier, 3,000 modern phone, 5,000 desktop.
- Brightness by power law (`pow(rand, 6..8)`): most stars faint, very few bright. Size 1 to 2.5 device px; 1 to 3% hero stars at 3 to 5 px.
- Color: mostly bone, \~15% cool blue-white, \~5% faint amber, saturation under 15%.
- Never draw below 1 device px; fade alpha instead. Twinkle on at most 30% of stars, slowly, only while the loop runs.
- Two or three depth shells with small pointer/gyro parallax (0.02x, 0.06x, 0.15x).
- Shader hashes must be sin-free and `uTime` wrapped, for low-precision mobile GPUs.

**CSS:** `body` gets a faint radial gradient in the same tones, so the page never flashes flat black before WebGL.

**Per floor:** in the corridor set `uBgGain` to about 0.35 and twinkle off. Paintings stay unlit, `toneMapped: false`, no fog.

### Part B: stardust assembly (PR 2.0b, after 2.0a is merged)

**`intro/dust.js`** — one `THREE.Points`, additive blending, `depthWrite: false`.

| Attribute / uniform | Meaning |
| --- | --- |
| `aTarget` (vec3) | Landing point on a platform, sampled analytically on the 5 boxes and transformed by each instance matrix |
| `aSeed` (float) | Random per particle; start position, delay and swirl derive from it |
| `aEdge` (float) | 1 for edge samples; they land earlier so the outline reads first |
| `uProgress` 0..1 | Flight |
| `uMaterialize` 0..1 | Glass appears, dust under it fades |
| `uQuantize` 0..1 | Final snap to the mosaic cell grid ("dust becomes code") |
| `uPixelRatio`, `uSize`, `uMaxPointSize`, `uStarRadius`, `uTime` | Sizing and timing |

- **Sampling:** about 35% of particles on edges (mostly the top rim), 55% on top faces, 10% on sides. Shuffle the order so any prefix is an even subset.
- **Start:** `sphereDir(seed) * uStarRadius`, using the same hash as `stars.js`, so dust visibly leaves from star positions.
- **Timeline per particle:** `dur = 0.55`, `delay = (1 - dur) * stagger`, `t = clamp((uProgress - delay) / dur, 0, 1)`, ease-out cubic. Stagger mixes randomness with platform order (bottom to top) and subtracts 0.12 for edges.
- **Swirl:** rotate the start-to-target path around the stack's Y axis by an angle that decays with `(1 - e)^2`. Desktop may add curl noise.
- **Landing:** small damped bounce along the platform normal; brief brightness flare, then fade as glass appears.
- **Point sprite:** soft round falloff from `gl_PointCoord`. Size attenuated by depth, clamped to `[1, ALIASED_POINT_SIZE_RANGE max]`. Average 3 to 4 device px on phones.
- **Counts:** 4,000 to 6,000 low tier, 10,000 to 16,000 modern iPhone, 25,000 to 40,000 desktop. If frame time exceeds 20 ms for 10 intro frames, halve with `geometry.setDrawRange`.
- **Leftovers:** 3 to 5% of particles stay as faint motes near platform edges.

**Slab material patch (`slab-material.js`)**

- Add `uMaterialize` and a compile-time `MATERIALIZE` variant: `if (noise > uMaterialize + uEdge) discard;` plus a thin bright band at the threshold (bone with a little accent). Technique from [Codrops dissolve effect](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/), run in reverse.
- Dust alpha fades by the same noise sampled at its target, so dust disappears exactly where glass appears. This removes the pop.
- After the intro, switch back to the normal variant so the idle shader has no `discard`.

**`intro/sequencer.js`** — time-based, no library.

| Mode | When | Total |
| --- | --- | --- |
| `full` | First visit in a session | at most 2.4 s: stars 0 to 0.3, flight 0.2 to 1.7, materialize 1.3 to 2.0, settle to 2.4 |
| `short` | Repeat visit (`sessionStorage`) or deep link to a floor | at most 0.8 s |
| `reduced` | `prefers-reduced-motion` | 300 ms fade, no flight |

- Any `pointerdown`, `keydown`, `wheel` or `touchstart` completes the intro within 150 ms.
- Rail, links and scrolling work from first paint; the intro never blocks them.
- The intro starts only when `webglPhase === ready`. If WebGL is not ready, there is no intro and nothing waits.
- No composer during the intro. The nova stays reserved for opening a floor.

### Acceptance criteria

1. Lighthouse mobile on the preview: LCP within 50 ms of baseline, score at least 93, TBT increase at most 30 ms, no new task over 50 ms.
2. Added JS at most 25 KB compressed. Zero image downloads for the background.
3. Draw calls: at most 3 extra during the intro, at most 2 extra at rest.
4. At least 55 fps during the intro on an iPhone 12-class phone; at least 30 fps on the low tier; correct duration in iOS Low Power Mode.
5. Durations and skip behavior as in the table above.
6. Zero frames when frozen. A frozen frame still looks complete.
7. No frame over 50 ms when a new material first renders (`compileAsync` covers dust, stars, background and the materialize variant).
8. Corridor screenshots of paintings match source colors.
9. Proof in the PR: five frames across the intro at 390 and 1440, a skip recording, and a reduced-motion screenshot.

### Caveats to pass on to Cursor

- Particle counts and frame-time figures are estimates from fill-rate arithmetic. Measure on a real iPhone before fixing them.
- Query point-size limits at runtime; do not assume a value.
- Tutorials assume a bundler and GSAP. Port imports to the import map and use the sequencer.
- Reference for restraint and craft: [Igloo Inc case study](https://www.awwwards.com/igloo-inc-case-study.html).

## 11. Backend (Phase 4)

Three small serverless features on Vercel `/api`, each its own PR: form delivery, an admin for content, and the Career Page X-ray. The front end stays static; the backend only sends mail, stores records and serves `content.json`'s shape.

### Shared rules

- Node serverless functions in `/api`, plain JavaScript, no framework.
- Secrets only in Vercel environment variables (Production and Preview) and in `.env.local` for local runs. Add each name to `.env.local.example`.
- Every endpoint: validate input on the server, rate-limit per IP, return JSON `{ ok, error? }`, never echo secrets or stack traces.
- `vercel.json` rewrites must keep `/api/*` out of the SPA rewrite.
- `check-static` learns to verify that every `/api` file parses.

### 4a. Forms: contact and painting inquiry

| Piece | Decision |
| --- | --- |
| Endpoint | `POST /api/contact` with \`{ name, email, message, kind: "contact" |
| Spam protection | reCAPTCHA v3 (invisible); verify the token server-side; reject low scores; add a hidden honeypot field |
| Delivery | Resend, to `barbora@recberry.com`, from a verified sending domain; reply-to = the visitor |
| Storage | MongoDB collection `messages` (timestamp, kind, itemSlug, name, email, message, score) |
| Front end | Inquiry modal in painting detail; contact panel at the end of About and on career pages. States: idle, sending, sent, error. The address itself is never printed on the site. |
| Env | `RESEND_API_KEY`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET`, `MONGODB_URI`, `CONTACT_TO` |

Done when a test message from the preview arrives by mail and appears in the collection, and an invalid token is rejected.

### 4b. Admin

- Route `/admin`, separate plain HTML page, not part of the 3D experience, excluded from search engines.
- One user. Login with a password checked against a hash in env; session in an HTTP-only, secure, same-site cookie.
- Functions: list, create, edit, reorder, hide/show (`approved`) for paintings and projects; edit floor texts; view messages.
- Image upload: original goes to Vercel Blob (or another object store Barush picks); a function creates the 512 px thumb and 2048 px WebP with Sharp.
- On upload, Gemini suggests alt text and Barush edits it; Anthropic API is the fallback provider.
- Public read: `GET /api/content` returns the `content.json` shape from MongoDB, cached at the edge for a short time. `content-loader.js` tries the API, falls back to the static `content.json`.
- Env: `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`.

Done when Barush adds a painting from her phone and it appears in the corridor without a deploy.

### 4c. Career Page X-ray

- Input on the career-pages floor: one URL field and a button. reCAPTCHA v3 and a strict rate limit (for example 3 per IP per day).
- `POST /api/xray { url, token }`: fetch the page server-side (timeout, size cap, http/https only, block private and local addresses), extract visible text and structure, send it to Gemini with Barush's employer-branding rubric.
- Output: a score per rubric area and three to five concrete fixes, as strict JSON that the page renders. Then a contact button with the URL prefilled.
- The rubric is Barush's know-how and lives in a server-side prompt file, never in client code.
- Store each request (URL, scores, timestamp) as a lead in MongoDB.
- Fetched page text is untrusted input: the prompt must tell the model to ignore any instructions inside it.

Done when three real careers pages return sensible, different scorecards and a blocked address is refused.

### Order and dependencies

1. 4a needs: Resend key and verified domain, reCAPTCHA keys for the live domain and `localhost`, a MongoDB cluster.
2. 4b needs 4a's database and an object store choice.
3. 4c needs Barush's rubric written down first.

## 12. Cursor brief template and lessons learned

Every brief to Cursor follows one template, and every reply from Cursor is checked against one list. Most lost time on this project came from features reported as done without anyone looking at them.

### Brief template (the architect fills this in)

```
PHASE <n> — <NAME>
Standing workflow applies (.cursor/rules/workflow.mdc): branch
<branch-name> from latest main, small commits, PR, do NOT merge.
Read docs/ARCHITECTURE.md sections <x, y> first.

CONTEXT
<2–4 lines: what exists now, what the owner saw or wants, why>

SCOPE
1. <concrete change, with file/module names where known>
2. ...

OUT OF SCOPE
- <what must not be touched in this PR>

CONSTRAINTS
- Budgets from section 6 hold (name the ones at risk).
- Fallbacks: reduced motion = <...>; no WebGL = <...>.
- Nothing new in the boot path; lazy-load on <trigger>.

ACCEPTANCE CRITERIA
- <measurable statement>
- ...

PROOF IN THE PR BODY (preview URL, real input)
- Screenshots at 390x844 and 1440x900 of <the feature>.
- <for motion: 3 frames 1 s apart or a 5 s recording>
- __APP_STATE values: <...>
- <Lighthouse / draw calls / memory if relevant>
If the result does not match this spec, say so. Don't call it done.
```

### Report-only brief (use when the state is unclear or something broke)

```
STOP — no code changes. Report only.
Observed: <what the owner saw, where, on which device>.
1. Which build is on production and on the preview (build meta SHA)?
2. Reproduce with real input at 390 and 1440. Screenshots.
3. __APP_STATE at that moment.
4. Root cause: exact file and line.
5. Fix plan in the smallest steps, each with how it will be proven.
```

### Checklist when Cursor says "done"

- [ ] Is there a PR number, branch and preview URL?
- [ ] Are both required checks green?
- [ ] Does the PR body show the feature itself at 390 and 1440?
- [ ] For motion: are the frames visibly different?
- [ ] Did any test change? If so, does it still use real input only?
- [ ] Did anything move into the boot path? Are Lighthouse numbers posted?
- [ ] Does anything in the report contradict an earlier report?
- [ ] Is anything listed as deferred that the spec required?

Only then tell Barush it is ready for her device review.

### Lessons learned on this project

| What happened | Rule that came out of it |
| --- | --- |
| Three PRs reported the about ball as done; the text never moved on production | No feature is done without screenshots or frames of the feature from the preview |
| A `.gitignore` rule `build/` silently excluded Three.js; production lost all 3D with no error | `check-static` verifies every referenced file is tracked; anchor ignore rules to the repo root |
| After an Instant Rollback, merges deployed but the domain stayed on the old build | Check the domain's build marker after every merge; undo the rollback after the fix |
| A test called an internal function and passed while taps were broken for users | Tests act through real input only |
| The full smoke suite ran 9 minutes in CI, flaked, and app code grew test-only branches | Fast static and boot checks gate merges; the long suite runs locally; no test code paths in the app |
| Several heavy test runs overlapped and killed each other | One smoke process at a time (lockfile) |
| Two parts of the code disagreed on what "WebGL ready" means | One definition, set in one place |
| A mode hid the flat text and the 3D failed, leaving an empty floor | A fallback must be visible before the enhancement replaces it |
| The crawl loop took 78 seconds, so it looked frozen | Motion must be obvious within one second |
| A bug fix, a content change and a redesign sat uncommitted together | One concern per PR; commit before starting the next thing |
| A rescue push included an API key | Secret scan before any backup push; a finding means stop |
| Cursor's embedded browser has reduced motion on and no real GPU | Cursor's own view is not proof of motion or WebGL; Barush's phone is the deciding signal |

### When to switch the model

- **Opus:** shaders, 3D geometry and camera work, anything where the result is judged by eye (about ball, slabs, stardust, monitor wall), and root-cause hunts that failed once.
- **Sonnet:** DOM views, routing, forms, API functions, content, tests, CI, cleanup, documentation.

## 13. Open decisions for Barush

Nine questions are still open; none blocks Phase 1.7, and the first three are needed before Phase 2.1.

- [ ] **Slab variant:** `?slab=a` (coarser mosaic) or `?slab=b` (finer, softer)?
- [ ] **Code floor projects:** add RecruitShield, Valkyra and Job Seeker Toolkit next to vairee.ai, recberry.com and dentalbros.cz?
- [ ] **DentalBros:** written approval from the owner to show the site and the before/after.
- [ ] **Prices:** shown on paintings, or always "on inquiry" with only availability visible?
- [ ] **Accent color:** keep lime `#c6ff00`, or choose another once a logo exists?
- [ ] **Contact:** forms only (current), or also a visible LinkedIn link?
- [ ] **Image storage for the admin:** Vercel Blob, or another service?
- [ ] **X-ray rubric:** the criteria Barush uses to judge a careers page, written as a list.
- [ ] **Sound:** a subtle optional soundtrack or interaction sounds, off by default?

### Materials to gather for Phase 3

- [ ] 15 to 20 painting photos, each with title, year, medium, size in cm, availability
- [ ] One paragraph per web project: what it is, her role, stack, one result
- [ ] DentalBros careers page: before and after screenshots, any numbers
- [ ] Resend API key and verified sending domain
- [ ] reCAPTCHA v3 keys for `abaddion.com` and `localhost`
- [ ] MongoDB connection string

## Sources

- [Three.js Journey: Particles Morphing](https://threejs-journey.com/lessons/particles-morphing-shader)
- [Codrops: Dissolve effect with shaders and particles](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/)
- [three.js issue #9628: float render targets on iOS](https://github.com/mrdoob/three.js/issues/9628)
- [three.js issue #30185: transform feedback in WebGLRenderer](https://github.com/mrdoob/three.js/issues/30185)
- [Apple Developer Forums: WebGL issues after iOS 16.4](https://developer.apple.com/forums/thread/727443)
- [Casual Effects: Starfield Shader](http://casual-effects.blogspot.com/2013/08/starfield-shader.html)
- [frost.kiwi: fixing color banding with dithering](https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/)
- [Awwwards: Igloo Inc case study](https://www.awwwards.com/igloo-inc-case-study.html)
- [W3C: Understanding Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

Project facts come from Cursor's reports and Barush's reviews between 23 October and 11 November 2026.
