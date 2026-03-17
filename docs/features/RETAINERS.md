# Retainer and Recurring Project Management

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Manage ongoing retainer clients with hourly or fixed-scope agreements. Track utilization per billing period, auto-generate invoices, handle hour rollover, and alert on high usage.

## Architecture

### Database Tables (Migration 126)

- `retainers` — Retainer definitions (client, project, type, monthly amount/hours, rollover config, billing day)
- `retainer_periods` — Per-period tracking (allocated hours, used hours, rollover, invoice link)

### Retainer Types

- **Hourly** — Monthly hour allocation, tracks usage, supports rollover
- **Fixed Scope** — Flat monthly fee, no hour tracking

### Period Lifecycle

1. Period created with allocated_hours + rollover_hours from previous period
2. Time entries accumulate in used_hours via recalculateUsedHours
3. On billing day: auto-invoice generated, period closed, new period created
4. Rollover: unused = totalAvailable - usedHours, clamped to maxRolloverHours

### API Endpoints

**Admin:**

- `GET /api/retainers` — List all with current period
- `POST /api/retainers` — Create (auto-creates first period)
- `GET /api/retainers/summary` — Aggregate stats
- `GET /api/retainers/:id` — Single with enrichments
- `PUT /api/retainers/:id` — Update
- `DELETE /api/retainers/:id` — Cancel
- `GET /api/retainers/:id/periods` — Period history
- `POST /api/retainers/:id/close-period` — Close + create next
- `POST /api/retainers/:id/pause` / `resume`

**Client Portal:**

- `GET /api/retainers/my` — Client's active retainers
- `GET /api/retainers/my/:id` — Single with current period

### Scheduler

- `0 7 * * *` — Daily auto-invoicing (billing_day = today, active, auto_invoice)
- `0 8 * * *` — Daily usage alerts (>= 80% utilization emails admin)

### Portal Routes

- `/retainers` — Admin sees RetainersTable, client sees PortalRetainers

## Key Files

- `server/services/retainer-service.ts` — CRUD, period management, billing, alerts
- `server/routes/retainers/admin.ts` — Admin routes
- `server/routes/retainers/portal.ts` — Client routes
- `src/react/features/admin/retainers/RetainersTable.tsx` — Admin table with utilization bars
- `src/react/features/portal/retainers/PortalRetainers.tsx` — Client card view

## Change Log

### 2026-03-17 — Initial Implementation

- Retainer management with hourly and fixed-scope types
- Period lifecycle with rollover calculation
- Auto-invoicing and usage alert crons
- Admin table with utilization progress bars (green/yellow/red)
- Client portal read-only card view
