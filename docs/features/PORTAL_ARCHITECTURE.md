# Portal Architecture

**Status:** Complete
**Last Updated:** 2026-03-08

## Overview

Both the Admin Dashboard and Client Portal are served as a single React SPA. The server renders an EJS shell, then React mounts client-side and handles all navigation. Routes and features are role-gated at runtime based on a JWT payload stored in an HttpOnly cookie.

## Entry Points

Both portals mount into `.dashboard-container.portal` via `src/react/app/mount-portal.tsx`.

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
| `src/react/app/PortalLayout.tsx` | Shell: sidebar + header + `<Outlet />` content |
| `src/react/app/PortalSidebar.tsx` | Left navigation (collapsed/expanded state, nav items from store) |
| `src/react/app/PortalHeader.tsx` | Top header: logo, sidebar toggle, page title, notification bell, theme toggle |
| `src/react/app/PortalSubtabs.tsx` | Subtab group navigation (Work, CRM, Documents groups) |
| `src/react/app/LazyTabRoute.tsx` | Suspense wrapper for lazy-loaded route components |
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

### Shared Routes

Rendered differently per role via `role === 'admin'` check:

- `/dashboard`
- `/messages`
- `/invoices`
- `/files`
- `/questionnaires`
- `/projects`
- `/contracts`
- `/settings`

### Admin-Only Routes

- `/analytics`, `/performance`, `/work`, `/crm`, `/documents`
- `/leads`, `/contacts`, `/clients`, `/tasks`
- `/requests`, `/deliverables`, `/proposals`, `/document-requests`
- `/support`, `/system`, `/email-templates`
- `/deleted-items`, `/time-tracking`, `/design-review`, `/ad-hoc-analytics`
- `/data-quality`, `/integrations`, `/webhooks`, `/workflows`
- `/client-detail/:clientId`, `/project-detail/:projectId`

### Client-Only Routes

- `/approvals`
- `/review`
- `/help`

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

## Change Log

### 2026-03-08 — Initial documentation

- Documented React SPA architecture for Admin and Client portals
- Covered auth model, store shape, route structure, code splitting, theme, and navigation config
