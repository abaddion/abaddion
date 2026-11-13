# Smash Town

- **Play:** `/games/smash-town/`
- **Listed on:** `/games` (`content.json` → games floor, slug `smash-town`)

Touch or keyboard steering through a low-poly town: smash props, optional monster, car colours, Web Audio SFX.

## Files

| Path | Role |
|------|------|
| `games/smash-town/index.html` | Shell + HUD |
| `games/smash-town/js/config.js` | Tunables (`Smash.CONFIG`) |
| `games/smash-town/js/town.js` | Ground, smashables, rebuild |
| `games/smash-town/js/actors.js` | Car, monster, paint trails |
| `games/smash-town/js/main.js` | Loop, input, UI |
| `games/smash-town/vendor/three.min.js` | Bundled Three (r149) |

Clarity: build inject via `<!-- __CLARITY_SNIPPET__ -->`; event `smash-town-play` on first steer input.

Kid play on phones: **`../kiosk.js`** + home-screen install — `docs/GAMES-KIOSK.md`.
