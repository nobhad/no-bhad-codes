# Portal Unification Deep Dive Plan

**Status:** Planning
**Last Updated:** 2026-03-03

## Goal

Make the client portal architecturally identical to admin:

- **EJS renders `.tab-content` divs** for every client tab (not a single swappable container)
- **ALL views are React** (zero vanilla JS views)
- **Tab switching via CSS `.active` class toggle** (not innerHTML replacement)
- **Same shell, same variables, same spacing** — only the content area changes
- **Settings subtabs already work via EJS** — that pattern extends to any future subtab groups

---

## Current State vs Target State

| Aspect | Current (Client) | Target (Match Admin) |
|--------|------------------|----------------------|
| Tab containers | ONE `#portal-view-content` | Multiple `.tab-content` divs via EJS |
| View rendering | Vanilla JS `innerHTML` + React hybrid | 100% React, lazy-mounted |
| Tab switching | Clear container, re-render HTML, mount React | Toggle `.tab-content.active` CSS class |
| `portal-views.ts` | 13 vanilla HTML renderers | **DELETED** |
| Tab IDs to EJS | `tabIds: []` | `tabIds: CLIENT_TAB_IDS` |
| EJS template | `if admin` branch vs `else` branch | Unified — both portals use same tab rendering |

---

## Phase 1: Server + EJS — Tab Container Infrastructure

### 1A. Define CLIENT_TAB_IDS

**File:** `server/config/navigation.ts`

Add alongside existing `ADMIN_TAB_IDS`:

```typescript
export const CLIENT_TAB_IDS = [
  'dashboard',
  'projects',
  'messages',
  'files',
  'invoices',
  'requests',
  'questionnaires',
  'documents',
  'approvals',
  'review',
  'help',
  'settings',
  'new-project',
  'onboarding',
];
```

### 1B. Pass CLIENT_TAB_IDS to template

**File:** `server/routes/portal.ts`

Change line 91 from `tabIds: []` to:

```typescript
import { getPortalConfig, ADMIN_TAB_IDS, CLIENT_TAB_IDS, ICONS } from '../config/navigation.js';

// In the client render block:
tabIds: CLIENT_TAB_IDS,
```

### 1C. Remove the admin-only conditional in EJS

**File:** `server/views/layouts/portal.ejs`

Change lines 55-67 from:

```ejs
<% if (portalType === 'admin' && tabIds && tabIds.length > 0) { %>
  <% tabIds.forEach((tabId, index) => { %>
    <div class="tab-content<%= index === 0 ? ' active' : '' %>" id="tab-<%= tabId %>">
    </div>
  <% }) %>
<% } else { %>
  <div class="portal-view-content" id="portal-view-content">
    <div class="loading-row">Loading...</div>
  </div>
<% } %>
```

To:

```ejs
<% if (tabIds && tabIds.length > 0) { %>
  <% tabIds.forEach((tabId, index) => { %>
    <div class="tab-content<%= index === 0 ? ' active' : '' %>" id="tab-<%= tabId %>">
    </div>
  <% }) %>
<% } %>
```

Both portals now render `.tab-content` divs identically.

### 1D. CSS already handles `.tab-content.active`

**File:** `src/styles/shared/portal-layout.css` (existing, no changes needed)

```css
.portal .tab-content.active {
  display: block;
  margin-top: var(--portal-nav-gap);
}
```

All `.tab-content` divs are `display: none` by default. Only the `.active` one shows. This is the same for both portals.

---

## Phase 2: Rewrite Client Tab Switching

### 2A. Rewrite `switchTab()` in portal-navigation.ts

**File:** `src/features/client/modules/portal-navigation.ts`

Replace the current `loadViewContent()` / `renderView()` pattern with admin's approach:

```typescript
function switchTabContent(activeTab: string): void {
  // 1. Remove .active from ALL .tab-content divs
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.remove('active');
  });

  // 2. Add .active to the target tab container
  const tabContainer = document.getElementById(`tab-${activeTab}`);
  tabContainer?.classList.add('active');

  // 3. Mount React component (lazy — only on first visit)
  if (tabContainer && hasReactModule(activeTab)) {
    mountReactModule(activeTab, tabContainer, moduleContext);
  }
}
```

### 2B. Remove ALL references to `portal-views.ts`

**File:** `src/features/client/modules/portal-navigation.ts`

- Remove `import { renderView, clearView } from './portal-views'`
- Remove all calls to `renderView()` and `clearView()`
- Remove the vanilla JS fallback path in `loadViewContent()`

### 2C. Remove ALL references to `#portal-view-content`

Search entire `src/features/client/` for `portal-view-content` and replace with `tab-{tabId}` pattern.

### 2D. Update ReactModuleLoader.ts

**File:** `src/features/client/ReactModuleLoader.ts`

The module loader already works with arbitrary containers. The only change:

- Mount into `document.getElementById('tab-{viewId}')` instead of `#portal-view-content`
- Keep the unmount-before-mount pattern (or switch to mount-once-stay-mounted if preferred)

---

## Phase 3: Convert All Vanilla Views to React

Every vanilla JS view in `portal-views.ts` must become a React component. This is the bulk of the work.

### 3A. PortalDashboard (NEW React component)

**Current:** `renderDashboardView()` — vanilla HTML with quick stats, project progress, milestones, pending approvals, recent activity.

**New file:** `src/react/features/portal/dashboard/PortalDashboard.tsx`

**New file:** `src/react/features/portal/dashboard/mount.ts`

**Structure:**

```tsx
export function PortalDashboard({ getAuthToken, showNotification, onNavigate }) {
  // Fetch: active projects count, pending invoices, unread messages
  // Fetch: project progress + milestones
  // Fetch: pending approvals
  // Fetch: recent activity

  return (
    <PortalViewLayout>
      <StatsRow>
        <StatCard label="Active Projects" value={stats.activeProjects} onClick={() => onNavigate('projects')} />
        <StatCard label="Pending Invoices" value={stats.pendingInvoices} onClick={() => onNavigate('invoices')} />
        <StatCard label="Unread Messages" value={stats.unreadMessages} onClick={() => onNavigate('messages')} />
      </StatsRow>

      {/* Project Progress */}
      <ProgressSection progress={progress} milestones={milestones} />

      {/* Pending Approvals */}
      {approvals.length > 0 && <ApprovalsPreview approvals={approvals} onNavigate={onNavigate} />}

      {/* Recent Activity */}
      <ActivityFeed activities={activities} />
    </PortalViewLayout>
  );
}
```

### 3B. PortalHelp (NEW React component)

**Current:** `renderHelpView()` — vanilla HTML with search, categories accordion, featured articles, article detail view.

**New file:** `src/react/features/portal/help/PortalHelp.tsx`

**New file:** `src/react/features/portal/help/mount.ts`

**Structure:**

```tsx
export function PortalHelp({ getAuthToken, onNavigate }) {
  // State: search query, categories, articles, selected article
  // Fetch: categories, featured articles
  // Search: debounced article search

  return (
    <PortalViewLayout>
      {/* Search */}
      <HelpSearch query={query} onSearch={setQuery} suggestions={suggestions} />

      {/* Main Grid */}
      <div className="help-main-grid">
        {/* Categories Accordion */}
        <CategoriesAccordion categories={categories} onSelectArticle={selectArticle} />

        {/* Right: Featured OR Article Detail OR Search Results */}
        {selectedArticle ? (
          <ArticleDetail article={selectedArticle} onBack={clearArticle} />
        ) : searchResults ? (
          <SearchResults results={searchResults} onSelect={selectArticle} onClear={clearSearch} />
        ) : (
          <FeaturedArticles articles={featured} onSelect={selectArticle} />
        )}
      </div>

      {/* Contact Section */}
      <HelpContactSection onNavigate={onNavigate} />
    </PortalViewLayout>
  );
}
```

### 3C. PortalPreview (NEW React component)

**Current:** `renderPreviewView()` — vanilla HTML with toolbar and iframe.

**New file:** `src/react/features/portal/preview/PortalPreview.tsx`

**New file:** `src/react/features/portal/preview/mount.ts`

**Structure:**

```tsx
export function PortalPreview({ getAuthToken }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch project preview URL from API

  return (
    <PortalViewLayout className="preview-container">
      <PreviewToolbar
        url={previewUrl}
        onRefresh={() => iframeRef.current?.contentWindow?.location.reload()}
        onOpenNewTab={() => window.open(previewUrl, '_blank')}
      />
      <div className="preview-frame-wrapper">
        <iframe ref={iframeRef} src={previewUrl} title="Project Preview" className="preview-frame" />
      </div>
    </PortalViewLayout>
  );
}
```

### 3D. PortalNewProject — Already exists as OnboardingWizard

**Current:** `renderNewProjectView()` — empty container, JS terminal intake renders into it.

This view already has a React component: `OnboardingWizard.tsx`. The vanilla view just renders an empty container that the onboarding module mounts into. Replace with direct React mount.

**File:** `src/react/features/portal/onboarding/mount.ts` — already exists.

Register `new-project` tab to use the existing `onboarding` React module.

### 3E. Register all new modules in ReactModuleLoader

**File:** `src/features/client/ReactModuleLoader.ts`

Add to `REACT_MODULES`:

```typescript
dashboard: {
  import: () => import('../../react/features/portal/dashboard/mount'),
  mountFn: 'mountPortalDashboard',
  unmountFn: 'unmountPortalDashboard',
},
help: {
  import: () => import('../../react/features/portal/help/mount'),
  mountFn: 'mountPortalHelp',
  unmountFn: 'unmountPortalHelp',
},
review: {
  import: () => import('../../react/features/portal/preview/mount'),
  mountFn: 'mountPortalPreview',
  unmountFn: 'unmountPortalPreview',
},
'new-project': {
  import: () => import('../../react/features/portal/onboarding/mount'),
  mountFn: 'mountOnboardingWizard',
  unmountFn: 'unmountOnboardingWizard',
},
```

### 3F. Update TAB_TO_REACT_MODULE mapping

**File:** `src/features/client/modules/portal-navigation.ts`

Every client tab must have a React module mapping:

```typescript
const TAB_TO_REACT_MODULE: Record<string, string> = {
  dashboard: 'dashboard',
  projects: 'projects',
  files: 'files',
  messages: 'messages',
  invoices: 'invoices',
  approvals: 'approvals',
  settings: 'settings',
  questionnaires: 'questionnaires',
  documents: 'document-requests',
  requests: 'ad-hoc-requests',
  onboarding: 'onboarding',
  help: 'help',
  review: 'review',
  'new-project': 'new-project',
};
```

---

## Phase 4: Delete Vanilla JS Views

### 4A. Delete portal-views.ts

**File:** `src/features/client/modules/portal-views.ts` — **DELETE ENTIRE FILE**

All 13 vanilla renderers (`renderDashboardView`, `renderHelpView`, `renderPreviewView`, etc.) are replaced by React components.

### 4B. Remove all imports of portal-views

Search `src/features/client/` for any imports from `./portal-views` or `./modules/portal-views` and remove them.

### 4C. Remove vanilla event handlers

The vanilla views had event handlers set up in `client-portal.ts` after rendering (e.g., `loadDashboardData()`, `setupFileUpload()`, `setupHelpSearch()`). These must be removed since React components handle their own events.

Search `client-portal.ts` for:

- `loadDashboardData` / `updateDashboardStats`
- `loadFiles` / `setupFileUpload`
- `setupHelpSearch` / `loadHelpCategories`
- Any DOM query selectors targeting vanilla view elements (`getElementById` for vanilla-specific IDs)

Remove all of these. React components manage their own lifecycle.

---

## Phase 5: Fix Spacing Consistency

### 5A. Subtab gap only when subtabs are visible

**File:** `src/styles/shared/portal-layout.css`

**Current (line 328-335):**

```css
.portal .portal-header-subtabs .header-subtabs {
  margin-top: var(--portal-nav-gap, 16px); /* Always takes space */
}
```

**Change to:**

```css
.portal .portal-header-subtabs .header-subtabs {
  margin-top: 0; /* No gap when empty */
}
```

Move the gap to the visible subtab group show rules (lines 345-367):

```css
/* Visible subtab groups get the gap */
[data-page="..."] ... .header-subtab-group[data-for-tab="..."] {
  display: flex;
  margin-top: var(--portal-nav-gap); /* Gap only when subtabs visible */
  /* ... rest of styles ... */
}
```

### 5B. Content area always has consistent spacing

`.tab-content.active` already has `margin-top: var(--portal-nav-gap)`. This is now the **only** gap for solo tabs. Subtab tabs get the subtab row margin + content margin (correct, matches admin).

### 5C. Remove old client-portal layout.css overrides

**File:** `src/styles/client-portal/layout.css`

Remove the `#portal-view-content` rules (lines 273-279) since that container no longer exists:

```css
/* DELETE THESE - portal-view-content no longer exists */
.portal .portal-view-content,
.portal #portal-view-content {
  display: flex;
  flex-direction: column;
  margin-top: var(--portal-nav-gap);
}
```

The `.tab-content.active` rule in `portal-layout.css` handles everything now.

---

## Phase 6: Fix Messages View CSS

### 6A. Add missing thread list CSS

**File:** `src/styles/shared/portal-messages.css`

Add after the "MESSAGE THREAD REACT COMPONENT CLASSES" comment (line 487):

```css
/* =====================================================
   PORTAL MESSAGE THREAD LIST - PortalMessagesView.tsx
   ===================================================== */

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.message-thread-list {
  display: flex;
  flex-direction: column;
}

.message-thread-item {
  text-align: left;
  width: 100%;
}

.message-thread-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
}

.message-thread-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.message-timestamp {
  flex-shrink: 0;
}

.message-thread-preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
```

---

## Phase 7: Shared Variable Audit

### 7A. Zero hardcoded values in portal React components

Run audit:

```bash
# Hardcoded pixels in portal TSX
grep -rn "[0-9]px" src/react/features/portal/ --include="*.tsx"

# Hardcoded colors
grep -rn "#[0-9a-fA-F]" src/react/features/portal/ --include="*.tsx"
grep -rn "rgb\|rgba\|hsl" src/react/features/portal/ --include="*.tsx"
```

Replace any found instances with CSS variables from `portal-theme.css` and `spacing.css`.

### 7B. Shared variables reference

All portal CSS must use these variables (never raw values):

| Category | Variables |
|----------|-----------|
| Spacing | `--space-*`, `--portal-nav-gap`, `--portal-section-gap` |
| Colors | `--portal-bg-*`, `--portal-text-*`, `--portal-border-*`, `--color-primary`, `--status-*` |
| Typography | `--font-size-*`, `--font-family-*`, `--font-weight-*` |
| Borders | `--portal-border`, `--border-width`, `--portal-border-color` |
| Layout | `--table-cell-padding-x`, `--table-cell-padding-y` |

---

## Phase 8: Documentation

### 8A. Update CSS_ARCHITECTURE.md

- Document shared utility classes (`tw-section`, `tw-panel`, `tw-list-item`)
- Document `portal-card-*` classes
- Document `PortalViewLayout`, `StatCard`, `StatsRow` APIs
- Document the EJS `.tab-content` architecture

### 8B. Update current_work.md

Track completion of each phase.

---

## Implementation Order (Priority)

1. **Phase 1** — Server + EJS tab containers (unblocks everything)
2. **Phase 2** — Rewrite tab switching to CSS toggle
3. **Phase 3A** — PortalDashboard React component (most complex vanilla view)
4. **Phase 3B** — PortalHelp React component (second most complex)
5. **Phase 3C** — PortalPreview React component (simple)
6. **Phase 3D** — Wire new-project to onboarding module
7. **Phase 4** — Delete portal-views.ts and all vanilla references
8. **Phase 5** — Fix spacing
9. **Phase 6** — Fix messages CSS
10. **Phase 7** — Variable audit
11. **Phase 8** — Documentation

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/react/features/portal/dashboard/PortalDashboard.tsx` | Dashboard React component |
| `src/react/features/portal/dashboard/mount.ts` | Mount/unmount functions |
| `src/react/features/portal/help/PortalHelp.tsx` | Help/knowledge base React component |
| `src/react/features/portal/help/mount.ts` | Mount/unmount functions |
| `src/react/features/portal/preview/PortalPreview.tsx` | Project preview React component |
| `src/react/features/portal/preview/mount.ts` | Mount/unmount functions |

## Files to Delete

| File | Reason |
|------|--------|
| `src/features/client/modules/portal-views.ts` | All vanilla views replaced by React |

## Files to Modify

| File | Changes |
|------|---------|
| `server/config/navigation.ts` | Add `CLIENT_TAB_IDS` |
| `server/routes/portal.ts` | Pass `CLIENT_TAB_IDS` to template |
| `server/views/layouts/portal.ejs` | Remove admin-only conditional |
| `src/features/client/modules/portal-navigation.ts` | Rewrite to use `.tab-content.active` toggling |
| `src/features/client/ReactModuleLoader.ts` | Register dashboard, help, preview, new-project modules |
| `src/features/client/client-portal.ts` | Remove vanilla JS event handlers |
| `src/styles/shared/portal-layout.css` | Fix subtab gap placement |
| `src/styles/client-portal/layout.css` | Remove `#portal-view-content` rules |
| `src/styles/shared/portal-messages.css` | Add thread list CSS |

---

## Verification Checklist

After ALL phases complete:

- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npm run build` — successful build
- [ ] No references to `portal-views.ts` remain
- [ ] No references to `#portal-view-content` remain
- [ ] No vanilla `innerHTML` rendering for client views
- [ ] Every client tab has a `.tab-content` div in the DOM
- [ ] Tab switching toggles `.active` class (no container clearing)
- [ ] Settings subtabs still work via EJS header
- [ ] All tabs have identical top spacing (solo and subtab tabs)
- [ ] Messages thread list displays correctly
- [ ] Dashboard shows stats, progress, milestones, approvals, activity
- [ ] Help shows search, categories, articles
- [ ] Preview shows iframe with toolbar
- [ ] No hardcoded colors or pixel values
- [ ] All CSS uses shared portal variables
