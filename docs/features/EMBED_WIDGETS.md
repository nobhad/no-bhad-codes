# Embeddable Widgets

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Embeddable widget system that lets external websites embed contact forms, testimonial displays, and project status badges via simple `<script>` tags. Admin configures widgets with allowed domains and widget-specific settings, then copies the generated embed code. Public endpoints serve self-contained JavaScript that injects styled DOM elements and communicates with the API via `fetch`.

## Architecture

### Database Tables (Migration 128)

- `embed_configurations` -- Widget configuration records. Each has a unique token for identification, widget_type (contact_form, testimonials, status_badge), JSON config for widget-specific settings, comma-separated allowed_domains for CORS, and is_active flag.
- `project_status_tokens` -- Public tokens linked to a specific project. Used by the status badge widget to resolve project status without exposing project IDs.

### Widget Types

- **contact_form** -- Injects a styled contact form that POSTs to `/api/intake`. Configurable fields: brand color, max message length, success message, show/hide company and subject fields.
- **testimonials** -- Renders published testimonials from the feedback system. Supports carousel, grid, and list layouts. Configurable: max items, show rating stars, show project name, auto-rotate interval.
- **status_badge** -- Compact project status display showing current status and completion percentage calculated from milestone progress. Configurable: show percentage, show milestones summary, light/dark theme.

### Widget Delivery Flow

1. Admin creates widget configuration via `/embed-widgets` page
2. System generates a unique token and stores config in `embed_configurations`
3. Admin copies the generated `<script>` tag embed code
4. External site includes the script tag on their page
5. Browser loads the widget JS from `/api/embed/{widget-type}.js`
6. Widget JS reads `data-` attributes from the script tag for configuration
7. Widget injects DOM elements with isolated styling and fetches data from the API

### Embed Code Format

The generated embed code is a single `<script>` tag:

```html
<script src="https://your-domain.com/api/embed/testimonials.js"
  data-token="abc123"
  data-layout="carousel"
  data-max-items="5">
</script>
```

## API Endpoints

### Admin (requireAdmin)

- `GET /api/embed` -- List all widget configurations
- `POST /api/embed` -- Create widget configuration (widgetType, name, config, allowedDomains)
- `GET /api/embed/:id` -- Get single config with generated embed code
- `PUT /api/embed/:id` -- Update config (name, config, allowedDomains, isActive)
- `DELETE /api/embed/:id` -- Deactivate widget (soft deactivation, not hard delete)
- `POST /api/embed/:id/regenerate-token` -- Regenerate widget token (invalidates old embed codes)
- `GET /api/embed/:id/embed-code` -- Get embed code HTML snippet for copying

### Public (no auth, CSRF-exempt)

- `GET /api/embed/contact-form.js` -- Self-contained contact form widget JavaScript
- `GET /api/embed/testimonials.js` -- Testimonial display widget JavaScript
- `GET /api/embed/status-badge.js` -- Project status badge widget JavaScript
- `GET /api/embed/status/:token` -- Project status JSON (project name, status, completion %, milestones summary)

Public widget JS responses include 5-minute cache headers.

### Frontend API Constants

Constants defined in `api-endpoints.ts`:

- `EMBED` -- Base path '/api/embed'
- `buildEndpoint`: embedWidget(id), embedWidgetCode(id), embedWidgetRegenerate(id)

## Service Layer

**File:** `server/services/embed-service.ts`

### Configuration Methods

- `listConfigs()` -- List all widget configurations, parsed from DB rows
- `getConfig(id)` -- Get single configuration by ID
- `createConfig(params)` -- Create new config with generated token
- `updateConfig(id, params)` -- Update config fields
- `deactivateConfig(id)` -- Set is_active = false
- `regenerateToken(id)` -- Generate new token, invalidating previous embed codes

### Widget Methods

- `getEmbedCode(id, baseUrl)` -- Generate HTML embed code for a configuration
- `getProjectStatus(token)` -- Resolve project status from a status badge token (name, status, completion %, milestones summary)

## Types

**File:** `server/services/embed-types.ts`

Key types:

- `WidgetType` -- Union type: 'contact_form' | 'testimonials' | 'status_badge'
- `EmbedConfigRow` -- Raw DB row shape
- `EmbedConfiguration` -- Parsed API shape with camelCase fields and parsed JSON
- `ProjectStatusInfo` -- Status badge response (projectName, status, completionPercent, milestonesSummary)
- `ContactFormWidgetConfig` -- Config interface for contact form widgets
- `TestimonialWidgetConfig` -- Config interface for testimonial widgets
- `StatusBadgeWidgetConfig` -- Config interface for status badge widgets
- `CreateEmbedParams` -- Input for creating a widget config
- `UpdateEmbedParams` -- Input for updating a widget config

## React Components

### Admin

- `src/react/features/admin/embed/EmbedWidgetsManager.tsx` -- Admin table listing all widget configurations. Includes inline create form (widget type, name, allowed domains), copy embed code to clipboard, regenerate token with confirmation, and deactivate toggle.

### Portal Route

- `/embed-widgets` -- Admin only. Renders EmbedWidgetsManager.

## Security

- Public widget endpoints are CSRF-exempt (they serve JavaScript and read-only JSON)
- Widget configurations support allowed_domains for origin restriction
- Tokens are randomly generated and can be regenerated to invalidate old embed codes
- Status badge tokens are separate from embed config tokens, linked directly to projects

## Key Files

- `server/services/embed-types.ts` -- Types and interfaces
- `server/services/embed-service.ts` -- Service layer
- `server/routes/embed/admin.ts` -- Admin endpoints (7 routes)
- `server/routes/embed/public.ts` -- Public endpoints (4 routes, no auth)
- `src/react/features/admin/embed/EmbedWidgetsManager.tsx` -- Admin widget management UI

## Change Log

### 2026-03-17 -- Initial Implementation

- Embeddable widget system with 3 widget types (contact form, testimonials, status badge)
- Admin CRUD for widget configurations with token management
- Public JavaScript endpoints serving self-contained widget code
- Project status resolution from milestone completion data
- Embed code generation with data-attribute configuration
- CSRF-exempt public endpoints with 5-minute cache headers
