# PR #3 — Glass chess slabs (after PR #2 merged)

Visual-only change; **one InstancedMesh draw call per stack**, no textures beyond the existing floor atlas.

## Compare variants on preview

- `?slab=a` — default: stronger RGB split, coarser mosaic, faster re-seed (~3s)
- `?slab=b` — softer frost, finer mosaic, slower re-seed (~4.5s), brighter spec sweep

## Direction

- Drop visible monitor grid / bezels (shader no longer draws cell bezels).
- **Under glass:** atlas region sampled as irregular glitch mosaic (variable block size, shift, RGB split, ~15% dropout, slow re-seed; static when `prefers-reduced-motion`).
- **Glass top:** fresnel, specular sweep (time + view), etched **8×8 chess** frost (alternating squares), inner reflection.
- **Thickness:** `SLAB_H` increased; side faces = lit bevel + merged edge lines.
- **Focus:** unfocused = more frost, dimmer mosaic; focused = clearer glass, brighter mosaic, signal tint on chess squares.

## Files

- `js/shaders/slab-material.js` — mosaic + glass composite
- `js/modules/stack.js` — thicker slab, variant from URL

## Out of scope (this PR)

- Atlas builder still rasterizes floor thumbs into rows (source colors only; not shown as monitor wall).
