# Client Portal Deep Dive: Implemented vs State of the Art

**Date:** January 28, 2026  
**Purpose:** Audit the **entire** client portal—every view, surface, and flow—and compare it to state-of-the-art client-portal software. Focus: what’s implemented, what’s static/placeholder, and what’s missing to make the portal best-in-class.

**Related:** [CRM_CMS_DEEP_DIVE.md](./CRM_CMS_DEEP_DIVE.md) covers CRM/CMS broadly; this doc is **portal-only**.

---

## Already Planned (CMS Enhancement Plan)

**Most of the gaps below are already in [current_work.md](./current_work.md) — CMS Enhancement Plan, Tiers 1–8.** This deep dive is an **audit + cross-reference**, not a separate backlog.

| Portal gap | Planned in |
|------------|------------|
| Activity feed (Recent Activity from API) | **Tier 2.1** |
| Client-facing timeline (milestones) | **Tier 2.2** |
| Notification preferences (API-backed UI) | **Tier 2.3** |
| Unread / "New" badges (Messages, Invoices, Files) | **Tier 2.4** |
| Self-service knowledge base | **Tier 2.5** |
| Document requests (admin requests, client checklist) | **Tier 3.1**, 3.2 |
| Deliverable tracking + approval workflow | **Tier 4.1**, 4.2, 4.3 |
| Payment reminders (email) | **Tier 5.1** |
| MFA, SSO | **Tier 7.2**, 7.3 |
| Virtual tour / first-time walkthrough | **Tier 8.1** |
| Visual proofing & annotations (on preview) | **Tier 8.2** |
| Mobile / PWA push notifications | **Tier 8.4** |

**Order:** See **Implementation Priority Matrix** and **QUICK START: P0 Items** in `current_work.md` (e.g. 2.1 Activity Feed, 2.4 Unread Badges, 1.1 Scheduler).

**Not yet in plan:** Dashboard project cards + quick stats from API (2.1 covers activity; stats/cards could extend it), **thread list / thread switcher**, **real-time messages** (WebSockets/SSE), **Pay now / Stripe**, **e-signatures**, **dynamic file filter**, **profile refresh after save**.

---

## 1. Portal Entry Points & Auth

| Item | Implemented | Notes |
|------|-------------|-------|
| **Login** | Yes | Email + password, JWT in localStorage, HttpOnly cookies, demo mode |
| **Magic link** | Yes | Passwordless invite flow |
| **Set password** | Yes | Dedicated `set-password.html` after invite |
| **Logout** | Yes | Clears auth, returns to login |
| **Theme** | Yes | Light/dark via `data-theme`, persisted in `localStorage` |
| **Skip link** | Yes | “Skip to main content” for a11y |
| **Portal entry** | Yes | `/client/portal.html` |

**Gaps:** No “forgot password” from portal (reset exists but may be admin-initiated). No 2FA, no SSO.

---

## 2. Layout & Navigation

| Item | Implemented | Notes |
|------|-------------|-------|
| **Sidebar** | Yes | Logo, nav buttons, project list, sign out; collapses on mobile |
| **Sidebar toggle** | Yes | Header arrow toggles sidebar |
| **Tabs** | Yes | Dashboard, Messages, Files, Review, Invoices, New Project, Settings |
| **Tab switching** | Yes | `switchTab()`; loads files/invoices/messages/preview on select |
| **Mobile header title** | Yes | Updates per tab |
| **Breadcrumbs** | Yes | Used in nav module (e.g. Settings > Account) |
| **Project list in sidebar** | Yes | Populated from `/api/projects` via `loadRealUserProjects` |
| **Project selection** | Yes | Click project → project detail view (updates, files, messages) |
| **Unread / “New” badges** | No | No badges on Messages, Invoices, or Files in sidebar |

**Gaps:** No global unread/new indicators. No keyboard shortcuts (e.g. switch tabs). Review tab only shown when a project has a preview URL.

---

## 3. Dashboard Tab

| Item | Implemented | Data source | Notes |
|------|-------------|------------|-------|
| **Welcome copy** | Yes | API | “Welcome Back, {name}!” — name from user |
| **Project cards** | Partial | **Static** | Single hardcoded “Your Website Project” card in HTML; **not** replaced by API data |
| **Quick stats** | Partial | **Static** | “Active Projects”, “Pending Invoices”, “Unread Messages” — **placeholder numbers (1, 0, 1)**; never updated from API |
| **Recent activity** | Partial | **Static** | Placeholder list (“Project outline uploaded…”, “Intake received…”, “Account activated…”); **no** `/api/client/activity` or equivalent |
| **Stat cards clickable** | Yes | — | Navigate to Dashboard, Invoices, Messages tabs |
| **Project list (sidebar)** | Yes | API | Real projects from `loadRealUserProjects` |

**Gaps:** Dashboard project cards, quick stats, and recent activity are **not** driven by live data. Top-level dashboard feels static despite real project list in sidebar.

---

## 4. Messages Tab

| Item | Implemented | Notes |
|------|-------------|-------|
| **Load threads** | Yes | `GET /api/messages/threads` |
| **Show messages** | Yes | **First thread only** — `threads[0]`; no thread list / thread picker |
| **Send message** | Yes | `POST …/threads/:id/messages` or `/inquiry` if no thread |
| **Mark read** | Yes | `PUT …/threads/:id/read` on load |
| **Cache-bust on send** | Yes | Re-fetches after send |
| **Attachments** | Yes | Via messages API (multipart) |
| **Emoji** | Yes | `emoji-picker-element` in compose |
| **Real-time updates** | No | No WebSockets/SSE; user must switch tab or refresh to see new messages |
| **Thread list** | No | Single conversation only; no way to switch between project vs general threads |

**Gaps:** One thread only, no real-time, no thread switcher. Matches “simple inbox” but not “state of the art” messaging.

---

## 5. Files Tab

| Item | Implemented | Notes |
|------|-------------|-------|
| **List files** | Yes | `GET /api/uploads/client`; real data |
| **Upload** | Yes | Drag-and-drop + browse; multi-file (e.g. up to 5) |
| **Preview** | Yes | PDF (new tab), images (modal), text/JSON (modal) |
| **Download** | Yes | Original filename |
| **Delete** | Yes | Own uploads only; confirm dialog |
| **Project filter** | Partial | Filter UI in HTML; options **hardcoded** (“All Projects”, “Your Website Project”); not driven by API |
| **Project-scoped upload** | — | Upload target (project vs general) depends on API; filter and list show `projectName` when present |
| **Document requests** | No | No “requested by admin” / “received” tracking |

**Gaps:** Project filter not dynamic. No document-request workflow (request → receive → remind).

---

## 6. Invoices Tab

| Item | Implemented | Notes |
|------|-------------|-------|
| **List invoices** | Yes | `GET /api/invoices/me` |
| **Summary** | Yes | Total Outstanding, Total Paid from API |
| **Preview** | Yes | Opens PDF in new tab |
| **Download** | Yes | PDF download |
| **Status badges** | Yes | Pending, Paid, Overdue, etc. |
| **Pay now** | No | No Stripe (or other) integration; payment offline / manual |

**Gaps:** No in-portal payment. No payment reminders surfaced in UI (backend automation would be separate).

---

## 7. Settings Tab

| Item | Implemented | Notes |
|------|-------------|-------|
| **Profile** | Yes | Name, email, company, phone; `PUT /api/clients/me` |
| **Password** | Yes | Current / new / confirm; `PUT /api/clients/me/password`; visibility toggles |
| **Billing** | Yes | Billing form; `PUT /api/clients/me` (or similar) for billing fields |
| **Notification prefs** | Partial | UI exists; `saveNotificationSettings` → `PUT …/me/notifications`. Some code paths use **sessionStorage** only (`portal-settings` load/save) — risk of not persisting to backend |
| **Load from API** | Partial | Profile/billing loaded via `loadUserSettings`; notification load may use sessionStorage |
| **Sub-views** | Yes | Account, Billing, Notifications (nav module) |

**Gaps:** Notification prefs persistence (API vs sessionStorage) should be unified. No “export my data” or “delete account” in portal.

---

## 8. New Project Tab

| Item | Implemented | Notes |
|------|-------------|-------|
| **Form** | Yes | Name, type, budget, timeline, description |
| **Submit** | Yes | `POST /api/projects/request` |
| **Success** | Yes | Toast, form reset, `loadRealUserProjects`, switch to dashboard |
| **Intake** | Yes | Terminal-style intake in same tab (conditional) |
| **Client context** | Yes | Pre-fill from session / settings where used |

**Gaps:** New project appears in sidebar after submit, but dashboard project cards and recent activity still static. No draft/save-for-later.

---

## 9. Project Detail View (Project Selected)

| Item | Implemented | Notes |
|------|-------------|-------|
| **Show project** | Yes | Title, status, description, phase, next milestone, progress, dates |
| **Updates timeline** | Yes | From `project.updates` (from `GET /api/projects/:id`) |
| **Files** | Yes | Loaded via files module in project context |
| **Messages** | Yes | From `project.messages` (same API); rendered in detail view |
| **Milestones** | Yes | From project data; progress derived |
| **Preview** | Yes | If preview URL, “Review” tab / iframe |

**Gaps:** No deliverable-level approve/revision workflow. No client-facing timeline (e.g. Gantt). Updates are list-only, not full activity feed.

---

## 10. Review Tab (Preview)

| Item | Implemented | Notes |
|------|-------------|-------|
| **Preview iframe** | Yes | Project preview URL when available |
| **Visibility** | Yes | Shown only when project has preview URL |

**Gaps:** No annotations, no version compare, no “request changes” from preview.

---

## 11. Branding, UX, and Technical

| Item | Implemented | Notes |
|------|-------------|-------|
| **Branding** | Yes | Logo, theme, your domain |
| **Responsive** | Yes | Mobile breakpoints, sidebar behavior |
| **A11y** | Yes | Skip link, ARIA on messages, labels, focus management |
| **Password visibility** | Yes | Toggles on password inputs |
| **Toasts** | Yes | Success/error feedback |
| **Loading states** | Yes | Buttons, file list, etc. |
| **PWA / offline** | Partial | Service worker caches main site; portal not specifically offline-first |
| **Error handling** | Yes | Container errors, retry where relevant |

**Gaps:** Portal-specific offline support limited. No in-app help or knowledge base.

---

## 12. State-of-the-Art Portal: What’s Missing

*(Where already planned, Tier ref in parentheses.)*

### 12.1 Data & Consistency

- **Dashboard:** Project cards, quick stats, and recent activity API-driven. **(Activity feed → Tier 2.1;** stats/cards could extend same endpoint.)
- **Activity feed:** Single “Recent Activity” from messages, files, invoices, updates, milestones. Replace static placeholders. **(Planned: Tier 2.1)**
- **Unread badges:** Sidebar badges for Messages, Invoices, Files. **(Planned: Tier 2.4)**

### 12.2 Messaging

- **Thread list:** Choose among general vs project-specific threads instead of only first thread. *(Not yet in plan.)*
- **Real-time:** WebSockets or SSE so new messages appear without refresh. *(Not yet in plan.)*
- **In-app notifications:** Toasts or bell for new messages when on another tab. *(Partially: Tier 8.4 push; in-portal live not yet.)*

### 12.3 Files & Documents

- **Document requests:** Admin requests docs; client sees "requested" vs "received"; reminders. **(Planned: Tier 3.1, 3.2)**
- **Dynamic project filter:** File filter from `/api/projects`, not hardcoded. *(Not yet in plan.)*

### 12.4 Payments & Invoices

- **Pay now:** Stripe (or similar) in-portal. *(Not yet in plan; Tier 5 = reminders, deposits, recurring.)*
- **Payment history:** Clear list of payments (partly there via invoice status). *(Clarify as needed.)*

### 12.5 Approvals & Workflows

- **Deliverable approval:** Approve or request revisions; workflow states. **(Planned: Tier 4.1, 4.2, 4.3)**
- **E-signatures:** Contract (and optionally proposal) signing in-portal. *(Not yet in plan.)*

### 12.6 Self-Service & Help

- **Knowledge base:** FAQs, "How do I…?" in-portal. **(Planned: Tier 2.5)**
- **Inline help:** Tooltips or short guidance. *(Not yet in plan.)*

### 12.7 Real-Time & Polish

- **Live updates:** Activity, messages, and notifications without reload. *(Not yet in plan; push → Tier 8.4.)*
- **Profile refresh after save:** Header/sidebar update immediately. *(Not yet in plan.)*
- **Project list refresh:** New project request → list + dashboard reflect it. *(You already reload projects; dashboard cards/stats static until 2.1.)*

---

## 13. Prioritized Portal-Only Recommendations

**Aligns with your [CMS Enhancement Plan](./current_work.md) (Tiers 1–8).** Build order = **Implementation Priority Matrix** and **QUICK START: P0** in `current_work.md`. Tier refs below for "already planned" items.

### P0 – Fix placeholders and data *(matches your P0)*

1. **Dashboard from API**  
   - Add `GET /api/client/dashboard` (or reuse existing) for project count, pending invoice count, unread message count, recent activity. Replace static cards, stats, activity.  
   - *(Extends **Tier 2.1** Activity Feed; same endpoint can serve stats/cards.)*

2. **Activity feed** — **(Planned: Tier 2.1)**  
   - Aggregate messages, file uploads, project updates, invoice events. Use for "Recent Activity."

3. **Notification prefs** — **(Planned: Tier 2.3)**  
   - Always load/save via `PUT/GET …/me/notifications`. Remove sessionStorage-only paths.

4. **Unread badges** — **(Planned: Tier 2.4)**  
   - Badges on Messages, Invoices, Files in sidebar.

### P1 – Messaging and files

5. **Thread list** *(Not yet in plan.)*  
   - List all threads (general + project); select one to view messages.

6. **Real-time messages** *(Not yet in plan.)*  
   - WebSockets or SSE for new messages; optional toast when not on Messages tab.

7. **Dynamic file filter** *(Not yet in plan.)*  
   - Populate "Files by project" from API.

8. **Document requests** — **(Planned: Tier 3.1, 3.2)**  
   - Admin requests docs; client sees "requested" vs "received," upload to satisfy.

### P2 – Payments and approvals

9. **Pay now** *(Not yet in plan.)*  
   - Stripe (or similar) for invoices in-portal.

10. **Deliverable approval** — **(Planned: Tier 4.1, 4.2, 4.3)**  
    - Per-deliverable approve / request changes; workflow states.

11. **E-signatures** *(Not yet in plan.)*  
    - Contract (and optionally proposal) signing in-portal.

### P3 – Self-service and polish

12. **Knowledge base** — **(Planned: Tier 2.5)**  
    - Searchable help (FAQs, how-to) in portal.

13. **Profile refresh** *(Not yet in plan.)*  
    - After saving profile, update "Welcome Back, {name}" and sidebar without reload.

## 14. Summary

| Area | Implemented | Placeholder / partial | Missing |
|------|-------------|------------------------|--------|
| **Auth** | Login, magic link, set password, logout, theme | — | Forgot password (self-serve), 2FA/SSO (Tier 7.2, 7.3) |
| **Nav** | Sidebar, tabs, project list, breadcrumbs | — | Unread badges (Tier 2.4), keyboard shortcuts |
| **Dashboard** | Welcome, clickable stats, project list (sidebar) | Project cards, quick stats, recent activity **all static** | API-driven dashboard, activity feed (Tier 2.1) |
| **Messages** | Threads API, send, read, attachments, emoji | Single thread only | Thread list, real-time *(not in plan)* |
| **Files** | List, upload, preview, download, delete | Project filter **hardcoded** | Dynamic filter *(not in plan)*, document requests (Tier 3.1) |
| **Invoices** | List, summary, preview, download, status | — | Pay now *(not in plan)* |
| **Settings** | Profile, password, billing, notification UI | Notification persistence (API vs sessionStorage) | Consistent API (Tier 2.3), export/delete account |
| **New project** | Form, submit, terminal intake | — | Draft, dashboard refresh consistency |
| **Project detail** | Overview, updates, files, messages, milestones, preview | — | Deliverable approval (Tier 4.1), client timeline (Tier 2.2) |
| **Review** | Preview iframe | — | Annotations (Tier 8.2), “request changes” |
| **Help** | — | — | Knowledge base (Tier 2.5), inline help |

**Biggest portal gaps:**  
(1) **Dashboard** project cards, stats, and recent activity are static.  
(2) **Messages** single-thread only, no real-time.  
(3) **No Pay now** for invoices.  
(4) **No document requests**, **no deliverable approval**, **no e-sign**.  
(5) **No knowledge base** or in-portal help.

**Most of the above are already in your [CMS Enhancement Plan](./current_work.md)** (Tiers 2.1–2.5, 3.1, 4.1, 8.2). Build order: **P0** (dashboard + activity + notification prefs + unread badges) then **P1** (thread list, real-time, file filter, document requests) per `current_work.md` Implementation Priority Matrix.
