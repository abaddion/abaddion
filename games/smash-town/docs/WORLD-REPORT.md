# Smash Town — current build (pre–bigger world, `main`)

## World size
- Grid: **7×7** blocks (`LOTS=7`), block **14** units, road **6** → pitch **20**.
- Playable half-width **~70** units; hard clamp **EDGE ≈ 77**.
- Ground plane **~188×188** units (single canvas texture).

## Town generation (`town.js`)
- One **CanvasTexture** for grass + grid roads.
- Each lot: random **building** (3×3 columns, 2–5 floors), **tower + wall + crates**, **houses + trees**, or **park**.
- Smashables: **one InstancedMesh** (up to **3200** boxes), block FSM (STATIC → FLY → DEBRIS → RISE).
- Rebuild smashed structures after **14 s** if car **> 38** units away.

## Car (`actors.js`)
- Touch/keyboard sets `car.target`; car steers and accelerates toward it (`CAR_SPEED` 16, `CAR_TURN` 3.4).
- Grip/drift model; paint splats cause slide + tyre tracks.
- Position clamped to `±town.edge`; **Y fixed** (hop animation only).

## Camera (`main.js`)
- Perspective **40°**, height **50** (×1.25 portrait).
- Eased follow + small crash shake; looks at car on flat **Y=0**.

## Collision / smash
- Car sphere (~**1.35** radius) vs static blocks at **car height** via `town.smash()`; knock launches blocks with simple gravity (no block–block collision).

## Smashable content
- Buildings, trees (block stacks), walls, crates; optional **monster** and **paint** (not fail state).

## Performance (automation, not iPhone)
- **~1** major draw call for town blocks (instanced) + car/monstr meshes; typical **< 30** render calls in Puppeteer smoke.
- **FPS** not gated in CI; SwiftShader desktop often **60** on smoke route.

## After this PR (target)
- **~4×** area (`WORLD_HALF` 148), heightfield terrain, forest / river / mountains zones, chunked props, respawn **20–30 s** off-camera.
