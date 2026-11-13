# Games — kiosk / kid play on mobile

You **cannot** fully “lock” mobile Safari from inside a normal tab: the OS edge back-swipe and home bar still exist. You *can* make accidents much rarer.

## Best setup (parents)

1. Open the game, e.g. **`/games/calm-corner/`** or **`/games/smash-town/`**.
2. Tap **Full screen** (bottom-right) once — hides the address bar on many phones.
3. **Add to Home Screen** (Share → Add to Home Screen). Each kid game has a small `manifest.webmanifest` so it opens **standalone** without browser tabs.

## What the shared scripts do

| File | Role |
|------|------|
| `games/kiosk.css` | `overscroll-behavior`, safe areas, fullscreen button styling |
| `games/kiosk.js` | Wake lock, overscroll guard, optional back-swipe buffer, fullscreen toggle |

Included from each game’s `index.html` via `../kiosk.css` and `../kiosk.js`.

## Disable pieces

On the script tag:

- `data-guard-back="0"` — do not trap `history.back` (edge swipe buffer).
- `data-fullscreen-button="0"` — hide the parent fullscreen control.

## Games with text inputs

Interactive Sand keeps normal behaviour for the chat field; overscroll prevention skips `input` / `button` targets.
