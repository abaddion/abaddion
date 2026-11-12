# Microsoft Clarity (abaddion.com)

## Setup

1. Create a project at [clarity.microsoft.com](https://clarity.microsoft.com/) for **www.abaddion.com**.
2. In **Vercel** → glitch-portfolio project → **Environment Variables**, add:
   - `CLARITY_PROJECT_ID` = your project ID (optional; build defaults to **`zcn4aq0rzr`** if unset).
3. Redeploy. The build script injects the Clarity tag into `index.html` and `games/interactive-ink/index.html`.

Local `npm run check:static` / `./start.sh` do **not** run the inject step unless you run:

```bash
VERCEL_GIT_COMMIT_SHA="$(git rev-parse HEAD)" CLARITY_PROJECT_ID=your_id node scripts/inject-build-meta.mjs
```

## What you can measure

| Signal | Where |
|--------|--------|
| Site visits & paths | Clarity **Dashboard** — filter URL contains `/games` or `/games/interactive-ink/` |
| Games floor | Custom event `games-floor` (SPA route `/games`) |
| Actually played ink | Custom event `interactive-ink-engaged` (first pointer down on canvas) |
| Route changes | Virtual page tags on each History API navigation (`route-games`, etc.) |

In Clarity: **Dashboard → Filters → Custom tags / Smart events** once events have collected data.

## EU / consent

Clarity supports consent mode for EEA visitors. In Clarity project **Settings → Setup**, configure cookie defaults for EU if you add a banner later. Until then, follow Microsoft’s guidance for personal portfolio analytics.
