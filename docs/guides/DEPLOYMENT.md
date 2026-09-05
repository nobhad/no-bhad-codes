# Deployment Guide

Two hosts, deployed independently from the same repository. The
[Ops Runbook](../OPS_RUNBOOK.md) covers what to do once it is running;
[Configuration](../CONFIGURATION.md) lists every environment variable.

## Topology

| Host | Serves | Built by |
|---|---|---|
| **Vercel** | The static site: `index.html`, `design-system.html`, `404.html`, `public/` (including `data/portfolio.json`, `sw.js`, `sitemap.xml`) | `npm run build` → `dist/` (`vercel.json`) |
| **Railway** | The Express API and the server-rendered portal shells: `/api`, `/portal`, `/admin`, `/client`, `/intake`, `/dashboard`, `/set-password`, `/forgot-password`, `/reset-password` | `npm run build && npm run build:server`, start `npm run start:server` (`railway.json`) |

`vercel.json` rewrites every Railway path to
`https://no-bhad-codes-production.up.railway.app`, so visitors only ever see
`www.nobhad.codes`. The apex redirects to `www`; canonical URLs, Open Graph
tags, `robots.txt` and the sitemap all use `www`.

Railway runs the health check at `/health/live` and mounts a volume at
`/app/data` for the SQLite database, backups and uploads.

## What triggers a deploy

- **Vercel** builds on every push to `main`.
- **Railway** builds only when a pushed file matches `build.watchPatterns`
  in `railway.json` (`server/**`, `shared/**`, the migration and asset-copy
  scripts, `package.json`, `package-lock.json`, `tsconfig.json`,
  `railway.json`). A front-end-only push does not rebuild the API.

Before pushing, `npm run railway:will-deploy` tells you which of the two
will happen for the commits you are about to push.

## Production environment (Railway)

Set these in the Railway service, never in a committed file. Required with
no default:

```bash
NODE_ENV=production
JWT_SECRET=                  # 32+ random characters
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=         # bcrypt hash; ADMIN_PASSWORD is for development
BUSINESS_NAME=
BUSINESS_EMAIL=
DATABASE_PATH=/app/data/client_portal.db
FRONTEND_URL=https://www.nobhad.codes
WEBSITE_URL=https://www.nobhad.codes
```

Usually also set: `EMAIL_ENABLED=true` with the `SMTP_*` and `FROM_EMAIL`
values, `SENTRY_DSN`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`,
`ANTHROPIC_API_KEY` if the AI features are on, and the Google Drive backup
credentials. `PORT` is supplied by Railway.

Vercel needs nothing at build time for the static site; `VITE_*` variables
are only read if the third-party contact-form backends are enabled.

## Deploy checklist

- [ ] `npm run typecheck && npm run lint && npm run test:run && npm run build` pass locally (the `pre-push` hook runs these)
- [ ] CI is green on `main`
- [ ] Migrations are additive or the schema-drift check will refuse to boot (see the runbook's *Schema drift*)
- [ ] After both hosts finish: `npm run check:deploy` — it fetches the live pages on both hosts and confirms the asset URLs they reference actually resolve, which is how a Vercel/Railway hash mismatch shows up
- [ ] Spot-check `https://www.nobhad.codes/`, `/#/projects`, `/portal`, `/api/health`

## Rollback

Vercel: promote the previous deployment from the dashboard. Railway: redeploy
the previous build from the deployments list. The database is on the volume
and is not touched by a redeploy; if a migration has to be undone, restore
from a backup as described in the runbook.

## Database backup

```bash
npm run db:backup       # local snapshot into DATABASE_BACKUP_PATH
npm run backup:drive    # offsite copy to Google Drive (service account)
```

The scheduler also takes automatic backups; `/api/admin/backups` lists them.
