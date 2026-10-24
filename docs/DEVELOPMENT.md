# Glitch Portfolio — development (`www.abaddion.com`)

Vanilla ES modules + vendored Three.js r160. Five stacked board floors, nova open transition, canvas gallery corridor, History API routes.

## Run locally

```bash
npm install          # puppeteer for smoke (optional)
./start.sh           # npx serve — http://localhost:8799
npm run check:static && npm run smoke:boot
npm run smoke:full   # manual, before merge
```

## Deploy

Production deploys via **merge to `main`** (Vercel Git integration). Do not use `vercel --prod`. See `.cursor/rules/workflow.mdc`.

## Routes

| Path | Floor |
|------|--------|
| `/` | identity |
| `/canvas` | canvas (+ `/canvas/:slug` detail) |
| `/code` | code |
| `/career-pages` | career pages |
| `/about` | about (+ contact form markup) |

## Docs

- `docs/PHASE1.3-REPORT.md` — reliability, state machine
- `docs/PHASE1.4-REPORT.md` — nova, corridor, mobile labels (1.4a)
- `docs/product/` — active product plans and copy notes

## Content

Edit `content.json`. Items with `"approved": false` are hidden on production hostnames; visible on localhost and private LAN.
