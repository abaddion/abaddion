# Phase 1.2 — Honest measurement

## Vercel preview (protected)

1. In Vercel: **Project → Settings → Deployment Protection → Protection Bypass for Automation**. Create a secret.
2. Copy `.env.local.example` → `.env.local` and set `VERCEL_AUTOMATION_BYPASS_SECRET` (never commit).
3. Deploy preview only: `npx vercel --yes` (no `--prod`).
4. Run three mobile Lighthouse passes against the preview URL:

```bash
source .env.local  # or export manually
node scripts/run-lighthouse-preview.mjs https://your-preview.vercel.app
```

The script passes:

```text
x-vercel-protection-bypass: <secret>
x-vercel-set-bypass-cookie: true
```

## Local (compressed)

Python’s `http.server` does **not** compress — do not use it for Lighthouse JS transfer numbers.

```bash
npx serve -s . -l 8799
node scripts/run-lighthouse-preview.mjs http://127.0.0.1:8799 --local
```

Label local results as **local (serve, compressed)** in reports.

## Targets (Phase 1.2)

| Metric | Target |
|--------|--------|
| Performance | ≥ 90 |
| LCP | < 2.0 s |
| TBT | < 200 ms |
| CLS | < 0.1 |
| JS transfer (scripts, wire) | ≤ 220 KB |

Re-check runtime: PASS `00` idle, 0 frames after 8 s idle, ~60 fps floor change @ 4× CPU.
