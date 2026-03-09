# Client Portal

**Status:** Complete
**Last Updated:** 2026-03-08

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Entry Point Flow](#entry-point-flow)
5. [Auth Flow](#auth-flow)
6. [Routing](#routing)
7. [Shared SPA Files](#shared-spa-files)
8. [Feature Components](#feature-components)
9. [Notification Bell](#notification-bell)
10. [Server Routes](#server-routes)
11. [Password Autocomplete Best Practices](#password-autocomplete-best-practices)
12. [File Locations](#file-locations)
13. [Related Documentation](#related-documentation)

---

## Overview

The Client Portal is the client-facing side of the portal system. It is a React SPA that mounts into a server-rendered EJS shell. Clients log in via the main site and are redirected to the portal, where they can track projects, communicate, view invoices, upload files, manage settings, and more.

Key features:

- Project progress tracking and detail views
- Messaging threads
- File management with drag-and-drop upload
- Invoice viewing and PDF download
- Settings (profile, billing, notifications, contacts)
- Questionnaires, proposals, approvals, deliverables
- Ad hoc requests
- Onboarding wizard for new clients
- Live site preview (iframe)
- Notification bell with polling

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| State | Zustand |
| Routing | React Router (hash-based) |
| Build | Vite with code splitting |
| Animations | GSAP |
| Auth | HttpOnly JWT cookies |
| Backend | Express + SQLite |
| Template Shell | EJS |

---

## Architecture

The portal runs as a single React SPA shared between the admin and client portals. Role-based rendering inside `PortalRoutes.tsx` determines which routes and UI elements are shown.

```text
server/views/layouts/portal.ejs       # EJS shell served by Express
  └── .dashboard-container.portal     # Mount target for React SPA

src/portal.ts                         # Vite entry point (client bundle)
  └── src/react/app/mount-portal.tsx  # Mounts React SPA into DOM
        └── PortalApp.tsx             # React root with providers
              └── PortalRoutes.tsx    # Role-based route definitions
                    └── PortalLayout.tsx  # Sidebar + header + content
```

The client and admin portals share the same React component tree. Route visibility is gated by `user.role` read from the `usePortalAuth` hook.

---

## Entry Point Flow

1. Vite compiles `src/portal.ts` as the client bundle entry.
2. Express serves the EJS shell at the portal route, rendering `server/views/layouts/portal.ejs`.
3. The EJS shell includes the compiled bundle and exposes a `.dashboard-container.portal` div.
4. `src/react/app/mount-portal.tsx` calls `mountPortalApp()`, which mounts `PortalApp.tsx` into `.dashboard-container.portal`.
5. `PortalApp.tsx` wraps the app in providers (Zustand, React Router).
6. `PortalRoutes.tsx` renders routes based on `user.role`.

---

## Auth Flow

1. Client navigates to `/#/portal` (main site login page, outside the React SPA).
2. Server validates credentials and sets an HttpOnly JWT cookie.
3. Server redirects client to `/dashboard` (the portal EJS page).
4. React SPA loads; `usePortalAuth` reads the session from sessionStorage.
5. `RequireAuth` guard checks `isAuthenticated`; redirects to `/#/portal` if not.
6. For clients: `user.role = 'client'`, `user.contactName` is shown in the welcome message.

Auth uses HttpOnly cookies exclusively. `getAuthToken()` always returns `null` — bearer tokens are not used in this portal.

---

## Routing

All routes are hash-based (e.g., `/#/dashboard`). `PortalRoutes.tsx` renders client-only routes when `user.role === 'client'`.

| Hash Route | Component | Description |
|---|---|---|
| `/dashboard` | `PortalDashboard` | Overview, quick stats, project cards, recent activity |
| `/messages` | `PortalMessagesView` | Messaging threads |
| `/invoices` | `PortalInvoicesTable` | Invoice list with PDF download |
| `/files` | `PortalFilesManager` | File upload and management |
| `/settings` | `PortalSettings` | Profile, billing, notifications, contacts |
| `/questionnaires` | `PortalQuestionnairesView` | Questionnaire forms |
| `/projects` | `PortalProjectsList` | Project list; clicking a project shows `PortalProjectDetail` |
| `/contracts` | `PortalContracts` | Contract cards |
| `/requests` | `PortalAdHocRequests` | Ad hoc request management |
| `/deliverables` | `PortalDeliverables` | Deliverable cards |
| `/proposals` | `PortalProposals` | Proposal cards |
| `/approvals` | `PortalApprovals` | Approval cards |
| `/review` | `PortalPreview` | Live site preview via iframe |
| `/help` | `PortalHelp` | Help center |

Note: `/settings` and `/contracts` are shared routes accessible to both clients and admins.

---

## Shared SPA Files

These files are shared between the admin and client portals.

| File | Purpose |
|---|---|
| `src/react/app/PortalApp.tsx` | React root; sets up providers |
| `src/react/app/PortalRoutes.tsx` | Role-based route rendering |
| `src/react/app/PortalLayout.tsx` | Sidebar + header + main content layout |
| `src/react/app/PortalSidebar.tsx` | Navigation sidebar |
| `src/react/app/PortalHeader.tsx` | Header; shows "Welcome Back, [Name]!" for clients |
| `src/react/stores/portal-store.ts` | Zustand store for portal state |
| `src/react/hooks/usePortalAuth.ts` | Auth hook; bridges sessionStorage to React state |
| `src/react/app/mount-portal.tsx` | Mounts `PortalApp` into the EJS shell |

---

## Feature Components

All client feature components live under `src/react/features/portal/`.

### Dashboard

**Directory:** `dashboard/`

**Component:** `PortalDashboard`

Displays an overview of the client's account: quick stats (active projects, pending invoices, unread messages), project cards with progress, and a recent activity feed.

### Messages

**Directory:** `messages/`

**Components:** `PortalMessagesView`, `MessageThread`

**Hook:** `usePortalMessages`

Threaded messaging between client and admin.

### Invoices

**Directory:** `invoices/`

**Component:** `PortalInvoicesTable`

Invoice list with status badges, PDF preview, and download.

### Files

**Directory:** `files/`

**Components:** `PortalFilesManager`, `FileUploadDropzone`

File management with drag-and-drop upload, preview, and download.

### Settings

**Directory:** `settings/`

**Component:** `PortalSettings`

**Sub-components:** `ProfileForm`, `BillingForm`, `NotificationsForm`, `ContactsSection`

**Hook:** `useSettingsData`

Account settings with backend persistence.

### Questionnaires

**Directory:** `questionnaires/`

**Components:** `PortalQuestionnairesView`, `QuestionnaireForm`

Client questionnaire submission.

### Projects

**Directory:** `projects/`

**Components:** `PortalProjectsList`, `PortalProjectDetail`

Project list and detail views with status, progress, milestones, and files.

### Contracts

**Directory:** `contracts/`

**Components:** `PortalContracts`, `ContractCard`

Contract viewing.

### Ad Hoc Requests

**Directory:** `ad-hoc-requests/`

**Components:** `PortalAdHocRequests`, `AdHocRequestCard`, `NewRequestForm`

Submit and track ad hoc work requests.

### Deliverables

**Directory:** `deliverables/`

**Components:** `PortalDeliverables`, `DeliverableCard`

View and approve deliverables.

### Proposals

**Directory:** `proposals/`

**Components:** `PortalProposals`, `ProposalCard`

View and respond to proposals.

### Approvals

**Directory:** `approvals/`

**Components:** `PortalApprovals`, `ApprovalCard`

Review and approve items.

### Preview

**Directory:** `preview/`

**Component:** `PortalPreview`

Iframe embed for live site preview.

### Help

**Directory:** `help/`

**Component:** `PortalHelp`

Help center and FAQ.

### Onboarding

**Directory:** `onboarding/`

**Components:** `OnboardingWizard`, `BasicInfoStep`, `RequirementsStep`, `AssetsStep`, `ProjectOverviewStep`, `ConfirmationStep`

Multi-step onboarding wizard for new clients.

### Document Requests

**Directory:** `document-requests/`

**Components:** `PortalDocumentRequests`, `DocumentRequestCard`

Request and track document delivery.

### Shared

**Directory:** `shared/`

**File:** `filterConfigs.ts` — shared filter configuration used across portal views.

**File:** `types.ts` — shared TypeScript types for portal features.

---

## Notification Bell

**Component:** `src/react/components/portal/NotificationBell.tsx`

Used in `PortalHeader.tsx`. Polls the notifications endpoint every 60 seconds and shows unread count badge.

### Features

- Bell icon with unread count badge
- Dropdown showing recent 10 notifications
- Mark individual notification as read
- Mark all notifications as read
- Click outside or Escape key closes dropdown

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients/me/notifications/history?limit=10` | Fetch recent notifications |
| PUT | `/api/clients/me/notifications/:id/read` | Mark one notification as read |
| PUT | `/api/clients/me/notifications/mark-all-read` | Mark all as read |

---

## Server Routes

| File | Purpose |
|---|---|
| `server/routes/clients.ts` | Profile, settings, dashboard data, notifications |
| `server/routes/uploads.ts` | File upload and download |
| `server/routes/projects/` | Project management |
| `server/routes/invoices/` | Invoices with PDF generation |
| `server/routes/messages.ts` | Messaging threads |
| `server/routes/intake.ts` | Intake form and status |
| `server/routes/proposals.ts` | Proposals |
| `server/routes/approvals.ts` | Approvals |
| `server/routes/deliverables.ts` | Deliverables |
| `server/routes/contracts.ts` | Contracts |
| `server/routes/questionnaires.ts` | Questionnaires |

### Key Client API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/clients/me` | Get current client profile |
| PUT | `/api/clients/me` | Update profile (name, company, phone) |
| PUT | `/api/clients/me/password` | Change password |
| PUT | `/api/clients/me/notifications` | Update notification preferences |
| PUT | `/api/clients/me/billing` | Update billing information |
| GET | `/api/clients/me/dashboard` | Dashboard overview data |
| GET | `/api/uploads/client` | Get all files for authenticated client |
| GET | `/api/uploads/project/:projectId` | Get files for a specific project |
| GET | `/api/uploads/file/:fileId` | Download or preview a file |
| DELETE | `/api/uploads/file/:fileId` | Delete a file |
| POST | `/api/uploads/multiple` | Upload multiple files |
| GET | `/api/invoices/me` | Get all invoices for client with summary |
| GET | `/api/invoices/:id` | Get specific invoice details |
| GET | `/api/invoices/:id/pdf` | Download invoice as PDF |

---

## Password Autocomplete Best Practices

To prevent browsers from showing multiple "Save Password" prompts, follow this pattern consistently across all portal forms.

| Field | `autocomplete` Value | Reason |
|---|---|---|
| Form element | `off` | Prevents form-level password manager triggers |
| Username / Email | `username` | Identifies the account field |
| Current password | `current-password` | For login and password verification |
| New password | `new-password` | For password change forms |
| Confirm password | `off` | Prevents duplicate save prompts |

Do not dynamically change `autocomplete` attributes in JavaScript — browsers may re-evaluate and show multiple save prompts.

---

## File Locations

| Path | Purpose |
|---|---|
| `src/portal.ts` | Vite entry point for client bundle |
| `src/react/app/mount-portal.tsx` | Mounts React SPA into EJS shell |
| `src/react/app/PortalApp.tsx` | React root with providers |
| `src/react/app/PortalRoutes.tsx` | Role-based route definitions |
| `src/react/app/PortalLayout.tsx` | Sidebar + header + content layout |
| `src/react/app/PortalSidebar.tsx` | Navigation sidebar |
| `src/react/app/PortalHeader.tsx` | Portal header |
| `src/react/stores/portal-store.ts` | Zustand store |
| `src/react/hooks/usePortalAuth.ts` | Auth hook |
| `src/react/components/portal/NotificationBell.tsx` | Notification bell component |
| `src/react/features/portal/` | All client feature components |
| `src/react/features/portal/types.ts` | Shared portal TypeScript types |
| `src/react/features/portal/shared/filterConfigs.ts` | Shared filter configuration |
| `server/views/layouts/portal.ejs` | EJS shell served by Express |
| `server/routes/clients.ts` | Client profile, settings, dashboard API |
| `server/routes/uploads.ts` | File upload/download API |
| `server/routes/projects/` | Project management API |
| `server/routes/invoices/` | Invoice API with PDF generation |
| `server/routes/messages.ts` | Messaging API |

---

## Related Documentation

- [Messages](./MESSAGING.md) - Messaging system details
- [Files](./FILES.md) - File upload and management
- [Invoices](./INVOICES.md) - Invoice system
- [Settings](./SETTINGS.md) - User settings
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system
- [Architecture Overview](../architecture/ARCHITECTURE.md) - System design

## Change Log

### 2026-03-08 - Full rewrite to React architecture

- Replaced vanilla TypeScript module documentation (`ClientPortalModule`, `BaseModule`) with current React SPA architecture
- Documented `PortalApp.tsx` → `PortalRoutes.tsx` → lazy-loaded feature components flow
- Updated auth section: HttpOnly cookies, sessionStorage via `usePortalAuth`, `RequireAuth` guard
- Updated notification bell: now a React component (`NotificationBell.tsx`) in `PortalHeader.tsx`
- Replaced module file tree with current `src/react/features/portal/` feature directory listing
- Removed all references to deleted files: `src/features/client/client-portal.ts`, `portal-navigation.ts`, `portal-views.ts`, and related vanilla TS modules
