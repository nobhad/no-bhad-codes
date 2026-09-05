# Configuration Guide

This document provides comprehensive documentation for all configuration files and environment variables in the No Bhad Codes application.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Frontend Configuration](#frontend-configuration)
- [TypeScript Configuration](#typescript-configuration)
- [Vite Configuration](#vite-configuration)
- [ESLint Configuration](#eslint-configuration)

---

## Environment Variables

Copy `.env.example` to `.env`. The server validates its configuration on boot in
`server/config/environment.ts` and logs what is missing or malformed. Everything in the
tables below was checked against the code on 2026-09-05: the "Read by" column is where
the value is consumed. Variables that appear in no code path are not listed.

### Required (no default)

|Variable|Rule|Read by|
|---|---|---|
|`JWT_SECRET`|32+ characters|`environment.ts`, auth middleware|
|`ADMIN_EMAIL`|valid email|`environment.ts`, auth routes, notifications|
|`ADMIN_PASSWORD`|8+ characters; development. In production set `ADMIN_PASSWORD_HASH` (bcrypt) instead|`environment.ts`, admin login|
|`BUSINESS_NAME`|—|`server/config/business.ts` (invoices, PDFs, email)|
|`BUSINESS_EMAIL`|valid email|`server/config/business.ts`|

### Server

|Variable|Default|Read by|
|---|---|---|
|`NODE_ENV`|`development`|everywhere (`development`, `production`, `test`)|
|`PORT`|`4001`|`app.ts` (Railway injects its own)|
|`FRONTEND_URL`|`http://localhost:4000`|CORS, links in email|
|`API_BASE_URL`|`http://localhost:4001`|`environment.ts`|
|`WEBSITE_URL` / `BASE_URL`|falls back to `FRONTEND_URL`|`getBaseUrl()` — public site URL used in email links|
|`ADMIN_URL`|`<base>/admin`|`getAdminUrl()`|
|`CLIENT_PORTAL_URL`|`<base>/client/portal`|`getPortalUrl()`|
|`PRODUCTION_API_URL`|`https://api.<BUSINESS_WEBSITE>`|Swagger server list|
|`TRUST_PROXY`|`false`|`app.ts` (set `true` behind Railway/Vercel)|
|`PORTAL_MODE`|`solo`|portal feature gating|
|`PUBLIC_ASSET_ORIGIN`|—|server-rendered shells: where hashed assets are served from|

### Database

|Variable|Default|Read by|
|---|---|---|
|`DATABASE_PATH`|`./data/client_portal.db`|`server/database/init.ts`|
|`DB_MAX_CONNECTIONS`|`5`|connection pool size|
|`DB_BUSY_TIMEOUT_MS`|`5000`|`PRAGMA busy_timeout` on every pooled connection|
|`SLOW_QUERY_THRESHOLD_MS`|`100`|slow-query logging|
|`ACCEPT_SCHEMA_DRIFT`|`false`|boot: accept a schema that differs from the migrations (see the runbook)|

### Authentication

|Variable|Default|Read by|
|---|---|---|
|`JWT_EXPIRES_IN`|`7d`|token issue|
|`BCRYPT_ROUNDS`|`10` (8–15)|password hashing|
|`ADMIN_PASSWORD_HASH`|—|admin login (preferred over `ADMIN_PASSWORD` in production)|
|`RATE_LIMIT_LOGIN_MAX`|`5`|login limiter|
|`RATE_LIMIT_CONTACT_MAX`|`3`|contact-form limiter|
|`API_RATE_WINDOW_MS` / `API_RATE_MAX_REQUESTS`|`900000` / `100`|general API limiter (`server/middleware/rate-limiter.ts`)|
|`ANALYTICS_ADMIN_RATE_WINDOW_MS` / `ANALYTICS_ADMIN_MAX_REQUESTS`|`60000` / `30`|admin analytics limiter|

### Business information (invoices, PDFs, email)

|Variable|Default|Notes|
|---|---|---|
|`BUSINESS_OWNER`|falls back to `BUSINESS_CONTACT`|owner name|
|`BUSINESS_CONTACT`|—|contact name|
|`BUSINESS_TAGLINE`|—||
|`BUSINESS_WEBSITE`|—||
|`SUPPORT_EMAIL`|`BUSINESS_EMAIL`|support address in templates|
|`VENMO_HANDLE`, `ZELLE_EMAIL`, `PAYPAL_EMAIL`|—|payment methods printed on invoices|
|`CONTRACT_TERMS`|built-in list|newline-separated override of contract terms|
|`BRAND_COLOR`, `DARK_BG_COLOR`, `META_THEME_COLOR`|`#00ff41`, `#1a1a1a`, `#e0e0e0`|server-rendered shells|
|`EMAIL_HEADER_BG`, `EMAIL_HEADER_TEXT`, `EMAIL_BRAND_ACCENT`, `EMAIL_BUTTON_COLOR`, `EMAIL_BUTTON_SECONDARY`|`#171717`, `#ffffff`, `#333333`, `#333333`, `#ffffff`|`server/config/email-styles.ts`|

### Email

|Variable|Default|Notes|
|---|---|---|
|`EMAIL_ENABLED`|`false`|when `true`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `FROM_EMAIL` are required|
|`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`|—, `587`, `false`, —, —||
|`FROM_EMAIL`|`BUSINESS_EMAIL`|`SMTP_FROM` is accepted as a legacy alias|
|`SMTP_REPLY_TO`|—||
|`ADMIN_NOTIFICATION_EMAIL`|`ADMIN_EMAIL`|contact-form and system notifications|

### Files

|Variable|Default|Notes|
|---|---|---|
|`UPLOAD_DIR`|`./uploads`|`environment.ts`|
|`UPLOADS_DIR`|derived|`server/config/uploads.ts` override; on Railway this is under `/app/data`|

### Redis (optional cache)

|Variable|Default|
|---|---|
|`REDIS_ENABLED`|`false` — nothing else here is read until this is `true`|
|`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX`|`localhost`, `6379`, —, `0`, `nbc:`|

### Scheduler (in-process timers)

|Variable|Default|
|---|---|
|`SCHEDULER_ENABLED`|`true`|
|`SCHEDULER_REMINDERS`, `SCHEDULER_SCHEDULED`, `SCHEDULER_RECURRING`|`true` — reminders, scheduled invoices, recurring invoices|

### Payments and integrations

|Variable|Read by|
|---|---|
|`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`|`server/routes/payments/`, `server/routes/webhooks.ts`|
|`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`|Google Calendar integration|
|`ANTHROPIC_API_KEY`, `AI_ENABLED` (`true`), `AI_MODEL`, `AI_DAILY_REQUEST_LIMIT`, `AI_MONTHLY_BUDGET_CENTS`|`server/services/ai-service.ts`|

### Backups

|Variable|Default|Read by|
|---|---|---|
|`BACKUP_DIR`|`./data/backups`|`server/services/backup-service.ts`|
|`BACKUP_RETENTION_DAILY`, `BACKUP_RETENTION_WEEKLY`|`7`, `4`|`scripts/backup-database.ts`|
|`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_FOLDER_ID`|—|`server/services/drive-backup-service.ts` (all three required for offsite backups)|
|`DRIVE_RETENTION_COUNT`|`30`|offsite copies kept|

### Observability

|Variable|Default|Read by|
|---|---|---|
|`SENTRY_DSN`|—|`server/instrument.ts`; active in production, or anywhere with `SENTRY_ENABLE_LOCAL=true`|
|`OTEL_ENABLED`|`true`|`server/observability/`|
|`OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_DEBUG`|`client`, —, `false`||
|`METRICS_EXPORTER`, `PROMETHEUS_HOST`, `PROMETHEUS_PORT`, `PROMETHEUS_ENDPOINT`|—, `0.0.0.0`, `9464`, `/metrics`||
|`LOG_LEVEL`, `LOG_FORMAT`, `LOG_FILE`, `LOG_ERROR_FILE`, `LOG_MAX_SIZE`, `LOG_MAX_FILES`|`info`, `text`, `./logs/app.log`, `./logs/error.log`, `10m`, `14d`|`server/services/logger.ts`|
|`PDF_CACHE_TTL_MS`, `PDF_CACHE_MAX_ENTRIES`|`300000`, `100`|PDF render cache|

### Frontend (Vite, build-time)

|Variable|Read by|
|---|---|
|`VITE_API_URL`|`src/config/api.ts` (API origin when not same-host)|
|`VITE_CONTACT_EMAIL`, `VITE_ADMIN_EMAIL`|displayed addresses|
|`VITE_FORMSPREE_FORM_ID`, `VITE_FORMSPREE_BASE_URL`, `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_BASE_URL`|alternative contact-form backends (the default posts to the API)|
|`VITE_STRIPE_PUBLISHABLE_KEY`|embedded payments|

### Scripts only

`PORTAL_EMAIL`, `PORTAL_PASSWORD`, `CAPTURE_ORIGIN`, `CAPTURE_WORK`, `PUPPETEER_EXECUTABLE_PATH`
(`scripts/capture-portfolio.ts`); `SAMPLE_PDF_OUT`; `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`,
`DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` (test seeding); `VERBOSE`.

### Declared but not yet wired

`environment.ts` validates these and nothing reads the result, so setting them changes
nothing today: `DATABASE_BACKUP_PATH`, `DATABASE_ENABLE_WAL`, `DATABASE_BUSY_TIMEOUT`
(the pool uses `DB_BUSY_TIMEOUT_MS`), `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`,
`SESSION_SECRET`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`, `TEMP_DIR`,
`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `ENABLE_REGISTRATION`,
`ENABLE_PASSWORD_RESET`, `ENABLE_EMAIL_VERIFICATION`, `ENABLE_2FA`, `ENABLE_API_DOCS`,
`MAINTENANCE_MODE`, `CORS_ORIGIN`, `CORS_CREDENTIALS`, `CORS_METHODS`, `CORS_HEADERS`,
`DEV_AUTO_LOGIN`, `DEV_MOCK_DATA`, `DEV_VERBOSE_LOGGING`, `DEV_HOT_RELOAD`, `FORCE_SSL`,
`HELMET_ENABLED`, `CLUSTER_WORKERS`. They are kept in `.env.example` under the same
heading so nobody mistakes them for live switches.

---

## Frontend Configuration (Vite)

|Variable|Required|Default|Description|
|----------|----------|---------|-------------|
|`VITE_CONTACT_EMAIL`|No|`<<nobhaduri@gmail.com>>`|Contact/support email displayed in frontend|
|`VITE_ADMIN_EMAIL`|No|`<<nobhaduri@gmail.com>>`|Admin email for frontend login validation|

### Third-Party Services

|Variable|Required|Default|Description|
|----------|----------|---------|-------------|
|`VITE_FORMSPREE_FORM_ID`|No|-|Formspree form ID for contact form|
|`VITE_EMAILJS_SERVICE_ID`|No|-|EmailJS service ID|
|`VITE_EMAILJS_TEMPLATE_ID`|No|-|EmailJS template ID|
|`VITE_EMAILJS_PUBLIC_KEY`|No|-|EmailJS public key|
|`SENTRY_DSN`|No|-|Sentry error tracking DSN|
|`SENTRY_ENVIRONMENT`|No|`development`|Sentry environment name|

### Redis Cache (Optional)

|Variable|Required|Default|Description|
|----------|----------|---------|-------------|
|`REDIS_ENABLED`|No|`false`|Enable/disable Redis caching. Set to `true` to enable.|
|`REDIS_HOST`|No|`localhost`|Redis server hostname|
|`REDIS_PORT`|No|`6379`|Redis server port|
|`REDIS_PASSWORD`|No|-|Redis authentication password|
|`REDIS_DB`|No|`0`|Redis database number|
|`REDIS_KEY_PREFIX`|No|`nbc:`|Redis key prefix|

**Note:** The server validates environment variables in `server/config/environment.ts`; that file defines the full schema (including optional vars such as `DATABASE_BACKUP_PATH`, `RATE_LIMIT_*`, `ENABLE_PASSWORD_RESET`, `LOG_*`, `CORS_*`, etc.). This section covers the most commonly set variables.

**Note:** Redis is optional for development. When `REDIS_ENABLED` is not set to `true`, the server runs without caching functionality. To enable Redis:

1. Install Redis: `brew install redis` (macOS)
2. Start Redis: `brew services start redis`
3. Add to `.env`: `REDIS_ENABLED=true`

### Database Backups

|Variable|Required|Default|Description|
|----------|----------|---------|-------------|
|`BACKUP_DIR`|No|`./data/backups`|Backup output directory|
|`BACKUP_RETENTION_DAILY`|No|`7`|Number of daily backups to keep|
|`BACKUP_RETENTION_WEEKLY`|No|`4`|Number of weekly backups to keep|

Run manually: `npm run db:backup`. For automated backups, add a cron job (e.g. daily at 2am): `0 2 * * * cd /path/to/project && npm run db:backup`.

### File Storage

|Variable|Required|Default|Description|
|----------|----------|---------|-------------|
|`UPLOAD_DIR`|No|`./uploads`|Local file upload directory (used by server env schema)|
|`UPLOADS_DIR`|No|(derived)|Override for uploads base path; used by `server/config/uploads.ts`. If unset, uses `./uploads` or `/app/data/uploads` on Railway when `DATABASE_PATH` starts with `/app/data`.|
|`MAX_FILE_SIZE`|No|`10485760`|Maximum file size in bytes (10MB)|
|`SUPABASE_URL`|No|-|Supabase project URL (production)|
|`SUPABASE_ANON_KEY`|No|-|Supabase anonymous key|
|`SUPABASE_SERVICE_KEY`|No|-|Supabase service role key|

---

## Frontend Configuration

The frontend uses centralized configuration files located in `src/config/`.

### `src/constants/business.ts`

Frontend mirror of server business info. Used when client-side code needs business details without an API call:

```typescript
import { BUSINESS_INFO } from '../constants/business';

// Business identity
BUSINESS_INFO.name      // "No Bhad Codes"
BUSINESS_INFO.owner     // "Noelle Bhaduri"
BUSINESS_INFO.contact   // "Noelle Bhaduri"
BUSINESS_INFO.tagline   // "Web Development & Design"
BUSINESS_INFO.email     // "nobhaduri@gmail.com"
BUSINESS_INFO.website   // "nobhad.codes"
```

**Note:** This intentionally duplicates `server/config/business.ts` for client-side use. Keep both files in sync when updating business information.

### `src/config/branding.ts`

Centralized branding and company identity constants:

```typescript
import { BRANDING, getCopyrightText, getContactEmail } from './config/branding';

// Company identity
BRANDING.APP_NAME          // "No Bhad Codes"
BRANDING.APP_DOMAIN        // "nobhad.codes"
BRANDING.CONTACT_EMAIL     // "nobhaduri@gmail.com"
BRANDING.SUPPORT_EMAIL     // "nobhaduri@gmail.com"

// SEO/Meta information
BRANDING.META.TITLE        // Page title
BRANDING.META.DESCRIPTION  // Meta description
BRANDING.META.AUTHOR       // Author name

// Terminal branding
BRANDING.TERMINAL.PROMPT   // Terminal prompt text

// Helper functions
getCopyrightYear()         // Returns current year
getCopyrightText()         // Returns formatted copyright string
getContactEmail('support') // Returns appropriate email for type
```

### `src/config/api.ts`

API endpoint configuration and base URL helpers:

```typescript
import { apiConfig, buildApiUrl } from './config/api';

// Base URL (from Vite env or current origin)
apiConfig.baseUrl

// Auth endpoints
apiConfig.endpoints.auth.login    // "/api/auth/login"
apiConfig.endpoints.auth.logout   // "/api/auth/logout"
apiConfig.endpoints.auth.profile  // "/api/auth/profile"
// ... magicLink, verifyMagicLink, refresh, validate

// Resource bases
apiConfig.endpoints.clients       // "/api/clients"
apiConfig.endpoints.projects      // "/api/projects"
apiConfig.endpoints.intake        // "/api/intake"

// Admin auth (full URL with base)
adminEndpoints.login
adminEndpoints.logout
adminEndpoints.validate

// Build full API URL
buildApiUrl('/api/clients')
```

Client and admin page paths (e.g. `/client/portal`, `/client/intake`, `/admin`) are determined by the HTML entry points and Vite dev server; there is no central `routes.ts` file.

### `src/config/constants.ts`

Application-wide constants:

```typescript
import { APP_CONSTANTS, getProjectStatusColor } from './config/constants';

// Timing constants (milliseconds)
APP_CONSTANTS.TIMERS.FORM_AUTOSAVE      // 30000 (30s)
APP_CONSTANTS.TIMERS.PAGE_TRANSITION    // 600
APP_CONSTANTS.TIMERS.ANIMATION_DURATION // 300
APP_CONSTANTS.TIMERS.DEBOUNCE_DEFAULT   // 300
APP_CONSTANTS.TIMERS.RATE_LIMIT_WINDOW  // 300000 (5min)

// Performance thresholds
APP_CONSTANTS.PERFORMANCE.FCP_GOOD      // 1800ms
APP_CONSTANTS.PERFORMANCE.LOAD_GOOD     // 3000ms

// Rate limiting
APP_CONSTANTS.RATE_LIMITS.FORM_SUBMISSIONS // 5
APP_CONSTANTS.RATE_LIMITS.LOGIN_ATTEMPTS   // 3
APP_CONSTANTS.RATE_LIMITS.API_REQUESTS     // 100

// Project status colors
APP_CONSTANTS.PROJECT_COLORS.pending       // "#FFA500"
APP_CONSTANTS.PROJECT_COLORS['in-progress'] // "#3B82F6"
APP_CONSTANTS.PROJECT_COLORS.completed     // "#10B981"

// Storage keys
APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN // "auth_token"
APP_CONSTANTS.STORAGE_KEYS.THEME      // "theme"

// File upload limits
APP_CONSTANTS.UPLOAD.MAX_FILE_SIZE    // 10MB
APP_CONSTANTS.UPLOAD.MAX_FILES        // 5
APP_CONSTANTS.UPLOAD.ALLOWED_TYPES    // ['jpeg', 'jpg', ...]

// Security settings
APP_CONSTANTS.SECURITY.PASSWORD_MIN_LENGTH // 8
APP_CONSTANTS.SECURITY.SESSION_TIMEOUT     // 24 hours

// UI dimensions
APP_CONSTANTS.BREAKPOINTS.MOBILE  // 768
APP_CONSTANTS.BREAKPOINTS.TABLET  // 1024
APP_CONSTANTS.BREAKPOINTS.DESKTOP // 1200
```

### API Configuration Reference

Quick reference for API configuration helpers:

```typescript
import { API_CONFIG, getApiUrl } from './config/api';

// Base URL configuration
API_CONFIG.BASE_URL    // API base URL
API_CONFIG.TIMEOUT     // Request timeout
API_CONFIG.RETRY_COUNT // Retry attempts

// Get full API URL
getApiUrl('/auth/login') // Returns full URL for endpoint
```

### `src/config/protection.config.ts`

Code protection and security configuration for production builds.

### `src/vite-env.d.ts`

TypeScript definitions for Vite environment variables:

```typescript
// Access environment variables with type safety
import.meta.env.VITE_FORMSPREE_FORM_ID   // string | undefined
import.meta.env.VITE_EMAILJS_SERVICE_ID  // string | undefined
import.meta.env.VITE_EMAILJS_TEMPLATE_ID // string | undefined
import.meta.env.VITE_EMAILJS_PUBLIC_KEY  // string | undefined
import.meta.env.VITE_DEMO_EMAIL          // string | undefined
import.meta.env.VITE_DEMO_PASSWORD       // string | undefined
import.meta.env.MODE                      // "development" | "production"
import.meta.env.DEV                       // boolean
import.meta.env.PROD                      // boolean
```

---

## TypeScript Configuration

The project uses strict TypeScript configuration in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "server/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Path Aliases

Use `@/` prefix to import from `src/`:

```typescript
import { BRANDING } from '@/config/branding';
import { BaseModule } from '@/modules/base';
import { DataService } from '@/services/data-service';
```

---

## Vite Configuration

The project uses Vite for development and building (`vite.config.ts`):

### Development Server

- **Port**: 4000 (frontend)
- **Backend Proxy**: Requests to `/api/*` are proxied to port 4001

### Build Output

- **Output Directory**: `dist/`
- **Source Maps**: Disabled in production for code protection
- **Code Splitting**: Feature-based chunk strategy

### Multi-Page Application

The project is configured as an MPA with multiple entry points:

- `index.html` - Main portfolio page
- `client/landing.html` - Client login/landing
- `client/portal.html` - Client dashboard
- `client/intake.html` - Project intake form
- `client/set-password.html` - Password setup
- `admin/index.html` - Admin dashboard

---

## ESLint Configuration

ESLint is configured with TypeScript support:

```bash
# Run linting
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### Key Rules

- TypeScript strict mode
- No unused variables (except those prefixed with `_`)
- Consistent indentation (2 spaces)
- Prefer template literals over string concatenation

---

## Production Checklist

Before deploying to production, ensure:

- [x] `NODE_ENV=production`
- [x] Strong `JWT_SECRET` (32+ characters, random)
- [x] `ADMIN_PASSWORD_HASH` set (not plaintext password)
- [x] `EMAIL_ENABLED=true` with valid SMTP credentials
- [x] SSL/TLS configured on reverse proxy
- [x] Database backup strategy in place
- [x] Error tracking (Sentry) configured
- [x] Environment variables secured (not in version control)
