# Interactive Sand

- **Play:** `/games/interactive-sand/`
- **API:** `POST /api/sand-chat` (`api/sand-chat.js` on Vercel)

## Gemini (cheap / free)

| Variable | Required | Overrides |
|----------|----------|-----------|
| `GEMINI_API_KEY` | Yes (Vercel prod) | — |
| `GEMINI_MODEL` | No | `model` in `api/sand-chat.config.json` |
| `GEMINI_MAX_OUTPUT_TOKENS` | No | `maxOutputTokens` in config |
| `GEMINI_TEMPERATURE` | No | `temperature` in config |

**Defaults live in `api/sand-chat.config.json`** (change model there in a PR, or set env on Vercel without touching the handler). If the configured model was retired, the handler lists models and retries with the cheapest flash/lite. History is capped at 10 turns.

## Local dev

- **`npx serve`** — chat uses **scripted fallbacks** (no API).
- **`vercel dev`** — set `GEMINI_API_KEY` in env; call real Gemini.

## Production checklist

1. **`GEMINI_API_KEY`** on Vercel (Production + Preview) — without it, `/api/sand-chat` returns 500 and the UI shows a “could not reach the surface” line (not scripted chat).
2. Redeploy after env changes.
3. The API handler must use **ESM** `export default` (repo `package.json` has `"type": "module"`).

## Security

Never commit `games/**/.env` or API keys. Keys live only in Vercel (and your password manager).
