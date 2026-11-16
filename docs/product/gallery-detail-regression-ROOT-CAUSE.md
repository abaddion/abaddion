# Gallery detail regression — root cause

**Observed:** On production (iPhone), tapping a corridor painting showed the inquiry/contact UI immediately instead of the technical-drawing detail view.

## Breaking change

| Item | Detail |
|------|--------|
| **PR** | #21 — Phase 2.2 opened floor glass views (`a89e562`) |
| **Not** | #22 revert of #20 (corridor/detail modules unchanged by revert) |

## Mechanisms

1. **`card-layer.js` ~334** — `html.floor-open-canvas` only applied when expand `progress > 0.5`, so during open the DOM floor card could sit above WebGL (`#glitch-canvas` z-index 32 is gated on `floor-open-canvas`). Touches missed the corridor raycast; fallback DOM (`renderCanvas()` grid/lightbox) remained in the shell markup.

2. **`css/main.css` ~940 (pre-fix)** — `.detail-inquiry { display: flex }` without a `[hidden]` override. **Safari/WebKit** can show the inquiry overlay when detail opens even though `hidden` is set on the legacy panel.

3. **`card-layer.js` ~247** — calls `webgl.backToCorridorFromDetail()` added in #21 but **method was never implemented** on `WebGLLayer`, breaking corridor return from the glass back button.

4. **`input.js` ~158** — `Escape` closed the whole floor while detail was open, fighting detail keyboard handling.

## Fix (PR 1)

- Enable `floor-open-canvas` at `progress > 0.02`; hide legacy grid while corridor is active.
- Inquiry uses `<dialog>`; inquire control is HTML (not SVG `foreignObject`).
- Implement `backToCorridorFromDetail`, corridor walk buttons, smoke-boot tap regression.