# Calm Corner

- **Play:** `/games/calm-corner/`
- **Listed on:** `/games` (from `content.json` → games floor `calm-corner` item)
- **Deep link:** `/games/calm-corner/#pond` (hash opens a mini-world after load)

Static Three.js mini-scenes (bubbles, rain, sky, pond, breathing balloon). No server API.

## Files

| Path | Role |
|------|------|
| `games/calm-corner/index.html` | Shell + picture menu |
| `games/calm-corner/js/main.js` | Router, input, renderer |
| `games/calm-corner/js/*.js` | One module per mini-game |
| `games/calm-corner/vendor/three.min.js` | Bundled Three (r149) |

Clarity: build injects into `index.html` via `<!-- __CLARITY_SNIPPET__ -->`; event `calm-corner-play` on first scene start.
