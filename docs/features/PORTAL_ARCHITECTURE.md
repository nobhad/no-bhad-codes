# Portal Architecture

**Status:** Complete
**Last Updated:** 2026-04-30

## Overview

Both the Admin Dashboard and Client Portal are served as a single React SPA. The server renders an EJS shell, then React mounts client-side and handles all navigation. Routes and features are role-gated at runtime based on a JWT payload stored in an HttpOnly cookie.

## Entry Points

Both portals mount into the `<div class="portal">` element rendered by `server/views/layouts/portal.ejs`. The mount is performed by `mountPortalApp()` in `src/react/app/mount-portal.tsx`, invoked from the `ReactPortalModule` factory in `src/core/modules-config.ts`.

- **Admin:** `src/admin.ts` (Vite entry) — server serves `/dashboard`
- **Client:** `src/portal.ts` (Vite entry) — server serves `/dashboard`

## Authentication

- HttpOnly JWT cookies are used for all API calls (`credentials: 'include'`)
- `getAuthToken()` always returns `null` — no bearer token is sent in headers
- `usePortalAuth` reads/writes sessionStorage and validates the session against the server via `/api/clients/me` or `/api/admin/me`
- `role` is set from the JWT payload: `'admin'` or `'client'`
- `RequireAuth` guard in `PortalRoutes.tsx` redirects to `/#/portal` if the user is not authenticated

## Core Files

| File | Purpose |
|------|---------|
| `src/react/app/PortalApp.tsx` | Root component. Wraps with providers (Router, store, error boundaries). |
| `src/react/app/PortalProviders.tsx` | Context providers composition |
| `src/react/app/PortalRoutes.tsx` | All routes, role-based rendering, auth guard |
| `src/react/app/PortalLayout.tsx` | Shell: sidebar + header + `<Outlet />` content + SearchModal (Cmd+K) |
| `src/react/app/PortalSidebar.tsx` | Left navigation (collapsed/expanded state, nav items from store) |
| `src/react/app/PortalHeader.tsx` | Top header: logo, sidebar toggle, page title, notification bell, theme toggle |
| `src/react/app/PortalSubtabs.tsx` | Subtab group navigation (Work, CRM, Documents groups). Renders page-specific actions on right side. |
| `src/react/contexts/SubtabContext.tsx` | Subtab state context: active subtab, set subtab, page-specific actions |
| `src/react/app/LazyTabRoute.tsx` | Suspense wrapper for lazy-loaded route components |
| `src/react/components/SearchModal.tsx` | Global Cmd+K search overlay with keyboard navigation, grouped results, debounced search |
| `src/react/app/mount-portal.tsx` | React SPA mount factory (called once on page load) |
| `src/react/stores/portal-store.ts` | Zustand store |
| `src/react/hooks/usePortalAuth.ts` | Auth hook |

## Zustand Store (`portal-store.ts`)

### State Shape

- `role: 'admin' | 'client'` — current user role
- `currentTab: string` — active route tab
- `currentGroup: string | null` — active group (work / crm / documents)
- `navItems: UnifiedNavItem[]` — nav items for current role
- `subtabGroups: UnifiedSubtabGroup[]` — subtab groups for current role
- `features: PortalFeatures` — enabled features for role
- `capabilities: FeatureCapabilities` — permissions for role
- `pageTitle: string` — header page title
- `sidebarCollapsed: boolean` — sidebar state (persisted in localStorage)
- `theme: 'light' | 'dark'` — current theme (persisted in localStorage)

### Actions

`setRole`, `switchTab`, `setSidebarCollapsed`, `toggleSidebar`, `setTheme`, `toggleTheme`

## Navigation Config

Navigation items, subtab groups, and feature flags are defined in `server/config/unified-navigation.ts` and shared between server and client. The store initializes with the role's nav config when `setRole()` is called.

Exported helpers:

- `getNavigationForRole()`
- `getSubtabGroupsForRole()`
- `getFeaturesForRole()`
- `getCapabilitiesForRole()`
- `getDefaultTabForRole()`
- `canAccessTab()`
- `resolveTab()`
- `getTabTitle()`

## Route Structure

All routes are wrapped in a `RequireAuth > PortalLayout` guard. Route components are lazy-loaded via `LazyTabRoute`.

### Shared Routes (role-gated render)

These paths render different components depending on `role`:

- `/dashboard` — `OverviewDashboard` (admin) / `PortalDashboard` (client)
- `/messages` — `MessageView` / `PortalMessagesView`
- `/files` — `FilesManager` / `PortalFilesHub`
- `/contracts` — `ContractsTable` / `PortalContracts`
- `/deliverables` — `DeliverablesTable` / `PortalDeliverablesHub`
- `/proposals` — `ProposalsTable` / `PortalProposals`
- `/agreements` — `AgreementBuilder` / `AgreementsList`
- `/meetings` — `MeetingRequestsTable` / `MeetingRequestsList`
- `/retainers` — `RetainersTable` / `PortalRetainers`
- `/feedback` — `FeedbackTable` / `PortalFeedback`
- `/documents` — `DocumentsDashboard` / `PortalDocuments`
- `/settings` — `PortalSettings` (shared component)

### Admin-Only Routes

- Dashboards: `/analytics`, `/performance`, `/system-health`, `/work`, `/crm`
- CRM: `/leads`, `/contacts`, `/clients`, `/tasks`
- Work: `/requests`, `/document-requests`
- System: `/support`, `/system`, `/email-templates`, `/deleted-items`
- Advanced: `/time-tracking`, `/design-review`, `/ad-hoc-analytics`, `/data-quality`, `/integrations`, `/webhooks`, `/workflows`
- Detail views: `/client-detail/:clientId`, `/project-detail/:projectId`
- Sequences & Automations: `/sequences`, `/automations`, `/automation-detail/:automationId`
- Finance: `/expenses`
- Feedback: `/feedback-analytics`, `/testimonials`
- Embed: `/embed-widgets`
- Templates: `/onboarding-templates`

### Client-Only Routes

- `/agreements/:id` — Step-by-step agreement flow
- `/proposals/:id` — Proposal detail view with accept/decline
- `/requests-hub` — Unified hub: ad hoc requests, questionnaires, document requests
- `/content-requests` — Content request checklists
- `/payment-schedule` — Payment installment tracking
- `/auto-pay` — Auto-pay configuration
- `/help` — Knowledge base

### Client Redirects (legacy paths)

- `/invoices` → `/documents`
- `/projects` → `/dashboard`
- `/questionnaires` → `/requests-hub`
- `/document-requests` → `/requests-hub`
- `/requests` → `/requests-hub`
- `/approvals` → `/deliverables`
- `/review` → `/dashboard`

## Code Splitting

All feature components are lazy-loaded using `React.lazy()` via the `lazyNamed()` helper:

```typescript
function lazyNamed(loader) {
  return React.lazy(() =>
    loader().then(mod => {
      const key = Object.keys(mod).find(
        k => typeof mod[k] === 'function' && /^[A-Z]/.test(k)
      );
      return { default: mod[key] };
    })
  );
}
```

Each feature directory has:

- `index.ts` — exports the component
- `mount.tsx` — standalone mount entry (legacy support)

## Theme System

- Theme is stored in localStorage under `STORAGE_KEYS.THEME`
- Applied via `document.documentElement.setAttribute('data-theme', theme)`
- CSS reads `html[data-theme="light"]` to apply light mode
- Dark mode is the default

## Sidebar Persistence

- Collapsed state is stored in localStorage under `STORAGE_KEYS.SIDEBAR_COLLAPSED`
- Applied as a CSS class on the layout container

## Subtab State Management

Portal subtabs use `SubtabContext` (React context) for state management:

- `useActiveSubtab<T>()` — read the active subtab with type safety
- `useSetSubtab()` — change the active subtab
- `useSetSubtabActions()` — inject page-specific actions into the subtab row
- `SubtabProvider` wraps the portal app in `PortalApp.tsx`

This replaced the previous DOM custom event system (`document.dispatchEvent`/`addEventListener`).

## Change Log

### 2026-04-30 — Routing accuracy pass

- Corrected mount target from `.dashboard-container.portal` to `.portal` (matches `server/views/layouts/portal.ejs` and `mount-portal.tsx`).
- Rewrote routing section to reflect role-based branching: split into "Shared Routes (role-gated render)", "Admin-Only", "Client-Only", and "Client Redirects". Phase labels removed since features are shipped.
- Added missing routes: `/auto-pay` (client), `/system-health`, `/onboarding-templates` (admin).
- Documented that `/agreements`, `/meetings`, `/retainers`, `/feedback`, `/documents`, `/files`, `/contracts`, `/deliverables`, `/proposals` are role-gated shared paths (not admin-only).

### 2026-03-17 — Phase 6 SearchModal integration

- Added SearchModal (Cmd+K / Ctrl+K) to PortalLayout via useSearchModal hook
- SearchModal is a portal-rendered overlay, not a route -- available from any page
- Searches 9 entity types with relevance scoring and grouped results

### 2026-03-17 — Phase 5B embed widgets route

- Added /embed-widgets to admin-only routes (EmbedWidgetsManager)

### 2026-03-17 — Phase 5A feedback routes

- Added /feedback to client-only routes (PortalFeedback)
- Added /feedback, /feedback-analytics, /testimonials to admin-only routes (Phase 5A)

### 2026-03-16 — Subtab system refactor

- Replaced DOM custom events with `SubtabContext` (React context)
- Added `SubtabProvider` to `PortalApp.tsx`
- Updated 7 dashboard components to use context hooks
- Fixed race condition with `pendingSubtab` ref pattern

### 2026-03-08 — Initial documentation

- Documented React SPA architecture for Admin and Client portals
- Covered auth model, store shape, route structure, code splitting, theme, and navigation config
