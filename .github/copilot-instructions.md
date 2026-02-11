# Copilot / AI Agent Instructions — no-bhad-codes

Purpose: provide concise, repository-specific guidance so AI coding agents can be immediately productive.

1) Quick start (most-used commands)
- Dev (frontend): `npm run dev` — Vite dev server (http://<frontend-host>:4000)
- Dev (backend): `npm run dev:server` — runs `tsx server/app.ts` (API on http://<api-host>:4001)
- Full dev (both): `npm run dev:full` (uses `concurrently`)
- DB migrations: `npm run migrate` (scripts/migrate.ts) and `npm run db:setup`
- Tests: `npm run test` or `npm run test:run` (Vitest). E2E config lives in [playwright.config.ts](../playwright.config.ts)
- Build: `npm run build` (Vite) and `npm run build:server` for TypeScript server compilation

2) High-level architecture
- Frontend: Vite + TypeScript under `src/` (entry: `src/main.ts`). See `[src]` for modules, `features/` for domain boundaries.
- Backend: Express (ES modules) under `server/` (entry: `server/app.ts`). Routes are in `server/routes/` and services in `server/services/`.
- Database: SQLite with migration scripts in `scripts/migrate.ts`. Server initializes DB and runs migrations on start (see `server/app.ts`).
- Dual API mounting: routes are mounted at both `/api` and `/api/v1` (and legacy paths exist). Prefer canonical `/api/v1` when making changes.

3) Critical, repo-specific patterns and gotchas
- Sentry must be imported before other modules in the server. See the top of [server/app.ts](../server/app.ts) ("Sentry must be imported FIRST").
- CSP includes `unsafe-eval` for GSAP: changing CSP requires checking animations in `src/`.
- Global middleware: `sanitizeInputs`, `requestIdMiddleware`, and `auditMiddleware` are applied early — be careful when changing request shape or routes.
- Many services are optional at startup (email, Redis caching, scheduler). Check `process.env.*` flags (e.g., `REDIS_ENABLED`, `SCHEDULER_ENABLED`).
- Routes and handlers follow clear separation: route files in `server/routes/*` call business logic in `server/services/*`. Update service tests when changing behavior.

4) Where to look for authoritative examples
- API endpoints & patterns: [server/routes](../server/routes)
- Middleware examples: [server/middleware](server/middleware)
- DI / bootstrapping: `src/core/container.ts` and `src/core/app` for frontend wiring
- Server startup lifecycle and migrations: [server/app.ts](server/app.ts)
- Build & scripts: [package.json](package.json)
- Environment variables: `.env.example` and `docs/CONFIGURATION.md`
- Swagger docs are configured in `server/config/swagger.js` (runtime docs at `/api-docs`).

5) Code quality & developer workflows
- Formatting & linting: `npm run format`, `npm run lint`, `npm run format:check`.
- Type checks: `npm run typecheck` (run before large refactors).
- Tests: unit tests use Vitest (`npm run test:run`). Coverage helpers available via `npm run test:coverage`.
- Pre-commit: lint-staged and husky are configured. Follow existing patterns for commit messages.

6) Repository rules called out in repo files
- From [CLAUDE.md](CLAUDE.md): do not include the literal text/emoji "🤖 Generated with Claude Code" in commit messages.

7) What an agent should do when making changes
- Prefer editing `server/services/*` for business logic; update `server/routes/*` only for wiring or validation changes.
- When adding endpoints, register them in `server/routes` and ensure they mount under `/api/v1`.
- Run `npm run migrate` when migrations are added; server startup also runs migrations, but CI may expect explicit migration commands.
- Run `npm run typecheck` and `npm run test` before opening PRs.

8) Useful file references
- Server app: [server/app.ts](server/app.ts)
- Scripts: [package.json](package.json)
- Frontend entry: [src/main.ts](src/main.ts)
- Env template: [.env.example](../.env.example)
- Playwright config: [playwright.config.ts](playwright.config.ts)

If anything here is unclear or you want the agent to include more examples (test commands, common grep targets, typical PR descriptions), tell me which sections to expand. 
