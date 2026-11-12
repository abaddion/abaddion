# Sand Chat API

Production handler: **`/api/sand-chat.js`** at the repo root (Vercel serverless).

Set in **Vercel → Environment Variables**:

- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey)
- `GEMINI_MODEL` — optional; overrides `model` in repo root **`api/sand-chat.config.json`**

Do not commit `.env` files in this folder.
