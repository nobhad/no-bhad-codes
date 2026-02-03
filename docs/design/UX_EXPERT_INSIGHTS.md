# UX/UI Expert Insights and Audit

**Purpose:** Single doc for (1) expert research, (2) leg-work audit, and (3) remaining UX/UI audits from current_work (a11y, icon buttons, buttons, badges). Use to brief a UX/UI expert or validate decisions. Aligns with [current_work.md](../current_work.md) "Questions for UX/UI Expert" and related UX/UI items.

**Last updated:** February 2, 2026

**Design system and related docs (linked):**

| Resource | Purpose |
|----------|---------|
| [CSS_ARCHITECTURE.md](CSS_ARCHITECTURE.md) | Design system overview, token architecture, file organization, portal button design |
| [PORTAL_CSS_DESIGN.md](PORTAL_CSS_DESIGN.md) | Portal scope, `--portal-*` tokens, admin/portal bundles, naming |
| [UX_GUIDELINES.md](UX_GUIDELINES.md) | Typography, icons, buttons, forms, spacing, accessibility, focus states |
| [STYLE_CONSISTENCY_REPORT.md](STYLE_CONSISTENCY_REPORT.md) | CSS consistency audit and resolutions (colors, shadows, spacing) |
| [STATUS_SYSTEM.md](STATUS_SYSTEM.md) | Status values and badge semantics |
| **Source — design system tokens** | `src/design-system/` ([index.css](../../src/design-system/index.css)), [tokens/colors.css](../../src/design-system/tokens/colors.css), [tokens/buttons.css](../../src/design-system/tokens/buttons.css), [tokens/spacing.css](../../src/design-system/tokens/spacing.css), [tokens/typography.css](../../src/design-system/tokens/typography.css), [tokens/shadows.css](../../src/design-system/tokens/shadows.css), etc. |
| **Source — shared component styles** | [portal-buttons.css](../../src/styles/shared/portal-buttons.css), [portal-badges.css](../../src/styles/shared/portal-badges.css) |

---

# Part I — Expert research (questions + consensus)

## 1. Page titles vs. breadcrumbs + active tab

**Question:** Do we need explicit page titles (e.g. H1) when we already have breadcrumbs and the active tab indicated (e.g. red)?

**Expert consensus:**

- **Yes, keep an H1.** Each page should have one H1 that represents the page's primary topic. It should be the most prominent heading and clarify the page's focus.
- **Roles are different.** Breadcrumbs = secondary navigation (where you are in the hierarchy). H1 = primary topic of the *current* view. Tabs = organization of content *within* that view. They work together; one doesn't replace the other.
- **Semantics and accessibility.** Don't skip or duplicate H1 for "uniqueness." Use a single H1 that fits the content hierarchy. Screen readers and SEO both rely on a clear, logical heading structure.
- **Recommendation:** Keep breadcrumbs and active-tab styling. Also keep a visible H1 (or equivalent "page title") that names the current section or page (e.g. "Messages", "Project: Acme"). The H1 can sit below breadcrumbs and above tabs.

---

## 2. Best way to present the info (all info on all pages)

**Question:** Is the current way we present information the best approach? Evaluate **all information on all pages and every tab**, and **cross-tab on individual pages** (consistency across tabs within the same page) (page structure, titles, breadcrumbs, tabs, content layout, density, grouping).

**Expert principles (dashboard / admin UI):**

- **Structure, navigation, hierarchy, grouping, labeling, filtering** should work together so users can navigate naturally and see what's important.
- **Information architecture** should be intuitive and logical; group related data; design around a single goal per view and prioritize around it.
- **Layers of abstraction:** from raw data to KPIs, filtered subsets, and thresholds. Put urgent or high-priority items toward the top.
- **Simplicity:** communicate clearly, minimize distraction, avoid confusion, use visual presentation for quick perception.

**Recommendation:** Audit **every page and every tab**, and **cross-tab on each page** (do the tabs on a given page present info in a consistent way?). For each view, score: (1) Is the primary goal obvious? (2) Is the hierarchy clear? (3) Are grouping and labels consistent? (4) Is information density and layout appropriate? Document findings **per page, per tab, and cross-tab per page** (not just high-level principles).

---

## 3. Visual hierarchy

**Question:** Evaluate every page and tab for visual hierarchy (heading levels, emphasis, grouping, scan order), and **cross-tab on individual pages** (do tabs on the same page follow the same hierarchy patterns?).

**Expert consensus:**

- **Scanning:** Users scan more than they read. Headings and subheadings drive a "layer-cake" scan: eyes move across headings with occasional dips into body text. Headings should be descriptive so users can skip irrelevant sections.
- **One H1 per page**, then H2 → H3 in order; don't skip levels. Headings should describe the section that follows, not just act as visual styling.
- **Accessibility:** Many screen reader users navigate by headings first on long pages. Clear hierarchy helps both sighted scanning and assistive tech.
- **Evaluation:** Use heading structure (and optionally tools like WAVE, HeadingsMap, Accessibility Insights) on each key page/tab. Check: one H1, logical order, no level skips, descriptive text.

**Recommendation:** Audit each page/tab (and cross-tab within each page for consistency): list headings in DOM order, note any skips or multiple H1s, align visual weight with that structure, and note where tabs on the same page diverge in hierarchy.

---

## 4. Consistency audit

**Question:** Evaluate every page and every tab for inconsistencies (spacing, typography, button/card patterns, empty/error/loading states), and **cross-tab on individual pages** (are tabs within a page consistent with each other?).

**Expert consensus:**

- **Spacing:** Uniform vertical and horizontal spacing; consistent line-height by text type (e.g. body ~1.5, headings ~1.2–1.3); proportional space between sections.
- **Typography:** Type scale with a clear ratio (e.g. 1.2 or 1.25); defined sizes/weights for each heading level; hierarchy via size, weight, color, spacing (not one-off styles).
- **Scope:** Colors, fonts, imagery vs. brand/[design system](CSS_ARCHITECTURE.md); UI component uniformity (buttons, forms, spacing); impact on usability.
- **When:** Before big redesigns, after growth or new features, and at least periodically (e.g. annually).

**Recommendation:** Run a per-page/per-tab audit, and **cross-tab on each page** (compare tabs on the same page for consistency). For each: spacing, typography, components, and states. Note where tabs within a page diverge. Produce a report with consistent/inconsistent and specific fixes (per page, per tab, and cross-tab per page).

---

## 5. Admin Messages: split-tab layout (left = clients, right = thread + reply)

**Question:** Considering a split view: left = all clients list, right = message thread + reply area. Does this work? How to implement (resizable panels, mobile, selection state)?

**Expert consensus:**

- **Pattern is standard.** Left = conversation/contact list, right = thread + composer is the dominant pattern (e.g. Slack, WhatsApp Web, Teams, Intercom). It supports fast context switching while keeping the thread in view.
- **Components:** (1) Left: list of clients/conversations, with selection state and optional indicators (e.g. unread). (2) Right: selected thread (messages) + reply/composer. Optional: resizable divider, search/filter in left panel.
- **Mobile:** On small screens, either show list *or* thread (stacked or full-screen swap), not both; "back" from thread to list is expected.
- **Details:** Keep first-screen content height in mind (e.g. avoid overly tall panels that push thread below fold). Threaded replies can live in the right panel (e.g. expand a message to see replies) or in a nested view.

**Recommendation:** Proceed with the split layout. Left: client list with clear selection state and scroll. Right: thread + reply area. Add a resizable divider if space allows; on narrow viewports use a single pane (list or thread) with clear navigation between them. Ensure keyboard and screen reader can move between list and thread and send a reply.

---

## 6. Sidebar button order

**Question:** Sidebar buttons (admin and client portal) should have a more intuitive order. What order best matches user mental model, workflow, or frequency of use?

**For expert review:**

- **Admin sidebar (current order):** Dashboard (Overview) | Leads | Projects | Clients | Messages | Analytics | Knowledge | Documents | System.
- **Client portal sidebar (current order):** Dashboard | Messages | Files | Review (when applicable) | Invoices | New Project | Documents | Help | Settings.

**Recommendation:** Expert to evaluate and recommend a reordering (and optionally grouping, e.g. "Work" vs "Settings") for each sidebar. Document proposed order and rationale (e.g. most-used first, workflow sequence, or task-based groups). Consider consistency between admin and portal where both have analogous items (e.g. Messages, Files/Documents).

---

## 7. Panels evaluation and button placement

**Question:** Panels (detail panels, slide-outs, modals, cards with actions) need to be evaluated across admin and portal. We need to figure out button placement so it is consistent and clear.

**For expert review:**

- **Scope:** All panel-like surfaces — e.g. lead/contact details panels (Leads tab), client detail tab panels (Overview, Contacts, Activity, etc.), project detail tab panels (Overview, Files, Messages, Invoices, Tasks, Time, Contract), file detail modal (Info, Versions, Comments, Access), modals (create/edit, confirm, alert), and any card with action buttons (Account Actions, overview cards).
- **Button placement decisions:** Where should actions live — panel header (top-right, next to title), panel footer (bottom bar), inline with content (e.g. per row, per section), or a mix? When to use icon-only vs text vs icon+text? How to show primary vs secondary actions? Should "Account Actions" (client detail: Reset Password, Send Invitation, Archive, Delete) live in the header, a dedicated card, or both?
- **Consistency:** Same pattern for similar contexts (e.g. all detail slide-out panels use header actions; all modals use footer for primary/secondary).

**Recommendation:** Expert to evaluate every panel type, document current state (where buttons are now), and recommend a placement pattern (with rationale). Produce a short "Panel button placement" guideline (e.g. "Detail panels: primary action in header right; secondary in overflow menu or footer") and list any panels that should be refactored to match.

---

# Part II — Leg-work audit (inventory + findings)

## 1. Inventory: Pages and Tabs

### 1.1 Main site (index.html, hash routing)

| Page / Section | ID / Hash | Notes |
|----------------|-----------|--------|
| Intro / Home | `#/` (default) | Hero, no sidebar |
| About | `#/about` | Section in main |
| Contact | `#/contact` | Section in main |
| Projects | `#/projects` | Project list |
| Project detail | `#/projects/{id}` | Single project view |
| Admin login | `#/admin-login` or `#admin-login` | In-page form |

**Headings:** One sr-only H1 ("No Bhad Codes - Professional Web Development"); sections use H2 (ABOUT, projects, contact). Project detail uses H1 for project title.

### 1.2 Admin dashboard (admin/index.html, single-page tabs)

**Sidebar tabs (main sections):**

| data-tab | id | Page title (current) |
|----------|-----|----------------------|
| overview | tab-overview | Dashboard (h2) |
| leads | tab-leads | Leads (h2) |
| projects | tab-projects | Projects (h2) |
| clients | tab-clients | Clients (h2) |
| messages | tab-messages | Messages (h2) |
| analytics | tab-analytics | Analytics (h2) |
| knowledge-base | tab-knowledge-base | Knowledge Base (h2) |
| document-requests | tab-document-requests | Document Requests (h2) |
| system | tab-system | System Status (h2) |

**Overlay views (replace main content):**

| Section | Content | Title / heading |
|---------|---------|------------------|
| Client detail | tab-client-detail | h2.detail-title (client name) |
| Project detail | tab-project-detail | h2.detail-title (project name) |

**Client detail in-page tabs:** Overview (cd-tab-overview), Contacts, Activity, Projects, Invoices, Notes.

**Project detail in-page tabs (pd-tab-*):** Overview, Files, Messages, Invoices, Tasks, Time, Contract.

**Analytics sub-tabs:** Overview, Business, Visitors, Reports & Alerts.

**Other in-page tabs:** Lead panel (Overview, Tasks, Notes); File detail modal (Info, Versions, Comments, Access Log).

**Breadcrumbs:** Dashboard → [section] or Dashboard → Clients → Client / Dashboard → Projects → Project. Updated in admin-dashboard.ts per active tab.

### 1.3 Client portal (client/portal.html)

**Sidebar tabs:**

| data-tab | id | Page title (current) |
|----------|-----|----------------------|
| dashboard | tab-dashboard | h2 "Welcome Back, {name}!" |
| messages | tab-messages | Messages (h2) |
| files | tab-files | Files (h2) |
| preview | tab-preview | Project Preview (h2) |
| invoices | tab-invoices | Invoices (h2) |
| new-project | tab-new-project | New Project (h2) |
| documents | tab-documents | Document Requests (h2) + h3 for detail |
| help | tab-help | Help (h2); article view uses h1 for article title |
| settings | tab-settings | Settings (h2) |

**Breadcrumbs:** Set to "Dashboard" on login; "Dashboard > Your Website Project" in one flow. Tab labels (Files, Messages, etc.) are **not** consistently pushed into breadcrumbs when switching tabs.

### 1.4 Other pages

| Page | Heading usage |
|------|----------------|
| client/set-password.html | h1 "Set Your Password" / "Invalid or Expired Link" / "Password Set Successfully!"; h2 for sub-states |
| client/intake.html | h2 "Unable to load intake form" (error) |
| public/sign-contract.html | h1 "No Bhad Codes"; h2 for states and sections |

---

## 2. Page titles, breadcrumbs, and H1 audit

### 2.1 Summary

| Area | Breadcrumbs | Explicit page title (H1/H2) | Active tab indication |
|------|-------------|-----------------------------|------------------------|
| Main site | No | H1 sr-only; H2 per section | Nav highlight |
| Admin (main tabs) | Yes (Dashboard → Section) | h2 in .page-title | Sidebar .active (red) |
| Admin client detail | Yes (Dashboard → Clients → Client) | h2.detail-title (name) | In-page tab .active |
| Admin project detail | Yes (Dashboard → Projects → Project) | h2.detail-title (name) | In-page tab .active |
| Client portal | Partial (often just "Dashboard") | h2 in .page-title per tab | Sidebar .active |
| Set-password, intake, sign-contract | No | H1 or H2 | N/A |

### 2.2 Findings

- **Admin:** Breadcrumbs + active tab (red) + h2 page title are all present on main tabs and detail views. **Recommendation (expert):** Keep H1 for accessibility; consider adding a single visible H1 that matches the h2 (e.g. "Messages") or making the h2 the H1 so the page has one clear top-level heading.
- **Client portal:** Breadcrumbs often stay "Dashboard" when user is on Files, Messages, Invoices, etc. **Recommendation:** Update breadcrumbs on tab switch to match section (e.g. "Dashboard > Files", "Dashboard > Messages").
- **Main site:** Single sr-only H1 is valid; section H2s are clear. No breadcrumbs; not required for flat marketing pages.
- **Project/Client detail (admin):** No additional H1 above h2.detail-title; the detail title functions as the page heading. **Recommendation:** Use a single H1 for the visible page heading (e.g. project name or "Project: {name}") and use H2 for in-tab section headings for proper hierarchy.

### 2.3 Cross-tab (within same page)

- **Admin project detail:** All sub-tabs (Overview, Files, Messages, …) share the same h2 (project name). No per-tab heading change. **Consistent.**
- **Admin client detail:** Same pattern (client name as h2). **Consistent.**
- **Analytics:** One h2 "Analytics"; sub-tabs (Overview, Business, Visitors, Reports) have no additional h2/h3 in the static HTML; content is injected. **Check:** Ensure each sub-tab has a clear heading (e.g. H2 or H3) for the visible content.
- **Client portal:** Each main tab has its own .page-title h2 (Dashboard, Files, Messages, …). **Consistent.**

---

## 3. Visual hierarchy audit

### 3.1 Admin

- **Overview:** .page-title h2 "Dashboard" → quick-stats (no h3) → recent activity. **Gap:** Section labels (e.g. "Recent Activity") should be H3 or equivalent for scan order.
- **Leads / Projects / Clients:** .page-title h2 → table (no section headings in content). Table caption or a single H3 for "All leads" / "All projects" would help.
- **Messages:** .page-title h2 "Messages" → client selector → .messages-container. **Good.** Thread and compose have no extra headings; acceptable for a single-column layout.
- **Analytics:** .page-title h2 "Analytics" → .analytics-subtabs → sub-tab content. **Gap:** Sub-tab content (Overview, Business, Visitors, Reports) should each start with an H3 (or H2) naming the sub-section for heading navigation and scan order.
- **Document Requests / Knowledge Base / System:** .page-title h2 → content. **Check:** Long content (e.g. System) should use H3 for sub-sections.
- **Client detail:** h2 (client name) → in-page tabs → panels. Panels use cards; ensure each card has a heading (e.g. Overview card, Contacts list) for hierarchy.
- **Project detail:** h2 (project name) → in-page tabs → panels. Same as client detail; Overview card has h3 "Project Name" in card; other tabs (Files, Messages, Invoices) use lists/cards. **Cross-tab:** Overview uses h3 in card; Files/Messages/Invoices rely on "Files", "Messages", "Invoices" as tab labels only. **Recommendation:** Add a visible H3 (or aria) at top of each panel content for screen readers and scan order (e.g. "Project files", "Project messages").

### 3.2 Client portal

- **Dashboard:** h2 "Welcome Back…" → project cards (h3 "Your Website Project") → quick-stats. **Good.**
- **Files, Messages, Invoices, Documents, Help, Settings, New Project, Preview:** Each has .page-title h2. Content below varies (tables, lists, forms). **Recommendation:** For tabs with multiple sections (e.g. Settings), use H3 for each section.
- **Help:** Article view uses h1 for article title. **Good.** List view uses h2 "Help".

### 3.3 Cross-tab consistency (same page)

| Page | Tab A hierarchy | Tab B hierarchy | Consistent? |
|------|-----------------|----------------|-------------|
| Admin project detail | Overview: h2 → h3 in card | Files: h2 only, no content h3 | **No** — Files/Messages/Invoices lack content-level heading |
| Admin client detail | Overview: h2 → cards | Contacts: h2 → list | **Partial** — card titles vs list headers |
| Analytics | Overview: h2 → injected content | Business: h2 → injected content | **Unknown** — depends on injected markup; ensure each sub-tab has at least one heading |
| Client portal | Dashboard: h2 → h3 in cards | Files: h2 → table/list | **Partial** — Files/Messages could use H3 for "Files in this project" etc. |

**Recommendations:** (1) Add one heading per tab panel (H2 or H3) that names the tab content. (2) In admin project/client detail, standardize: either all tabs have a content H3 or all use the tab label as the only heading (then ensure tab is announced). (3) Audit Analytics sub-tab injection to ensure each has a heading.

---

## 4. Consistency audit

### 4.1 Empty / loading / error states

- **Tables (admin):** `showTableLoading`, `showTableEmpty`, `showTableError` used in Leads, Projects, Clients, Document Requests, Knowledge Base. **Consistent.**
- **Admin project detail:** `renderEmptyState()` and inline `<p class="empty-state">` for messages, files. **Consistent.**
- **Admin client detail:** Inline `.empty-state` for notes, projects, invoices. **Consistent.**
- **Admin files (file detail modal):** `.empty-state` for versions, comments, access log. **Consistent.**
- **Client portal:** Empty states vary (e.g. "No files", "Select a client to view messages"). **Recommendation:** Use a shared empty-state component (icon + message + optional CTA) where possible for consistency.

### 4.2 Spacing and typography

- **Design system:** `--space-*`, `--font-size-*`, `--portal-*` tokens used; single source in [design-system](../../src/design-system/) and variables (see [STYLE_CONSISTENCY_REPORT.md](STYLE_CONSISTENCY_REPORT.md)). **Baseline consistent.**
- **.page-title:** Used in admin and portal; padding/margin in layout.css and admin. **Consistent.**
- **Detail headers (client/project):** .detail-title-row, .detail-title-group in project-detail.css and client-detail.css. **Consistent between client and project detail.**

### 4.3 Buttons and cards

- **Admin tables:** .admin-table-card, .btn, .icon-btn, table-dropdown. **Consistent.**
- **Portal cards:** .portal-project-card, .portal-shadow. **Consistent.**
- **Modals:** confirm-dialog (h3 title), modal-component (h2). **Inconsistency:** Some modals use h2 (e.g. Document Request modals), confirm/alert use h3. **Recommendation:** Standardize modal titles to one level (e.g. all H2 or all H3) and use a single modal pattern.

### 4.4 Cross-tab consistency (same page)

- **Admin project detail tabs:** Overview uses .project-detail-overview, .portal-shadow; Files/Messages/Invoices use different layouts (file list, thread, invoice list). Spacing and card style are shared. **Mostly consistent;** minor differences in inner padding (e.g. messages thread vs files list).
- **Admin client detail tabs:** Same pattern; Overview vs Contacts vs Activity use different content but same panel class. **Consistent.**
- **Client portal tabs:** All use .page-title + content wrapper; spacing from layout.css. **Consistent.**

### 4.5 Per-page / per-tab inconsistency summary

| Page / tab | Spacing | Typography | Empty/loading | Buttons/cards | Notes |
|------------|---------|------------|---------------|---------------|--------|
| Admin Overview | OK | OK | N/A (stats) | OK | — |
| Admin Leads/Projects/Clients | OK | OK | OK | OK | — |
| Admin Messages | OK | OK | OK (empty state) | OK | Layout change proposed (split view) |
| Admin Analytics | OK | OK | Sub-tabs may vary | OK | Ensure sub-tab content has headings |
| Admin Document Requests / KB / System | OK | OK | OK | OK | — |
| Admin Client detail (all tabs) | OK | OK | OK | OK | — |
| Admin Project detail (all tabs) | OK | OK | OK | OK | Add content heading per tab |
| Client portal (all tabs) | OK | OK | Mixed | OK | Unify empty states; breadcrumb on tab switch |

---

## 5. Admin Messages: current state and split-view spec

### 5.1 Current state

- **Location:** Admin sidebar → Messages (`tab-messages`).
- **Layout:** Single column: top = .page-title h2 "Messages"; then client selector (dropdown "Select a client"); then one .messages-container (search, thread area, compose at bottom). User must select a client to see thread and reply.
- **Behavior:** Dropdown lists clients; selecting loads thread and enables textarea/send. No left rail of clients; no split.

### 5.2 Proposed: split-tab layout

- **Left panel:** List of all clients (scrollable). Show name, optional unread indicator. Selection state: one client active (highlight).
- **Right panel:** Message thread for selected client + reply area (same as current thread + compose).
- **Resizable:** Optional splitter between left and right; remember width in localStorage.
- **Mobile:** Single pane: show list by default; tapping a client shows thread (full-width) with "Back" to list. Or stacked: list above, thread below with sticky reply.

### 5.3 Implementation notes (for dev)

- **Left list:** Reuse or mirror client list from current dropdown (same API). Render as list of buttons or links; `aria-selected="true"` on active.
- **Right panel:** Keep existing #admin-messages-thread and #admin-compose-area; only show when a client is selected. On mobile, optionally hide left list when thread is shown.
- **URL/state:** Consider hash or query (e.g. `?client=123`) so "Messages" with a selected client is shareable or restorable.
- **A11y:** Ensure focus management when switching client (move focus to thread or first message); announce "Showing messages for {name}" (live region or title update).

---

## 6. Recommendations summary

1. **Page titles / H1:** Keep breadcrumbs and active tab styling. Add or expose one H1 per view (e.g. use h2 as H1 where it's the main heading, or add sr-only H1 that matches). Client portal: update breadcrumbs when switching tabs (e.g. "Dashboard > Files").
2. **Visual hierarchy:** Add section headings (H2/H3) where missing: Admin Overview (Recent Activity), Analytics sub-tabs, Project/Client detail tab content (one heading per panel). Ensure no heading level skips (H1 → H2 → H3).
3. **Cross-tab:** Align hierarchy and heading pattern across tabs on the same page (e.g. every project detail tab has a content H3 or equivalent).
4. **Consistency:** Standardize modal title level (H2 vs H3). Consider shared empty-state component for portal. Keep spacing/typography from [design system](CSS_ARCHITECTURE.md).
5. **Admin Messages:** Implement split view (left = clients, right = thread + reply); handle mobile with list/thread swap or stack; resizable divider optional; update state/URL and a11y as above.

---

# Part III — Remaining audits (current_work UX/UI)

These sections complete the audits called out in current_work: a11y (WCAG readiness), icon button tooltips, button consistency, badges, and skip-link/language coverage.

---

## 7. Accessibility (A11y) code audit — WCAG readiness

**Source:** current_work "Planned: Full WCAG 2.1 AA Compliance"; Phase 1 = run axe/Lighthouse/WAVE. This is a **code-level** pass to document what’s already in place and what Phase 2 will need to fix.

### 7.1 Skip link and main landmark

| Page | Skip link | Target ID |
|------|-----------|-----------|
| index.html (main site) | Yes | `#main-content` |
| admin/index.html | Yes | `#admin-main` |
| client/portal.html | Yes | `#dashboard-content` |
| client/intake.html | **No** | Has `<main id="main-content">` but no skip link in template |
| client/set-password.html | **No** | No skip link found |
| public/sign-contract.html | Not audited | — |

**Recommendation:** Add skip link to client/intake.html and client/set-password.html (e.g. "Skip to main content" → `#main-content` or equivalent main ID).

### 7.2 Language

All audited HTML pages have `<html lang="en">` (index, admin, portal, intake, set-password, sign-contract, build). **OK.**

### 7.3 Images and alt text

| Location | Alt text | Note |
|----------|----------|------|
| Portal/admin sidebar logos | "No Bhad Codes" | OK |
| index.html about photo | "Coyote the dog" | OK |
| index.html project hero | `alt=""` (dynamic, set by JS) | Ensure JS sets meaningful alt when image loads |
| index.html 404 sign | "404 Work In Progress sign" | OK |
| templates/pages/projects.ejs | `alt=""` | Placeholder; ensure runtime sets alt for project images |
| Set-password logo | "No Bhad Codes" | OK |

**Recommendation:** Ensure any dynamic `<img>` (e.g. project hero, project list) gets a non-empty, meaningful `alt` when content is set (or `alt=""` only if purely decorative).

### 7.4 Form labels

- [UX_GUIDELINES.md](UX_GUIDELINES.md): labels required; placeholders as hint only. Confirm-dialog and modal forms use labels or `aria-label`; many admin tables use `.sr-only` labels for search/filter. **Spot-check:** Ensure every form control has an associated label or `aria-label` (Phase 2 fix list).

### 7.5 Focus and keyboard

- [UX_GUIDELINES.md](UX_GUIDELINES.md): visible focus ring; all interactive elements keyboard-accessible. Confirm-dialog has focus trap; modals use focus management. **Recommendation:** Run Lighthouse/axe on each page to list focus-order and focus-visible issues; add reduced-motion if missing.

### 7.6 Pages to run Phase 1 tools

Per current_work: `/`, `/#about`, `/#contact`, `/#portfolio`, `/admin`, `/client/portal`, `/client/intake`, `/client/set-password`. Add `/client/set-password` and ensure intake has a skip link before auditing.

---

## 8. Icon button tooltips audit

**Source:** current_work "Icon button tooltips — All icon-only buttons should have title/tooltip (and aria-label) for accessibility and discoverability."

### 8.1 Result

- **createIconButton()** (src/components/icon-button.ts): Always sets `aria-label` and `title` (defaults to label). Any icon button created via this helper is compliant.
- **Admin HTML (admin/index.html):** All icon buttons in the sampled list (export, refresh, add, edit CRM/billing/custom fields, document requests, KB, system refresh) have both `title` and `aria-label`.
- **TS-rendered icon buttons:** Sampled admin-clients, admin-leads, admin-contacts, admin-projects, admin-client-details, admin-proposals, table-filter, admin-project-details: all include both `title` and `aria-label` (or dynamic equivalents, e.g. "Download {filename}").
- **portal-modal close:** Uses createIconButton, so compliant.

**Conclusion:** No gaps found. Icon-only buttons audited have both tooltip and aria-label. **Recommendation:** Keep using createIconButton for new icon buttons; when adding inline icon buttons, always include `title` and `aria-label`.

---

## 9. Button consistency audit

**Source:** current_work "Button design — Audit for consistency" (Detail Views Redesign / General).

### 9.1 Pattern in use

- **Admin:** `.btn-primary` for primary actions (e.g. Save, Create); `.btn-secondary` for secondary/cancel; `.btn-outline` for tertiary; `.btn-danger` for destructive; `.icon-btn` for icon-only (see §8). Tables use `.btn.btn-outline.btn-sm` and `.icon-btn` for row actions.
- **Portal:** Same tokens ([portal-buttons.css](../../src/styles/shared/portal-buttons.css)); `.btn-primary`, `.btn-secondary`, etc.
- **Proposals / Document requests / KB:** Mix of `.btn-primary`, `.btn-outline`, `.btn-danger` for create/edit/delete; consistent with admin tables.

### 9.2 Inconsistencies

- **Modal primary action:** Some modals use "Save" as primary, others "Submit" or "Create"; wording varies but visual treatment (primary = solid) is consistent.
- **Detail panels (client/project):** Account Actions and panel actions use `.icon-btn`; some legacy `.btn`/`.btn-secondary` were refactored to `.icon-btn` per current_work. No remaining inconsistency called out in audit.

**Conclusion:** Button usage is consistent with [design system](CSS_ARCHITECTURE.md) ([portal-buttons.css](../../src/styles/shared/portal-buttons.css), [design-system tokens](../../src/design-system/tokens/)). **Recommendation:** When adding new flows, use primary for one main action per view and secondary/outline for the rest; use icon-btn for toolbar/row icon-only actions.

---

## 10. Badge usage audit

**Source:** current_work "Badges — Redesign for clarity" (General). This audit documents **where** badges are used so a redesign can be applied consistently.

### 10.1 Where badges appear

- **Status badges:** Project status, client status, lead status, invoice status, proposal status, contact status, document request status (admin and portal). Rendered via status-badge component or `.status-badge` class; styles in [portal-badges.css](../../src/styles/shared/portal-badges.css) and admin (see [STATUS_SYSTEM.md](STATUS_SYSTEM.md)).
- **Counts / pills:** Sidebar notification badges (unread messages, pending invoices); numeric pills in tabs (e.g. "Tasks (3)").
- **Lead scoring:** Score-hot, score-warm, score-cold in leads pipeline (admin).
- **Page title badges:** Project/client detail header (status next to name) use `.page-title-with-badge` / `.status-badge`.

### 10.2 Consistency

- Single source for status colors and badge shape in [portal-badges.css](../../src/styles/shared/portal-badges.css); admin and project-detail import or extend (see [STATUS_SYSTEM.md](STATUS_SYSTEM.md)). **Recommendation for redesign:** Apply one clear visual system (e.g. solid background + contrast text, or outline + text) across all status and count badges; ensure color is not the only differentiator (WCAG 1.4.1).

---

## 11. WCAG / current_work alignment

| current_work item | Where covered in this doc |
|-------------------|----------------------------|
| Full WCAG 2.1 AA Compliance (Phase 1: Audit) | §7 (a11y code audit); Phase 1 tools and page list |
| Icon button tooltips | §8 (all icon buttons have title + aria-label) |
| Button design — Audit for consistency | §9 (button consistency) |
| Badges — Redesign for clarity | §10 (badge usage audit) |
| Questions for UX/UI Expert | Part I (research) + Part II (inventory, hierarchy, consistency, Messages) |
| Sidebar button order | Part I §6 (for expert review; current order documented) |
| Panels evaluation and button placement | Part I §7 (evaluate all panels; figure out button placement; document pattern) |
| Portal styling / Detail views | Part II consistency and cross-tab; current_work has open items (Account Actions, tabs responsive, etc.) |

---

## 12. Styling concerns for review

Items where the current styling looks off or inconsistent; document for expert/developer review and fix.

### 12.1 Lead funnel stage (Won / success state)

**Location:** Admin → Leads tab → funnel section (lead pipeline by stage). Also referenced in Analytics (admin-leads.ts, admin-analytics.ts).

**Markup (example — Won stage):**

```html
<div class="funnel-stage funnel-stage-success" data-stage="won">
  <span class="funnel-stage-value" id="funnel-won">0</span>
  <span class="funnel-stage-label">Won</span>
</div>
```

**Styles:** `src/styles/admin/analytics.css` (`.funnel-stage`, `.funnel-stage-value`, `.funnel-stage-label`, `.funnel-stage-success`). Success state uses `rgba(var(--color-success-rgb), 0.15)` background and `var(--status-active)` border and value color. Leads pipeline also uses `.funnel-stage` in `src/styles/admin/leads-pipeline.css`.

**Concern:** Styling of this component looks funny (per user feedback). For review: alignment with [design tokens](../../src/design-system/tokens/) (e.g. [colors.css](../../src/design-system/tokens/colors.css), [spacing](../../src/design-system/tokens/spacing.css)), contrast, spacing, and consistency with other stat/funnel components (e.g. dashboard stat cards, [badge styles](../../src/styles/shared/portal-badges.css)).

---

## Next steps

- Use this doc in a session with a UX/UI expert to confirm or correct each point.
- Turn recommendations into concrete tasks (e.g. "Add H1 to Messages view", "Add skip link to intake and set-password", "Run axe on all Phase 1 pages").
- After implementation, re-run the hierarchy and consistency checks on changed pages.
- Track fixes in current_work.md and re-audit after changes.
