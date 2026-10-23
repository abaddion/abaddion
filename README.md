# Barbora Jenšík (Barush)

Founder · TA practitioner · 20+ years in technical recruitment. Building products at the intersection of hiring, OSINT, and creative tech.

## What I'm building

| Project | What it is | Status |
|---------|------------|--------|
| [vairee.ai](https://vairee.ai) | Passive talent matching | Pre-launch |
| [Recberry](https://recberry.com) | TA consulting & TA Efficiency Framework | Active |
| [RecruitShield](https://recruitshield.com) | Recruitment scam scanner | Live |
| Valkyra | Child online safety scanner | Active |
| [Job Seeker Toolkit](https://recberry.com/job-seekers) | Digital toolkit for candidates | Active |

📫 [LinkedIn](https://linkedin.com/in/barushbalazikova) · barbora@recberry.com

---

# Glitch Portfolio (`www.abaddion.com`)

Vanilla ES modules + vendored Three.js r160. Five stacked board floors, nova open transition, canvas gallery corridor, History API routes.

## Run locally

```bash
npm install          # puppeteer for smoke (optional)
./start.sh           # npx serve — http://localhost:8799
node scripts/smoke.mjs
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

## Content

Edit `content.json`. Items with `"approved": false` are hidden on production hostnames; visible on localhost and private LAN.
