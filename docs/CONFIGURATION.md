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

Copy `.env.example` to `.env` and configure the following variables:

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | Yes | `4001` | Backend API server port |
| `FRONTEND_URL` | Yes | `http://localhost:4000` | Frontend Vite dev server URL |

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_PATH` | No | `./data/client_portal.db` | SQLite database file path |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for JWT signing (min 32 characters) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiration time |
| `ADMIN_EMAIL` | Yes | - | Admin account email address |
| `ADMIN_PASSWORD` | Yes | - | Admin account password (development only) |
| `ADMIN_PASSWORD_HASH` | No | - | Bcrypt hashed password (production) |

### Business Information (Invoices)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BUSINESS_NAME` | No | - | Business name displayed on invoices |
| `BUSINESS_CONTACT` | No | - | Business contact name displayed on invoices |
| `BUSINESS_EMAIL` | No | - | Business email displayed on invoices |
| `BUSINESS_WEBSITE` | No | - | Business website URL displayed on invoices |
| `VENMO_HANDLE` | No | - | Venmo payment handle displayed on invoices |
| `PAYPAL_EMAIL` | No | - | PayPal payment email displayed on invoices |

### Client Portal URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENT_PORTAL_URL` | No | `http://localhost:4000/client/portal` | Client portal URL |
| `WEBSITE_URL` | No | `http://localhost:4000` | Main website URL |

### Email Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_ENABLED` | No | `false` | Enable/disable email sending |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use TLS for SMTP |
| `SMTP_USER` | No | - | SMTP authentication username |
| `SMTP_PASS` | No | - | SMTP authentication password/app password |
| `SMTP_FROM` | No | - | Default "From" email address |
| `SMTP_REPLY_TO` | No | - | Reply-to email address |
| `SUPPORT_EMAIL` | No | - | Support email recipient |

### Frontend Configuration (Vite)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_CONTACT_EMAIL` | No | `nobhaduri@gmail.com` | Contact/support email displayed in frontend |
| `VITE_ADMIN_EMAIL` | No | `nobhaduri@gmail.com` | Admin email for frontend login validation |

### Third-Party Services

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_FORMSPREE_FORM_ID` | No | - | Formspree form ID for contact form |
| `VITE_EMAILJS_SERVICE_ID` | No | - | EmailJS service ID |
| `VITE_EMAILJS_TEMPLATE_ID` | No | - | EmailJS template ID |
| `VITE_EMAILJS_PUBLIC_KEY` | No | - | EmailJS public key |
| `SENTRY_DSN` | No | - | Sentry error tracking DSN |
| `SENTRY_ENVIRONMENT` | No | `development` | Sentry environment name |

### Redis Cache (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_ENABLED` | No | `false` | Enable/disable Redis caching. Set to `true` to enable. |
| `REDIS_HOST` | No | `localhost` | Redis server hostname |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | - | Redis authentication password |
| `REDIS_DB` | No | `0` | Redis database number |
| `REDIS_KEY_PREFIX` | No | `nbc:` | Redis key prefix |

**Note:** Redis is optional for development. When `REDIS_ENABLED` is not set to `true`, the server runs without caching functionality. To enable Redis:

1. Install Redis: `brew install redis` (macOS)
2. Start Redis: `brew services start redis`
3. Add to `.env`: `REDIS_ENABLED=true`

### File Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPLOAD_DIR` | No | `./uploads` | Local file upload directory |
| `MAX_FILE_SIZE` | No | `10485760` | Maximum file size in bytes (10MB) |
| `SUPABASE_URL` | No | - | Supabase project URL (production) |
| `SUPABASE_ANON_KEY` | No | - | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | No | - | Supabase service role key |

---

## Frontend Configuration

The frontend uses centralized configuration files located in `src/config/`.

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

### `src/config/routes.ts`

Centralized route path definitions:

```typescript
import { ROUTES, matchRoute, isClientRoute, isAdminRoute } from './config/routes';

// Public routes
ROUTES.HOME       // "/"
ROUTES.ABOUT      // "/#about"
ROUTES.CONTACT    // "/#contact"
ROUTES.PORTFOLIO  // "/#portfolio"

// Client area routes
ROUTES.CLIENT.LANDING      // "/client/landing"
ROUTES.CLIENT.PORTAL       // "/client/portal"
ROUTES.CLIENT.INTAKE       // "/client/intake"
ROUTES.CLIENT.SET_PASSWORD // "/client/set-password"

// Admin area routes
ROUTES.ADMIN.DASHBOARD // "/admin"
ROUTES.ADMIN.LOGIN     // "/admin/login"
ROUTES.ADMIN.CLIENTS   // "/admin/clients"
ROUTES.ADMIN.PROJECTS  // "/admin/projects"
ROUTES.ADMIN.MESSAGES  // "/admin/messages"

// API endpoints
ROUTES.API.AUTH.LOGIN       // "/api/auth/login"
ROUTES.API.CONTACT          // "/api/contact"
ROUTES.API.INTAKE           // "/api/intake"
ROUTES.API.CLIENTS.BASE     // "/api/clients"
ROUTES.API.CLIENTS.BY_ID(id) // "/api/clients/:id"

// Helper functions
matchRoute(path, route)     // Check if path matches route
isClientRoute(path)         // Check if path is in client area
isAdminRoute(path)          // Check if path is in admin area
```

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

### `src/config/api.ts`

API endpoint configuration:

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
