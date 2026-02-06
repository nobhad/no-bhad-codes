# UX/UI Implementation Plan

**Created:** February 3, 2026
**Status:** Ready for implementation
**Source:** [current_work.md](../current_work.md)

This plan consolidates all UX/UI audit findings into actionable phases, prioritized by impact, dependency, and effort. Each phase can be executed independently, though earlier phases should complete first where noted.

---

## Executive Summary

The audit identified work across 5 major areas:

|Area|Items|Priority|
|------|-------|----------|
|**Accessibility (WCAG 2.1 AA)**|Skip links, focus states, contrast, landmarks|P0 - Critical|
|**Information Architecture**|H1 structure, breadcrumbs, visual hierarchy|P1 - High|
|**Consistency**|Headings, spacing, empty states, modals|P1 - High|
|**Component Redesign**|Messages split-view, sidebar order, panels|P2 - Medium|
|**Polish**|Badges, disabled states, toggles, columns|P3 - Low|

**Estimated total effort:** 8-12 days (2-3 sprints)

---

## Phase 0: Accessibility Foundation (P0 - Critical)

**Rationale:** WCAG compliance is a legal and ethical requirement. These items must be addressed before any visual changes.

**Duration:** 1-2 days
**Dependencies:** None

### 0.1 Skip Links (Missing Pages)

**Audit finding:** `client/intake.html` and `client/set-password.html` lack skip links.

**Tasks:**

- [ ] Add skip link to `client/intake.html` → `#main-content`
- [ ] Add skip link to `client/set-password.html` → `#main-content`
- [ ] Verify skip link visibility on keyboard focus
- [ ] Test with screen reader (VoiceOver)

**Files:** `client/intake.html`, `client/set-password.html`

### 0.2 Heading Structure (H1 per Page)

**Audit finding:** Some pages use H2 as the primary heading; client portal breadcrumbs stay "Dashboard" on tab switch.

**Status:** COMPLETED (Feb 6, 2026)

**Tasks:**

- [x] Admin: Convert `.page-title h2` to H1 for each main tab (Overview, Leads, Projects, etc.)
- [x] Admin detail views: Keep h2 for client/project name but ensure it's the primary heading (or convert to H1)
- [x] Client portal: Convert `.page-title h2` to H1 for each tab
- [x] Ensure no H1 → H3 jumps; use H2 for sub-sections

**Files Modified:** `admin/index.html`, `client/portal.html`, `src/styles/admin/project-detail.css`, `src/styles/client-portal/layout.css`

### 0.3 Breadcrumb Updates (Portal)

**Audit finding:** Client portal breadcrumbs often stay "Dashboard" when on Files, Messages, etc.

**Tasks:**

- [ ] Update breadcrumb text on tab switch in `client-portal.ts`
- [ ] Pattern: "Dashboard" → "Dashboard > Files" → "Dashboard > Files > {filename}" (where applicable)
- [ ] Ensure breadcrumb is updated synchronously with tab activation

**Files:** `src/features/client/client-portal.ts`, `src/features/client/modules/portal-navigation.ts`

### 0.4 Phase 1 Accessibility Audit (Tools)

**Audit finding:** Need baseline audit before Phase 2 fixes.

**Tasks:**

- [ ] Run Lighthouse on: `/`, `/#about`, `/#contact`, `/#portfolio`
- [ ] Run Lighthouse on: `/admin` (all tabs)
- [ ] Run Lighthouse on: `/client/portal` (all tabs)
- [ ] Run Lighthouse on: `/client/intake`, `/client/set-password`
- [ ] Run axe-core or WAVE on same pages
- [ ] Document issues in `docs/design/ACCESSIBILITY_AUDIT.md`

**Output:** Issue list with WCAG criterion, severity, and page/element location.

---

## Phase 1: Information Architecture & Hierarchy (P1 - High)

**Rationale:** Clear hierarchy and consistent structure are foundational to usability. Must complete before visual polish.

**Duration:** 2-3 days
**Dependencies:** Phase 0.2 (heading structure)

### 1.1 Visual Hierarchy Fixes (Admin)

**Audit finding:** Overview, Analytics sub-tabs, and project/client detail tabs lack content-level headings.

**Tasks:**

- [ ] **Admin Overview:** Add H3 "Recent Activity" above the activity list
- [ ] **Analytics sub-tabs:** Add H3 at start of each sub-tab content (Overview, Business, Visitors, Reports)
- [ ] **Project detail tabs:** Add H3 "Project Files", "Project Messages", etc. at start of each tab panel
- [ ] **Client detail tabs:** Add H3 "Client Contacts", "Client Activity", etc. at start of each tab panel
- [ ] **Lead/File detail panels:** Add H3 for panel title if not present

**Files:** `admin/index.html`, `src/features/admin/modules/admin-overview.ts`, `src/features/admin/modules/admin-analytics.ts`, `src/features/admin/admin-project-details.ts`, `src/features/admin/modules/admin-client-details.ts`

### 1.2 Visual Hierarchy Fixes (Portal)

**Audit finding:** Files/Messages tabs could use content-level heading for scan order.

**Tasks:**

- [ ] Add H3 "Your Files" or "Project Files" at top of Files tab content
- [ ] Add H3 "Messages" at top of Messages tab content (if not present)
- [ ] Add H3 for Settings sections (Profile, Notifications, Password)

**Files:** `client/portal.html`, `src/features/client/modules/portal-files.ts`, `src/features/client/modules/portal-messages.ts`

### 1.3 Cross-Tab Consistency (Same Page)

**Audit finding:** Tabs on the same page should follow consistent hierarchy patterns.

**Tasks:**

- [ ] **Admin project detail:** Ensure all 7 tabs (Overview, Files, Messages, Invoices, Tasks, Time, Contract) have the same heading pattern (H2 project name + H3 content heading)
- [ ] **Admin client detail:** Ensure all 6 tabs (Overview, Contacts, Activity, Projects, Invoices, Notes) have the same heading pattern
- [ ] **Client portal:** Ensure all tabs use H1 page title + consistent content structure
- [ ] Document the heading pattern in `UX_GUIDELINES.md`

**Files:** Various admin and portal files

---

## Phase 2: Consistency Audit Fixes (P1 - High)

**Rationale:** Inconsistencies create cognitive load and reduce trust. Standardization improves perceived quality.

**Duration:** 2-3 days
**Dependencies:** Phase 1 (hierarchy must be stable before standardizing)

### 2.1 Modal Title Standardization

**Audit finding:** Some modals use H2, some use H3 for titles. Icon and title should be on same line.

**Tasks:**

- [ ] Standardize all modal/dialog titles to H2 (or consistently H3)
- [ ] Update `.confirm-dialog-header` to flexbox row with `align-items: center`
- [ ] Ensure icon and title sit on same horizontal line
- [ ] Apply to: confirm-dialog, portal-modal, all admin modals (Create Metric Alert, Edit CRM, etc.)

**Files:** `src/styles/shared/confirm-dialog.css`, `src/utils/confirm-dialog.ts`, `src/components/portal-modal.ts`, all modal-rendering code

### 2.2 Empty State Component

**Audit finding:** Empty states vary across portal; recommend shared component.

**Tasks:**

- [ ] Create `src/components/empty-state.ts` component (icon + message + optional CTA)
- [ ] Create `.empty-state` styles in `src/styles/shared/portal-components.css`
- [ ] Replace inline empty states in: portal-files, portal-messages, admin-files, admin-client-details, admin-project-details
- [ ] Standardize: 32px icon, centered, muted text, optional primary button

**Files:** New `src/components/empty-state.ts`, `src/styles/shared/portal-components.css`, various feature files

### 2.3 Spacing and Typography Consistency

**Audit finding:** Spacing and typography are mostly consistent via design tokens; verify no regressions.

**Tasks:**

- [ ] Audit `.page-title` padding/margin across admin and portal tabs
- [ ] Verify all content areas use `--space-*` tokens (not hardcoded px)
- [ ] Verify all text uses `--font-size-*` tokens
- [ ] Document any exceptions in CSS_ARCHITECTURE.md

**Files:** Various CSS files

### 2.4 Table Header Visibility

**Audit finding:** Some table headers get cut off (contacts table).

**Status:** Marked as fixed in current_work (scroll wrapper solution).

**Tasks:**

- [ ] Verify fix is complete on all 8 admin tables
- [ ] Test horizontal scroll on narrow viewports
- [ ] Ensure header row has `min-height: 48px` and `vertical-align: middle`

**Files:** `src/styles/admin/index.css`, `admin/index.html`

---

## Phase 3: Component Redesign (P2 - Medium)

**Rationale:** These are larger changes that improve workflow but require more design decisions.

**Duration:** 3-4 days
**Dependencies:** Phase 2 (consistency should be stable)

### 3.1 Admin Messages: Split-View Layout

**Audit finding:** Current single-column layout requires dropdown selection; split-view (left clients, right thread) is standard pattern.

**Design:**

```text
+-------------------+--------------------------------+
| CLIENTS           | MESSAGE THREAD                 |
| [x] Client A      | [Message 1]                    |
|     Client B      | [Message 2]                    |
|     Client C      | [Message 3]                    |
|                   |                                |
|                   | [____Compose area____] [Send]  |
+-------------------+--------------------------------+
```

**Tasks:**

- [ ] Create left panel: client list with selection state, optional unread indicator
- [ ] Create right panel: message thread (existing) + compose area (existing)
- [ ] Add resizable divider (optional, localStorage for width)
- [ ] Mobile: single pane with list ↔ thread navigation ("Back" button)
- [ ] Update URL/state: `?client=123` so selection is shareable
- [ ] A11y: focus management when switching clients; announce "Showing messages for {name}"

**Files:**

- `admin/index.html` (tab-messages structure)
- New `src/features/admin/modules/admin-messages.ts` (or extend existing)
- `src/styles/shared/portal-messages.css` (layout changes)
- `src/styles/admin/index.css` (admin-specific overrides)

**Reference:** See Messages tab in current_work.md

### 3.2 Sidebar Button Order

**Audit finding:** Current order may not match user mental model or frequency.

**Current Admin:**
Dashboard | Leads | Projects | Clients | Messages | Analytics | Knowledge | Documents | System

**Current Portal:**
Dashboard | Messages | Files | Review | Invoices | New Project | Documents | Help | Settings

**Recommendation (for expert review):**

Admin (frequency-based):

```text
Dashboard | Projects | Clients | Messages | Leads | Invoices(?) | Analytics | Knowledge | Documents | System
```

Portal (task-flow):

```text
Dashboard | Projects(?) | Messages | Files | Invoices | Documents | Help | Settings | New Project
```

**Tasks:**

- [ ] Get user/stakeholder input on preferred order
- [ ] Reorder sidebar buttons in `admin/index.html`
- [ ] Reorder sidebar buttons in `client/portal.html`
- [ ] Update `aria-label` and tab order accordingly
- [ ] Document final order in `UX_GUIDELINES.md`

**Files:** `admin/index.html`, `client/portal.html`

### 3.3 Panels Evaluation & Button Placement

**Audit finding:** Button placement in panels (detail panels, modals, cards) needs standardization.

**Proposed pattern:**

|Panel Type|Primary Action|Secondary Actions|Overflow|
|------------|----------------|-------------------|----------|
|Detail slide-out (lead, contact)|Header right (icon-btn)|Header right (icon-btn group)|`...` menu if >3|
|Detail tab (client, project)|Header right (icon-btn)|Card footer or inline|N/A|
|Modal (create/edit)|Footer right (btn-primary)|Footer left (btn-secondary)|N/A|
|Confirm dialog|Footer right (btn-primary/danger)|Footer left (btn-secondary)|N/A|
|Card with actions (Account Actions)|Move to header or keep in card|N/A|N/A|

**Tasks:**

- [ ] Document "Panel Button Placement" guideline in `UX_GUIDELINES.md`
- [ ] Audit and refactor Account Actions (client detail) - move to page header as icon buttons
- [ ] Audit lead/contact panel actions - ensure icon-btn in header
- [ ] Audit modals - ensure primary in footer right, secondary in footer left
- [ ] Ensure consistent use of `icon-btn` for toolbar/row actions

**Files:** `admin/index.html`, `src/features/admin/modules/admin-client-details.ts`, `src/features/admin/modules/admin-contacts.ts`, `src/features/admin/modules/admin-leads.ts`, CSS files

---

## Phase 4: Portal Styling & Polish (P3 - Low)

**Rationale:** These are UX polish items that improve the experience but don't block core functionality.

**Duration:** 2 days
**Dependencies:** Phase 3 (component changes should be stable)

### 4.1 Open Portal Styling Concerns

From current_work "Portal styling (user feedback)":

|Item|Status|Priority|
|------|--------|----------|
|Message input disabled state|Open|Medium|
|"Knowledge" name (was "KB")|Open|Low|
|Toggle better design|Open|Medium|
|Client table: email under name + company|Open|Medium|
|Name/company/email one column|Open|Medium|
|Account Actions placement|Open|High (Phase 3.3)|
|Modal icon + H3 same line|Open|High (Phase 2.1)|
|Modal forms: reusable dropdown|Open|Medium|
|Analytics: reusable components|Open|Medium|

**Tasks:**

- [ ] **Message input disabled:** Remove different bg on disabled textarea; only style send button
- [ ] **Toggle design:** Improve view toggle (Table/Pipeline, list/card) styling
- [ ] **Client table columns:** Combine Name + Email into one column; show Company separately
- [ ] **Name/company/email consolidation:** Apply identity column pattern to Leads, Contacts, Clients tables
- [ ] **Modal dropdowns:** Replace native `<select>` with reusable dropdown component in modals
- [ ] **Analytics components:** Replace analytics-only markup with shared components (cards, buttons, KPI cards)

**Files:** Various portal and admin CSS/TS files

### 4.2 Badge Redesign

**Audit finding:** Badges are used for status, counts, and scoring. Need unified visual system.

**Design principles:**

- Single visual style (solid background + contrast text OR outline + text)
- Color is not the only differentiator (add icon or pattern if needed for WCAG 1.4.1)
- Consistent sizing and shape across all uses

**Tasks:**

- [ ] Review and finalize badge design (solid vs outline)
- [ ] Update `src/styles/shared/portal-badges.css` with unified styles
- [ ] Ensure color contrast meets WCAG AA (4.5:1)
- [ ] Add icon or pattern to color-only badges if needed
- [ ] Apply to: status badges, count/notification badges, score badges (hot/warm/cold)

**Files:** `src/styles/shared/portal-badges.css`, `src/styles/admin/leads-pipeline.css`

### 4.3 Funnel Stage Styling (Won/Success)

**Audit finding:** Lead funnel "Won" stage looks off (per user feedback).

**Tasks:**

- [ ] Review `.funnel-stage-success` in `src/styles/admin/analytics.css` and `leads-pipeline.css`
- [ ] Align with design tokens (colors, spacing, shadows)
- [ ] Ensure contrast and visual weight match other funnel stages
- [ ] Test with real data

**Files:** `src/styles/admin/analytics.css`, `src/styles/admin/leads-pipeline.css`

### 4.4 Tabs Responsive Behavior

**Audit finding:** Project and client detail tabs need overflow/scroll on small viewports.

**Tasks:**

- [ ] Add horizontal scroll to `.detail-tabs` / tab strips on narrow viewports
- [ ] Add scroll fade indicators (optional)
- [ ] Or: wrap tabs to multiple rows
- [ ] Test on 320px viewport

**Files:** `src/styles/shared/portal-tabs.css`, `src/styles/admin/project-detail.css`, `src/styles/admin/client-detail.css`

---

## Phase 5: Verification & Documentation (P1 - High)

**Rationale:** All changes must be verified and documented to prevent regression.

**Duration:** 1 day
**Dependencies:** Phases 0-4

### 5.1 Verification Checklist

**Tasks:**

- [ ] Run through all verification items in `current_work.md` → VERIFICATION CHECKLIST
- [ ] Test all changed pages with keyboard navigation
- [ ] Test all changed pages with screen reader (VoiceOver)
- [ ] Run Lighthouse/axe on changed pages; compare to Phase 0 baseline
- [ ] Verify no visual regressions (manual or screenshot diff)

### 5.2 Documentation Updates

**Tasks:**

- [ ] Update `UX_GUIDELINES.md` with:
  - Heading hierarchy pattern (H1 per page, H2/H3 for sections)
  - Panel button placement guideline
  - Sidebar order rationale
  - Empty state component usage
- [ ] Update `CSS_ARCHITECTURE.md` with:
  - New empty-state component
  - Any new shared classes
- [ ] Archive completed items from `current_work.md` to `ARCHIVED_WORK_2026-02.md`

**Files:** `docs/design/UX_GUIDELINES.md`, `docs/design/CSS_ARCHITECTURE.md`, `docs/current_work.md`, `docs/archive/ARCHIVED_WORK_2026-02.md`

---

## Implementation Schedule

|Phase|Duration|Effort|Blocked By|
|-------|----------|--------|------------|
|Phase 0 (A11y Foundation)|1-2 days|1 dev|—|
|Phase 1 (IA & Hierarchy)|2-3 days|1 dev|Phase 0.2|
|Phase 2 (Consistency)|2-3 days|1 dev|Phase 1|
|Phase 3 (Component Redesign)|3-4 days|1-2 devs|Phase 2|
|Phase 4 (Polish)|2 days|1 dev|Phase 3|
|Phase 5 (Verification)|1 day|1 dev|Phases 0-4|

**Total:** 11-15 days (with some parallelization possible in Phases 3-4)

---

## Quick Wins (Can Start Immediately)

These items have no dependencies and can be done in parallel with early phases:

1. **Add skip links** to `client/intake.html` and `client/set-password.html` (30 min)
2. **Update breadcrumbs** on client portal tab switch (1 hr)
3. **Modal header flexbox** for icon + title alignment (1 hr)
4. **Message input disabled state** - remove bg change (15 min)
5. **Run Lighthouse** on all pages and document baseline (2 hrs)

---

## Decision Points (Need Input)

Before implementation, get stakeholder/user input on:

1. **Sidebar order:** What is the preferred order for admin and portal sidebars?
2. **Badge design:** Solid background or outline style?
3. **Messages split-view:** Confirm this is the desired pattern; any mobile constraints?
4. **Account Actions:** Header icon buttons vs. dedicated card - which do users prefer?
5. **Table columns:** Confirm identity column consolidation (name + email in one cell)

---

## Risk Assessment

|Risk|Mitigation|
|------|------------|
|Heading changes break existing styles|Use same classes; only change semantic element|
|Sidebar reorder confuses existing users|Consider user notification or gentle transition|
|Split-view adds complexity|Start with static layout; add resize later|
|Badge redesign conflicts with existing status colors|Audit all badge uses first; create migration plan|

---

## Success Metrics

|Metric|Target|Measurement|
|--------|--------|-------------|
|Lighthouse Accessibility score|95+|Run on all pages|
|Heading skip violations|0|axe-core audit|
|Modal title inconsistencies|0|Manual audit|
|Empty state variations|1 shared component|Code audit|
|User-reported confusion|Decreased|Feedback tracking|

---

## Related Documents

- [current_work.md](../current_work.md) — Active work tracking
- [UX_GUIDELINES.md](./UX_GUIDELINES.md) — UX standards
- [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) — Design system
- [PORTAL_CSS_DESIGN.md](./PORTAL_CSS_DESIGN.md) — Portal-specific CSS
