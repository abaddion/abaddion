# Interactive Sand

- **Play:** `/games/interactive-sand/`
- **API:** `POST /api/sand-chat` (`api/sand-chat.js` on Vercel)

## Gemini (cheap / free)

| Variable | Required | Default |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes (Vercel prod) | — |
| `GEMINI_MODEL` | No | `gemini-2.0-flash-lite` |

`maxOutputTokens` is capped at **80** (replies ≤ ~25 words). History is capped at 10 turns.

## Local dev

- **`npx serve`** — chat uses **scripted fallbacks** (no API).
- **`vercel dev`** — set `GEMINI_API_KEY` in env; call real Gemini.

## Security

Never commit `games/**/.env` or API keys. Keys live only in Vercel (and your password manager).
