# Admin Dashboard

**Status:** Complete
**Last Updated:** March 8, 2026

> Part of "The Backend" — the portal system serving both the Admin Dashboard and Client Portal as a single React SPA.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Entry Point Flow](#entry-point-flow)
4. [React SPA Structure](#react-spa-structure)
5. [Route Map](#route-map)
6. [Feature Components](#feature-components)
7. [State Management](#state-management)
8. [Auth Guard](#auth-guard)
9. [Client Invitation Flow](#client-invitation-flow)
10. [Server Routes](#server-routes)
11. [Related Documentation](#related-documentation)

---

## Overview

The Admin Dashboard is the administrative side of "The Backend" portal system. It is a **solo-operator** tool — a single admin (the business owner) manages everything. There is no multi-user admin or team management.

Key capabilities:

- Leads and contact form submission management
- Full project lifecycle management with a detail view
- Client management and invitation flow
- Messaging with clients
- Invoices, contracts, and proposals
- Analytics, performance metrics, and KPIs
- File management, document requests, and questionnaires
- Workflows, integrations, webhooks, and email templates
- System settings, data quality, and audit logs

**Access:** The portal is served at `/dashboard` (server-rendered EJS shell, React SPA mounts inside).

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + TypeScript |
| Routing | React Router v6 (hash-based) |
| State | Zustand |
| Build | Vite with code splitting |
| Authentication | HttpOnly cookies with JWT |
| Charts | TBD — verify current usage in `AnalyticsDashboard.tsx` |
| Backend | Express + SQLite (better-sqlite3) |

### Shared SPA

Both admin and client portals share the same React SPA. Role (`admin` or `client`) is decoded from the JWT on the server and passed into the session. `usePortalAuth` reads it and sets `portal-store.role`. Routes and navigation items are filtered by role.

---

## Entry Point Flow

```text
src/admin.ts  (Vite entry — registers the admin bundle)
     |
     v
server/views/layouts/portal.ejs  (EJS shell rendered by server at GET /dashboard)
     |
     v
src/react/app/mount-portal.tsx  (mounts React SPA into div.portal)
     |
     v
PortalApp.tsx  (root component — wraps providers: Router, Zustand, Suspense)
     |
     v
PortalRoutes.tsx  (all routes — lazy-loaded per feature)
     |
     v
PortalLayout.tsx  (shared shell: PortalSidebar + PortalHeader + <Outlet />)
     |
     v
Individual feature component (e.g. LeadsTable, ProjectDetail, InvoicesTable)
```

The server validates the JWT cookie before rendering the EJS shell. If the cookie is missing or invalid, the server redirects before the React SPA ever loads.

---

## React SPA Structure

### Core App Files

| File | Purpose |
|------|---------|
| `src/admin.ts` | Vite entry point |
| `src/react/app/PortalApp.tsx` | Root component with providers |
| `src/react/app/mount-portal.tsx` | Mounts SPA into DOM |
| `src/react/app/PortalRoutes.tsx` | All route definitions |
| `src/react/app/PortalLayout.tsx` | Shared layout (sidebar + header + outlet) |
| `src/react/app/PortalSidebar.tsx` | Sidebar navigation |
| `src/react/app/PortalHeader.tsx` | Global header |
| `src/react/stores/portal-store.ts` | Zustand store |
| `src/react/hooks/usePortalAuth.ts` | Auth hook (bridges cookie-based JWT to React) |
| `server/config/unified-navigation.ts` | Navigation config consumed by portal-store |

### Code Splitting

Every feature component is loaded with `React.lazy()`. The `lazyNamed` helper in `PortalRoutes.tsx` maps named exports to the default export format React.lazy requires:

```tsx
const LeadsTable = lazyNamed(() =>
  import('../features/admin/leads').then(m => ({ LeadsTable: m.LeadsTable }))
);
```

All routes are wrapped in `<LazyTabRoute>` which provides a `<Suspense>` boundary.

---

## Route Map

### Group Dashboards (sidebar top-level)

| Path | Component | Description |
|------|-----------|-------------|
| `/dashboard` | `OverviewDashboard` | Quick stats, recent activity, upcoming tasks |
| `/analytics` | `AnalyticsDashboard` | Visitor and page analytics |
| `/performance` | `PerformanceMetrics` | Server and app performance metrics |
| `/work` | `WorkDashboard` | Work group overview (projects, tasks, deliverables) |
| `/crm` | `CRMDashboard` | CRM group overview (leads, contacts, clients) |
| `/documents` | `DocumentsDashboard` | Documents group overview |

### CRM

| Path | Component |
|------|-----------|
| `/leads` | `LeadsTable` |
| `/contacts` | `ContactsTable` |
| `/clients` | `ClientsTable` |
| `/messages` | `MessagingView` |

### Work

| Path | Component |
|------|-----------|
| `/projects` | `ProjectsTable` |
| `/tasks` | `GlobalTasksTable` |
| `/requests` | `AdHocRequestsTable` |
| `/deliverables` | `DeliverablesTable` |

### Finance

| Path | Component |
|------|-----------|
| `/invoices` | `InvoicesTable` |
| `/contracts` | `ContractsTable` |
| `/proposals` | `ProposalsTable` |

### Documents

| Path | Component |
|------|-----------|
| `/document-requests` | `DocumentRequestsTable` |
| `/files` | `FilesManager` |
| `/questionnaires` | `QuestionnairesTable` |

### Settings / System

| Path | Component |
|------|-----------|
| `/support` | `KnowledgeBase` |
| `/system` | `SettingsManager` |
| `/email-templates` | `EmailTemplatesManager` |

### Direct-Access Only (not in sidebar)

These routes are reachable via deep link or command palette but do not appear in the sidebar.

| Path | Component |
|------|-----------|
| `/deleted-items` | `DeletedItemsTable` |
| `/time-tracking` | `TimeTrackingTable` |
| `/design-review` | `DesignReviewTable` |
| `/ad-hoc-analytics` | `AdHocAnalytics` |
| `/data-quality` | `DataQualityDashboard` |
| `/integrations` | `IntegrationsManager` |
| `/webhooks` | `WebhooksManager` |
| `/workflows` | `WorkflowsManager` |

### Detail Views

| Path | Component | Notes |
|------|-----------|-------|
| `/client-detail/:clientId` | `ClientDetail` | Navigates back to `/clients` |
| `/project-detail/:projectId` | `ProjectDetail` | Navigates back to `/projects` |

---

## Feature Components

All admin feature components live under `src/react/features/admin/`.

### CRM Features

- `clients/ClientsTable.tsx` — Client list with filters
- `client-detail/ClientDetail.tsx` — Full client view with tabs: Overview, Projects, Contacts, Activity
- `contacts/ContactsTable.tsx` — Contact form submissions
- `crm/CRMDashboard.tsx` — CRM group overview
- `leads/LeadsTable.tsx` — Leads table
- `leads/LeadDetailPanel.tsx` — Slide-in lead detail panel
- `messaging/MessagingView.tsx` — Client thread messaging

### Work Features

- `projects/ProjectsTable.tsx` — Projects list
- `project-detail/ProjectDetail.tsx` — Full project view with tabs:
  - `tabs/OverviewTab.tsx` — Progress, milestones, project details, links
  - `tabs/FilesTab.tsx` — File uploads and management
  - `tabs/MessagesTab.tsx` — Per-project client messages
  - `tabs/TasksTab.tsx` — Project-scoped tasks
  - `tabs/InvoicesTab.tsx` — Project invoices
  - `tabs/ContractTab.tsx` — Project contract
  - `tabs/NotesTab.tsx` — Admin and client notes
  - `tabs/DeliverablesTab.tsx` — Deliverables for the project
  - `tabs/IntakeTab.tsx` — Original intake form data
- `global-tasks/GlobalTasksTable.tsx` — Tasks across all projects
- `ad-hoc-requests/AdHocRequestsTable.tsx` — One-off client requests
- `deliverables/DeliverablesTable.tsx` — Deliverables across all projects

### Finance Features

- `invoices/InvoicesTable.tsx` — All invoices
- `contracts/ContractsTable.tsx` — All contracts
- `proposals/ProposalsTable.tsx` — All proposals

### Document Features

- `document-requests/DocumentRequestsTable.tsx`
- `files/FilesManager.tsx`
- `questionnaires/QuestionnairesTable.tsx`

### System / Settings Features

- `settings/SettingsManager.tsx` — Business configuration, system settings
- `settings/AuditLogViewer.tsx` — Audit log viewer (embedded in settings)
- `email-templates/EmailTemplatesManager.tsx`
- `knowledge-base/KnowledgeBase.tsx`
- `deleted-items/DeletedItemsTable.tsx`

### Advanced Features

- `analytics/AnalyticsDashboard.tsx`
- `performance/PerformanceMetrics.tsx`
- `time-tracking/TimeTrackingTable.tsx`
- `design-review/DesignReviewTable.tsx`
- `ad-hoc-analytics/AdHocAnalytics.tsx`
- `data-quality/DataQualityDashboard.tsx` — Includes MetricsHistoryTab, RateLimitingTab, ValidationErrorsTab
- `integrations/IntegrationsManager.tsx` — Includes StripeSection, CalendarSection, NotificationsSection
- `webhooks/WebhooksManager.tsx` — Includes WebhookFormModal, WebhookTestModal, WebhookStatsView
- `workflows/WorkflowsManager.tsx`

### Modals

`modals/AdminModalsProvider.tsx` is a global modal provider that wraps the admin layout and surfaces:

- `AddClientModal.tsx`
- `AddProjectModal.tsx`
- `EditClientInfoModal.tsx`
- `EditBillingModal.tsx`
- `DetailModal.tsx`

### Shared

- `shared/filterConfigs.ts` — Reusable filter configuration objects used across table components

---

## State Management

### Zustand Store (`portal-store.ts`)

| State Key | Type | Description |
|-----------|------|-------------|
| `role` | `'admin' \| 'client'` | Current user role, set from JWT on auth |
| `currentTab` | `string` | Active route/tab ID |
| `currentGroup` | `string \| null` | Active group (e.g. `'work'`, `'crm'`) |
| `navItems` | `UnifiedNavItem[]` | Sidebar nav items for current role |
| `subtabGroups` | `UnifiedSubtabGroup[]` | Grouped sub-navigation for current role |
| `features` | `PortalFeatures` | Feature flags for current role |
| `capabilities` | `FeatureCapabilities` | Capability flags for current role |
| `pageTitle` | `string` | Title of the current page |
| `sidebarCollapsed` | `boolean` | Sidebar collapse state (persisted to localStorage) |
| `theme` | `'light' \| 'dark'` | Current theme (persisted to localStorage) |

Navigation data is sourced from `server/config/unified-navigation.ts` and filtered by role at store initialisation. When `setRole` is called (by `usePortalAuth` after verifying the JWT), all navigation, features, and capabilities are refreshed in a single atomic update.

---

## Auth Guard

`RequireAuth` in `PortalRoutes.tsx` wraps the entire route tree:

- Reads auth state from `usePortalAuth`
- Renders a loading spinner while auth state is resolving
- Redirects to `/#/portal` via `SessionExpiredRedirect` if unauthenticated
- `usePortalAuth` bridges the HttpOnly cookie-based JWT to React state — `getAuthToken()` always returns `null` (cookies are not readable from JS); auth validity is confirmed by the session established server-side

---

## Client Invitation Flow

The admin invites a lead to create a client portal account using a magic link.

### Database Schema

Migration `server/database/migrations/010_client_invitation.sql` adds:

```sql
ALTER TABLE clients ADD COLUMN invitation_token TEXT;
ALTER TABLE clients ADD COLUMN invitation_expires_at DATETIME;
ALTER TABLE clients ADD COLUMN invitation_sent_at DATETIME;
ALTER TABLE clients ADD COLUMN last_login_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_clients_invitation_token ON clients(invitation_token);
```

### Invitation Steps

1. Admin clicks "Invite" in `ClientDetail` (Settings sub-tab or Overview)
2. Server generates a 64-character hex token
3. Client account is created (or updated) with the hashed token and a 7-day expiry
4. Email is sent with a magic link to `/api/auth/verify-invitation` and `/api/auth/set-password`
5. Lead status is updated to `active`

### API Endpoints

Verify invitation token:

```text
POST /api/auth/verify-invitation
Body: { "token": "<hex>" }
Response: { "success": true, "email": "...", "name": "..." }
```

Set password:

```text
POST /api/auth/set-password
Body: { "token": "<hex>", "password": "<new password>" }
Response: { "success": true, "message": "Password set successfully" }
```

---

## Server Routes

All backend routes remain unchanged from the previous architecture.

### Admin Routes (`server/routes/admin/`)

| File | Handles |
|------|---------|
| `dashboard.ts` | Stats overview and recent activity |
| `leads.ts` | Lead CRUD and invite endpoint |
| `projects.ts` | Admin project creation |
| `kpi.ts` | KPI data |
| `workflows.ts` | Workflow management |
| `notifications.ts` | Notification management |
| `cache.ts` | Cache control |
| `performance.ts` | Performance monitoring |
| `analytics.ts` | Analytics data |
| `contacts.ts` | Contact submissions |
| `files.ts` | File metadata |
| `time-entries.ts` | Time tracking entries |
| `messages.ts` | Messaging admin endpoints |
| `deleted-items.ts` | Soft-delete recovery |
| `deliverables.ts` | Deliverables admin endpoints |
| `design-reviews.ts` | Design review management |
| `email-templates.ts` | Email template CRUD |
| `ad-hoc-analytics.ts` | Ad hoc request analytics |

### Projects Routes (`server/routes/projects/`)

`core.ts`, `milestones.ts`, `tasks.ts`, `files.ts`, `messages.ts`, `templates.ts`, `time-tracking.ts`, `file-versions.ts`, `file-folders.ts`, `file-comments.ts`, `health.ts`, `escalation.ts`, `activity.ts`, `archive.ts`, `contracts.ts`, `intake.ts`, `tags.ts`

### Invoice Routes (`server/routes/invoices/`)

`core.ts`, `pdf.ts`, `batch.ts`, `recurring.ts`, `scheduled.ts`, `reminders.ts`, `credits.ts`, `deposits.ts`, `payment-plans.ts`, `aging.ts`, `client-routes.ts`

### Other Routes

`server/routes/auth.ts`, `clients.ts`, `messages.ts`, `uploads.ts`, `analytics.ts`, `proposals.ts`, `intake.ts`, `approvals.ts`, `triggers.ts`, `document-requests.ts`, `knowledge-base.ts`, `contracts.ts`, `receipts.ts`, `questionnaires.ts`, `webhooks.ts`, `integrations.ts`, `data-quality.ts`, `ad-hoc-requests.ts`

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) — Client-facing portal
- [Messaging](./MESSAGING.md) — Messaging system
- [Files](./FILES.md) — File management
- [API Documentation](../api/ENDPOINTS.md) — Full API reference
- [Architecture](../architecture/ARCHITECTURE.md) — System design overview
