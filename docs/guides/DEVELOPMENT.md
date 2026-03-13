# Development Guide

This is a summary of the development workflow. Full details are in
[`DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md).

## Starting the development server

```bash
npm run dev:full
```

Runs both frontend (Vite, port 4000) and backend (Node.js, port 4001) concurrently.

- Frontend changes hot-reload automatically via Vite HMR
- Backend changes require a manual server restart (`npm run dev:server`)

## Key npm scripts

### Development

```bash
npm run dev            # Frontend only (Vite)
npm run dev:server     # Backend only (Node.js)
npm run dev:full       # Both concurrently
```

### Code quality

```bash
npm run typecheck      # TypeScript type checking — must pass before commits
npm run lint           # ESLint
npm run format         # Prettier (auto-fix)
npm run format:check   # Prettier (check only)
```

### Testing

```bash
npm run test           # Unit tests (Vitest)
npm run test:coverage  # Coverage report
npx playwright test    # End-to-end tests (run from project root)
```

### Building

```bash
npm run build          # Production build
npm run preview        # Preview production build locally
npm run build:analyze  # Build + open bundle analyzer
```

### Database

```bash
npm run db:setup         # Initialize DB (runs all migrations)
npm run migrate          # Apply pending migrations
npm run migrate:status   # Check migration status
npm run migrate:rollback # Roll back last migration
npm run migrate:create   # Scaffold a new migration file
npm run db:backup        # Backup the database
```

## Code quality requirements

**Before every commit:**

- `npm run typecheck` — zero TypeScript errors required
- `npm run lint` — all lint errors fixed
- Build must succeed (`npm run build`)

Do not push to main with failing type checks or lint errors.

## Architecture overview

- **Frontend:** TypeScript SPA (Vite), React portal SPA (`src/react/`)
- **Backend:** Node.js + Express + TypeScript (`server/`)
- **Database:** SQLite with custom async wrapper (`server/database/`)
- **Auth:** HttpOnly JWT cookies
- **Admin portal:** React SPA — routes in `src/react/app/PortalRoutes.tsx`, components in `src/react/features/admin/`
- **Client portal:** Hybrid (EJS shell + React modules), entry at `client/portal.html`

See [`DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md) for a full architecture deep dive, module patterns,
service layer documentation, and troubleshooting.

## Test coverage

Coverage is collected via Vitest + V8 provider. Reports are generated in HTML, JSON, LCOV, and text formats.

### Coverage scripts

```bash
npm run test:coverage          # Generate full coverage report
npm run test:coverage:watch    # Interactive coverage monitoring
npm run test:coverage:report   # Generate and open HTML report
npm run test:coverage:ci       # CI-optimized coverage
coverage:check                 # Validate coverage meets thresholds
```

### Thresholds

| Module type | Lines | Functions | Branches | Statements |
|-------------|-------|-----------|----------|------------|
| Global | 70% | 70% | 70% | 70% |
| Core modules (`src/core/**`) | 85% | 85% | 85% | 85% |
| Services (`src/services/**`) | 80% | 80% | 80% | 80% |

### Coverage output

Reports are written to `coverage/`:

- `index.html` — interactive HTML report
- `coverage.json` — Vitest format test results
- `lcov.info` — LCOV format for CI integration

### CI/CD

GitHub Actions runs coverage on push/PR to main and develop branches. Builds fail below the 70% global threshold. PRs receive an automated coverage summary comment.
