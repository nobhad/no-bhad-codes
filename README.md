# No Bhad Codes - Solo Freelance Portfolio & Client Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![GSAP](https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=white)](https://greensock.com/gsap/)

> Portfolio website and client management system for a solo freelance operation. The
> marketing site is vanilla TypeScript with GSAP; the client portal and admin dashboard
> are a React SPA; the API is Express on SQLite.

Live: [www.nobhad.codes](https://www.nobhad.codes) (static site on Vercel, API on Railway).

## Features

### Portfolio Website

- **Interactive business card**: 3D flip with GSAP, keyboard-operable
- **Spatial navigation**: five tiles in a plus layout with wheel, arrow-key and swipe navigation, hash routing and browser back/forward
- **Projects as a vintage TV**: channel guide, title-card tune-in, per-channel audio, case studies
- **Dark/light theme**: system preference with a manual toggle
- **Service worker**: cache-first for hashed assets, network-first for data, offline fallback page
- **Measured, not claimed**: Lighthouse (mobile) on the home page is performance 95, accessibility 100, best practices 100, SEO 100; axe-core runs in CI on 22 surfaces in both themes
- **SEO**: meta tags, Open Graph, JSON-LD structured data, sitemap

### Client Management System ("The Backend")

- **Client portal**: project status, files, invoices, messaging, agreements, payments
- **Terminal-style intake**: conversational project intake that becomes a lead
- **Leads and CRM**: pipeline with Kanban view, scoring, tasks, notes, duplicate detection
- **Proposals, contracts, invoices**: generated as PDFs with pdf-lib; Stripe payments and webhooks
- **Messaging**: threads per project or general inquiry, attachments, read state, server-sent events for live updates
- **Files**: drag-and-drop uploads with type validation
- **Scheduler**: in-process timers for reminders, escalations and email retries
- **Auth**: HttpOnly-cookie JWT for the single admin and for clients, emailed set-password invitations, passwordless magic-link sign-in
- **Operations**: health checks, circuit breakers, audit chain, schema-drift detection, backups (local and Google Drive), OpenTelemetry

### Architecture

- **TypeScript** in strict mode across client, server and shared code
- **Marketing site**: module pattern with a DI container (`src/core/`), vanilla modules under `src/modules/`
- **Portal**: React 19, React Router, Zustand, Radix primitives, Lucide icons (`src/react/`)
- **Server**: Express 5, service layer under `server/services/`, migrations under `server/database/migrations/`
- **Design tokens**: `src/design-system/tokens/`, rendered at `/design-system`

## Quick Start

### Prerequisites

- **Node.js** 22.x and **npm** 8+
- **Git**

### Installation

```bash
git clone https://github.com/nobhad/no-bhad-codes.git
cd no-bhad-codes
npm install

cp .env.example .env
# Set at least JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, BUSINESS_NAME and
# BUSINESS_EMAIL. Everything else has a default. See docs/CONFIGURATION.md.

npm run db:setup      # runs every migration
npm run dev:full      # Vite on 4000, API on 4001
```

### Development URLs

| What | URL |
|---|---|
| Marketing site | <http://localhost:4000> |
| Client portal | <http://localhost:4000/portal> (proxied to the API host) |
| Admin dashboard | <http://localhost:4000/admin> (proxied to the API host) |
| API | <http://localhost:4001/api> |
| Liveness / readiness | <http://localhost:4001/health/live>, <http://localhost:4001/health> |
| Swagger UI | <http://localhost:4001/api-docs> |

## Available Scripts

```bash
# Development
npm run dev              # Vite dev server (marketing site + portal bundles)
npm run dev:server       # API with tsx watch (restarts on change)
npm run dev:full         # Both

# Quality
npm run typecheck        # tsc --noEmit (client); server: npx tsc -p server/tsconfig.json
npm run lint             # ESLint over src, server, shared
npm run format:check     # Prettier
npm run docs:validate    # Documentation checks
npm run lint:md          # markdownlint

# Tests
npm run test:unit        # Vitest, unit
npm run test:integration # Vitest, integration (real SQLite)
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright, all projects
npm run test:e2e:a11y    # Playwright + axe-core (also runs in CI)

# Build and deploy checks
npm run build            # Static site to dist/
npm run build:server     # Server to dist/server/
npm run preview          # Serve dist/ locally
npm run check:deploy     # Smoke-check the live Vercel + Railway pair
npm run railway:will-deploy  # Will this push trigger a Railway build?

# Data
npm run migrate          # Apply pending migrations
npm run migrate:status   # Migration state
npm run db:backup        # Local backup
npm run backup:drive     # Offsite backup to Google Drive
npm run media:dimensions # Regenerate src/generated/media-dimensions.ts after portfolio media changes
```

## Project Structure

```text
no-bhad-codes/
├── index.html                 # Marketing site (Vite MPA entry)
├── 404.html, design-system.html
├── public/                    # Static assets, data/portfolio.json, sw.js, sitemap.xml
├── src/
│   ├── main-site.ts           # Marketing site entry
│   ├── portal.ts, admin.ts    # Portal / admin bundle entries
│   ├── core/                  # App bootstrap, DI container, module registry
│   ├── modules/               # Vanilla modules: animation/, audio/, ui/ (navigation, projects TV, business card, footer curtain)
│   ├── features/              # auth/ (password flows), client/ (terminal intake), main-site/ (portal login dropdown)
│   ├── services/              # data-service, router-service, contact-service, performance, visitor tracking
│   ├── components/            # Small vanilla components (consent banner, icon button, status badge)
│   ├── react/                 # Portal + admin React SPA
│   │   ├── app/               # PortalApp, routes, layout, providers
│   │   ├── features/admin/    # ~50 admin feature folders (leads, clients, projects, invoices, ...)
│   │   ├── features/portal/   # ~30 client feature folders
│   │   ├── components/, hooks/, stores/, factories/
│   ├── styles/                # Cascade-layered CSS: base, components, pages, portal, mobile, bundles
│   ├── design-system/tokens/  # Design tokens
│   └── generated/             # Build outputs checked in (media dimensions)
├── server/
│   ├── app.ts                 # Express app, route mounts, health, static portal shells
│   ├── config/                # environment.ts validation, business info, email styles
│   ├── database/              # init, pool, migrations/ (141), entities/
│   ├── middleware/            # auth, audit, cache, rate limiting, sanitization, validation
│   ├── routes/                # ~30 route modules; larger ones are folders (admin/, clients/, invoices/, ...)
│   ├── services/              # ~100 services (invoices, agreements, messaging, scheduler, AI, backups, ...)
│   ├── observability/         # OpenTelemetry, Prometheus
│   ├── templates/email/       # Email templates
│   └── views/                 # EJS shells for portal/admin/auth pages
├── shared/validation/         # Zod schemas shared by client and server
├── scripts/                   # Migrations CLI, backups, portfolio capture, deploy checks
├── tests/                     # unit/, integration/, e2e/ (Playwright)
├── docs/                      # See docs/README.md
├── vercel.json                # Static hosting + rewrites to the Railway API
└── railway.json               # API build/deploy, health check, volume
```

## Database

SQLite at `DATABASE_PATH` (default `./data/client_portal.db`), WAL mode, a small
connection pool with a busy timeout. The schema is defined only by the migrations in
`server/database/migrations/` (141 today, 169 tables). The `users` table holds the admin
and system accounts; client logins live on the `clients` table with their own password
hash. Full reference: [docs/architecture/DATABASE_SCHEMA.md](docs/architecture/DATABASE_SCHEMA.md).

## Configuration

Copy `.env.example` to `.env`. The server validates its configuration on boot
(`server/config/environment.ts`) and logs what is missing.

Required, no default:

```env
JWT_SECRET=            # at least 32 characters
ADMIN_EMAIL=
ADMIN_PASSWORD=        # or ADMIN_PASSWORD_HASH in production
BUSINESS_NAME=
BUSINESS_EMAIL=
```

Everything else (ports, database path, email, Redis, Stripe, AI, scheduler, backups,
observability) is optional with a default. The complete list, with defaults and where
each variable is read, is in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## API

All routes are mounted at `/api` and mirrored at `/api/v1`; admin-only routes sit under
`/api/admin`. Swagger UI is served at `/api-docs`. The contract lives in the route files'
OpenAPI comments; the summary below is only the entry points.

### Authentication (`/api/auth`)

| Route | Purpose |
|---|---|
| `POST /portal-login` | Unified login: the server routes admin and client by email |
| `POST /login`, `POST /admin/login` | Role-specific logins kept for compatibility |
| `POST /magic-link`, `POST /verify-magic-link` | Passwordless sign-in |
| `POST /set-password`, `POST /verify-invitation` | Invitation flow (invites email a one-time set-password link) |
| `POST /forgot-password`, `POST /reset-password` | Password reset |
| `POST /refresh`, `POST /logout`, `GET /validate` | Session lifecycle |
| `GET /profile`, `POST /resend-verification`, `GET /verify-email/:token` | Account |

The JWT is set in an HttpOnly `auth_token` cookie; response bodies never carry the token.

### Messaging (`/api/messages`)

`GET/POST /threads`, `GET /threads/archived`, `POST /inquiry`, `GET/PUT /preferences`,
`GET /unread-count`, `GET /search`, `GET /mentions/me`, `PUT /messages/read-bulk`,
`GET /attachments/:filename/download`, and `GET /analytics` (admin). Live updates reach
the portal over server-sent events.

Other route groups: clients, projects, invoices, proposals, contracts, agreements,
deliverables, document requests, questionnaires, retainers, expenses, payments and
Stripe webhooks, integrations, knowledge base, analytics, data quality, health.

## Frontend Architecture

### Marketing site (vanilla modules)

Modules extend `BaseModule` (`src/modules/core/base.ts`) and are registered in
`src/core/modules-config.ts`; heavy ones load lazily. Key modules:

- `modules/animation/intro-animation.ts`: the coyote-paw intro (skipped for deep links)
- `modules/animation/page-transition.ts`: the spatial map and its camera
- `modules/ui/navigation.ts`, `modules/ui/submenu.ts`: header, menu, compass cues
- `modules/ui/business-card-*.ts`: card rendering and interactions
- `modules/ui/projects.ts`: the TV, channel guide, tune-in sequence, case-study pages
- `modules/ui/footer-curtain.ts`: the footer band revealed behind the page
- `modules/audio/tv-sfx.ts`: channel audio

Services registered with the container: `RouterService`, `DataService` (reads
`public/data/portfolio.json`), `ContactService` (submits to the API by default; Formspree,
EmailJS and Netlify Forms are selectable backends), `PerformanceService`,
`VisitorTrackingService` (consent-gated), `CodeProtectionService`.

### Portal and admin (React)

`src/react/portal-entry.tsx` mounts `PortalApp`; routes are lazy per tab
(`src/react/app/PortalRoutes.tsx`). State is Zustand; API access goes through
`src/utils/api-client.ts` with CSRF headers. See
[docs/features/PORTAL_ARCHITECTURE.md](docs/features/PORTAL_ARCHITECTURE.md).

## Security

- JWT in HttpOnly cookies, CSRF token header, rate limiting per route group
- Input validation with Zod (`shared/validation/`), HTML sanitization, parameterized queries
- Helmet, CORS, file type and size validation on uploads
- Audit log with a tamper-evident hash chain; idempotency keys on payment routes
- Structured logging with request correlation IDs; Sentry in production

## Testing

```text
tests/
├── unit/           # Vitest (services, routes, middleware, utils, hooks)
├── integration/    # Vitest against a real SQLite file
├── e2e/            # Playwright: navigation, business card, contact form, accessibility, portal and admin flows
├── mocks/ setup/
```

Unit and integration suites, the accessibility sweep and the build all run in CI on
every push (`.github/workflows/ci.yml`). The portal and admin e2e flows need a running
API and credentials (`E2E_ADMIN_PASSWORD`, `E2E_CLIENT_EMAIL`, `E2E_CLIENT_PASSWORD`).

## Deployment

Two hosts, deployed independently:

- **Vercel** builds `npm run build` and serves `dist/` (the marketing site, the design
  system page, `404.html`). `vercel.json` rewrites `/api`, `/portal`, `/admin`, `/client`,
  `/intake`, `/dashboard` and the password pages to the Railway host.
- **Railway** builds `npm run build && npm run build:server` with Nixpacks, starts
  `node dist/server/server/app.js`, health-checks `/health/live`, and mounts a volume at
  `/app/data` for the SQLite file and uploads.

After a deploy, `npm run check:deploy` fetches both hosts and confirms the served HTML
resolves to assets that exist. Details: [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md)
and [docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md).

## Contributing

Conventional Commits, enforced by commitlint in the `commit-msg` hook; `pre-commit` runs
ESLint (with fixes) and the client typecheck; `pre-push` runs lint, typecheck, the unit
suite and a build. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[.husky/README.md](.husky/README.md).

## Troubleshooting

```bash
# Ports 4000/4001 in use
lsof -ti:4000 | xargs kill -9; lsof -ti:4001 | xargs kill -9

# Reset the local database
rm data/client_portal.db && npm run db:setup

# Stale build
rm -rf dist && npm run build
```

## License

MIT. See [LICENSE](LICENSE).

## Author

Noelle Bhaduri

- Website: [www.nobhad.codes](https://www.nobhad.codes)
- Email: <nobhaduri@gmail.com>
- GitHub: [@nobhad](https://github.com/nobhad)
- LinkedIn: [Noelle Bhaduri](https://www.linkedin.com/in/noelle-b-676286106/)
