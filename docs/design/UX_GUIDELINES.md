# UX Guidelines

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Typography Standards](#typography-standards)
4. [Icon Usage](#icon-usage)
5. [Visual Elements](#visual-elements)
6. [Button Standards](#button-standards)
7. [Form Standards](#form-standards)
8. [Spacing Standards](#spacing-standards)
9. [Component Usage](#component-usage)
10. [Layout Patterns](#layout-patterns)
11. [Status Colors & Badges](#status-colors--badges)
12. [Feedback & States](#feedback--states)
13. [Accessibility](#accessibility)
14. [User Preferences](#user-preferences)
15. [Feature Documentation](#feature-documentation)

---

## Overview

This document defines the user experience standards for the project. All UI implementations must follow these guidelines to ensure consistency and usability.

**Last Updated:** February 9, 2026

**Recent Updates:**

- Added comprehensive [Layout Patterns](#layout-patterns) section documenting standardized page structure, table hierarchy, action button order, tag placement, view toggles, modal structure, and tab patterns (based on February 2026 Layout Consistency Audit)

---

## Design Principles

Following Dieter Rams' Ten Principles of Good Design:

### 1. Good design is innovative

Developing new opportunities for original designs in tandem with improving technology.

### 2. Good design makes a product useful

Satisfies functional, psychological, and aesthetic criteria.

### 3. Good design is aesthetic

Integral to product usefulness; well-executed objects can be beautiful.

### 4. Good design makes a product understandable

Clarifies structure and expresses function intuitively.

### 5. Good design is unobtrusive

Neutral and restrained, leaving room for user self-expression.

### 6. Good design is honest

Does not manipulate consumers with false promises.

### 7. Good design is long-lasting

Avoids being fashionable; lasts many years.

### 8. Good design is thorough down to the last detail

Shows respect towards the consumer.

### 9. Good design is environmentally friendly

Conserves resources and minimizes pollution.

### 10. Good design is as little design as possible

Less but better; simple as possible but not simpler.

---

## Typography Standards

### Font Families

|Variable|Font|Usage|
|----------|------|-------|
|`--font--acme`|Acme|Headers, card titles, uppercase labels|
|`--font-body`|System fonts|Body text, paragraphs, form inputs|

### Font Sizes (Fluid Typography)

|Token|Value|Usage|
|-------|-------|-------|
|`--font-size-xs`|`clamp(0.75rem, 2vw, 0.875rem)`|Fine print, captions|
|`--font-size-sm`|`clamp(0.875rem, 2.5vw, 1rem)`|Secondary text, labels|
|`--font-size-base`|`clamp(1rem, 3vw, 1.125rem)`|Body text|
|`--font-size-lg`|`clamp(1.125rem, 3.5vw, 1.25rem)`|Emphasis text|
|`--font-size-xl`|`clamp(1.25rem, 4vw, 1.5rem)`|Section headers|
|`--font-size-2xl`|`clamp(1.5rem, 5vw, 2rem)`|Page headers|
|`--font-size-3xl`|`clamp(2rem, 6vw, 3rem)`|Hero text|

### Font Weights

|Weight|Usage|
|--------|-------|
|400|Body text|
|600|Emphasis, buttons, labels|
|700|Headers, stat numbers|

### Text Transform

- **UPPERCASE**: Card headers, buttons, status badges, navigation items
- **Sentence case**: Body text, descriptions, form labels

---

## Icon Usage

### Critical Rule

**NO EMOJIS IN DESIGN - USE LUCIDE ICONS**
All icons must use the Lucide icon library. Never use emojis as visual elements in the UI.

### Icon Sizing

|Size|Pixels|Usage|
|------|--------|-------|
|Small|16px|Inline with text, form field icons|
|Medium|20px|Buttons, navigation items|
|Large|24px|Section headers, feature cards|
|XL|32px|Hero sections, empty states|

### Icon + Text Alignment

- Icons should be vertically centered with adjacent text
- Use `gap: 0.5rem` between icon and text
- Icon color should match or complement text color

### Common Icon Mappings

|Purpose|Lucide Icon|
|---------|-------------|
|Close/Cancel|`X`|
|Edit|`Pencil`|
|Delete|`Trash2`|
|Add/Create|`Plus`|
|Settings|`Settings`|
|User/Profile|`User`|
|Search|`Search`|
|Menu|`Menu`|
|Check/Success|`Check`|
|Warning|`AlertTriangle`|
|Error|`AlertCircle`|
|Info|`Info`|
|Download|`Download`|
|Upload|`Upload`|
|Send|`Send`|
|Eye (show)|`Eye`|
|Eye (hide)|`EyeOff`|

### Enable/Disable Toggle Pattern

All enable/disable toggles use the eye/eye-off icon pattern:

- **Eye icon** = Active/Enabled (click to disable)
- **Eye-off icon** = Inactive/Disabled (click to enable)
- Use `.icon-btn` class with proper `title` and `aria-label`
- Do NOT use text buttons like "Pause/Resume"

**Locations using this pattern:**

- Leads: Scoring rules toggle
- Workflows: Trigger toggle
- Analytics: Schedule toggle, Alert toggle
- Invoices: Recurring invoice toggle

### View Toggle Pattern

All view toggles must include SVG icons alongside text labels:

| View Type | Icon | Description |
|-----------|------|-------------|
| Board/Kanban | Columns layout | 3 vertical rectangles of varying heights |
| List | Horizontal lines | 3 lines with bullet points |
| Table | Grid | Rectangle with dividing lines |
| Grid | 4 squares | 2x2 grid layout |
| Proposals | Document | File with lines |
| Templates | Layout | Rectangle with dividing sections |

**Implementation:** Use the `createViewToggle` component with `iconSvg` property.

### Section Toggle Pattern

Section toggles switch between different content sections on a page (not just views of the same data). These appear in the unified portal header next to the page title.

**Current Implementations:**

| Page | Toggle Options | Icons | Purpose |
|------|----------------|-------|---------|
| Leads | Intake / Contacts | Document+ / Users | Switch between intake submissions and contact form submissions |
| Knowledge Base | Categories / Articles | Grid / Document | Switch between categories table and articles table |

**Standard Pattern:**

```typescript
// State variable
let currentSection: 'section1' | 'section2' = 'section1';

// Icon constants
const SECTION1_ICON = '<svg>...</svg>';
const SECTION2_ICON = '<svg>...</svg>';

// Setup function
function setupSectionToggle(): void {
  const mountPoint = document.getElementById('section-toggle-mount');
  if (!mountPoint || mountPoint.dataset.initialized) return;
  mountPoint.dataset.initialized = 'true';

  function applySection(section: 'section1' | 'section2'): void {
    const card1 = document.getElementById('section1-card');
    const card2 = document.getElementById('section2-card');

    if (section === 'section1') {
      if (card1) card1.style.display = 'block';
      if (card2) card2.style.display = 'none';
    } else {
      if (card1) card1.style.display = 'none';
      if (card2) card2.style.display = 'block';
    }
  }

  const toggleEl = createViewToggle({
    id: 'section-toggle',
    options: [
      { value: 'section1', label: 'Section 1', iconSvg: SECTION1_ICON },
      { value: 'section2', label: 'Section 2', iconSvg: SECTION2_ICON }
    ],
    value: currentSection,
    onChange: (value) => {
      currentSection = value as 'section1' | 'section2';
      applySection(currentSection);
    }
  });

  mountPoint.appendChild(toggleEl);
  applySection(currentSection);
}
```

**HTML Structure:**

```html
<!-- Mount point in unified header -->
<div class="header-controls header-subtab-group" data-for-tab="tab-name">
  <div id="section-toggle-mount"></div>
</div>

<!-- Target cards with IDs -->
<div id="section1-card">...</div>
<div id="section2-card">...</div>
```

**CSS (Conditional Visibility):**

```css
[data-page="admin"]:has(#tab-name.active) .header-controls[data-for-tab="tab-name"] {
  display: flex;
}
```

**Implementation Checklist:**

- [ ] Add mount point div in unified header with `data-for-tab` attribute
- [ ] Add IDs to target cards/sections
- [ ] Add CSS `:has()` selector for conditional visibility
- [ ] Create setup function with state, icons, and toggle logic
- [ ] Call setup function in page load/initialization
- [ ] Use Lucide icons that represent the content type

---

## Visual Elements

### Borders

- **Standard border**: `4px solid #000000`
- **Light border**: `2px solid var(--color-dark)`
- **Focus border**: `2px solid var(--color-primary)`
- **No border-radius** for cards (brutalist aesthetic)
- **Small radius**: `4px` for inputs and buttons

### Shadows

Use multi-layer shadows for depth:

```css
/* Standard card shadow */
box-shadow:
  20px 6px 30px rgba(0, 0, 0, 0.6),
  8px 8px 16px rgba(0, 0, 0, 0.8),
  3px 3px 6px rgba(0, 0, 0, 0.9);
```

### Color Usage

**Theme-Aware Primary Colors:**

- **Light Mode Primary**: `var(--color-brand-primary)` (#dc2626 - Crimson red)
- **Dark Mode Primary**: `var(--color-brand-primary)` (#00ff41 - Matrix green)
- **Text**: `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-tertiary)`
- **Backgrounds**: `var(--color-bg-primary)`, `var(--color-bg-secondary)`, `var(--color-bg-tertiary)`
- **Interactive**: `var(--color-interactive-primary)` with hover and active variants
- **Never hardcode colors** - always use CSS variables

---

## Button Standards

### Button Hierarchy

|Type|Class|Usage|
|------|-------|-------|
|Primary|`.btn-primary`, `.cp-btn-primary`|Main actions (Submit, Save, Confirm)|
|Secondary|`.btn-secondary`|Secondary actions (Cancel, Back)|
|Danger|`.btn-danger`|Destructive actions (Delete)|
|Outline|`.btn-outline`|Tertiary actions|

### Button Sizing

|Size|Class|Padding|
|------|-------|---------|
|Default|`.btn`|`0.75rem 1.5rem`|
|Small|`.btn-sm`|`0.5rem 1rem`|

### Button States

- **Default**: Neutral background with dark border
- **Hover**: Primary color background
- **Active/Pressed**: Slightly darker primary
- **Disabled**: Reduced opacity, no pointer events

### Button Text

- Always UPPERCASE
- Font weight: 600
- Font size: 0.9rem (default), 0.8rem (small)

---

## Form Standards

### Input Fields

- **Width**: 100% of container
- **Padding**: `0.75rem`
- **Border**: `2px solid var(--color-dark)`
- **Border radius**: `4px`
- **Focus state**: Primary color border with subtle shadow

### Password Fields

**All password fields MUST have a view toggle button.**

Implementation pattern:

```html
<div class="cp-password-wrapper">
  <input type="password" class="cp-input" />
  <button type="button" class="cp-password-toggle">
    <!-- Lucide Eye/EyeOff icon -->
  </button>
</div>
```

### Labels

- Position: Above input field
- Font size: `--font-size-sm`
- Font weight: 600
- Text transform: None (sentence case)

### Validation States

|State|Border Color|Message Color|
|-------|--------------|---------------|
|Default|`var(--color-dark)`|-|
|Focus|`var(--color-primary)`|-|
|Error|`var(--color-error-500)`|`var(--color-error-500)`|
|Success|`var(--color-success-500)`|`var(--color-success-500)`|

### Error Messages

- Position: Below input field
- Font size: `--font-size-sm`
- Color: Error color
- Include relevant Lucide icon

---

## Spacing Standards

### Spacing Scale

|Token|Value|Usage|
|-------|-------|-------|
|`--space-xs`|`clamp(0.25rem, 1vw, 0.5rem)`|Tight spacing, inline elements|
|`--space-sm`|`clamp(0.5rem, 2vw, 1rem)`|Form gaps, button groups|
|`--space-md`|`clamp(1rem, 3vw, 1.5rem)`|Card padding, section gaps|
|`--space-lg`|`clamp(1.5rem, 4vw, 2rem)`|Section padding|
|`--space-xl`|`clamp(2rem, 5vw, 3rem)`|Page sections|
|`--space-2xl`|`clamp(3rem, 6vw, 4rem)`|Major sections|

### Component Spacing

|Component|Internal Padding|External Margin|
|-----------|------------------|-----------------|
|Card|`1.5rem`|`0 0 1.5rem 0`|
|Button|`0.75rem 1.5rem`|Context-dependent|
|Input|`0.75rem`|`0 0 1rem 0`|
|Section|`var(--section-padding)`|-|

---

## Feedback & States

### Loading States

- Use spinner animation for async operations
- Show skeleton loaders for content areas
- Disable interactive elements during loading

### Empty States

- Center content vertically and horizontally
- Use large icon (32px+)
- Provide clear message and action button
- Keep text concise

### Success Feedback

- Brief toast notification or inline message
- Green color indicator
- Auto-dismiss after 3-5 seconds

### Error Feedback

- Persistent until user dismisses or fixes
- Red color indicator
- Clear explanation of what went wrong
- Suggested action if applicable

---

## Accessibility

### Color Contrast

- Text on background: minimum 4.5:1 ratio
- Large text (18px+): minimum 3:1 ratio
- Interactive elements: clearly distinguishable

### Focus States

- All interactive elements must have visible focus
- Focus ring: `0 0 0 3px rgba(var(--color-primary-rgb), 0.2)`
- Never remove focus outlines without replacement

### Keyboard Navigation

- All functionality accessible via keyboard
- Logical tab order
- Skip links for main content

### Screen Readers

- Meaningful alt text for images
- ARIA labels for icon-only buttons
- Proper heading hierarchy

### Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Usage

### Cards & Containers

| Component | Class | Usage | See Feature |
|-----------|-------|-------|-------------|
| Portal Card | `.portal-card` | Content containers in portal | [Client Portal](../features/CLIENT_PORTAL.md) |
| Portal Shadow | `.portal-shadow` | Card shadow utility | [Client Portal](../features/CLIENT_PORTAL.md) |
| Stat Card | `.stat-card`, `.stat-card-clickable` | KPI/metric display | [Admin Dashboard](../features/ADMIN_DASHBOARD.md) |
| Admin Table Card | `.admin-table-card` | Table wrapper with header | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Settings Section | `.settings-section` | Settings form container | [Settings](../features/SETTINGS.md) |

### Forms & Inputs

| Component | Class | Usage | See Feature |
|-----------|-------|-------|-------------|
| Form Input | `.form-input`, `.portal-input` | Text inputs | [Settings](../features/SETTINGS.md) |
| Form Select | `.form-select` | Dropdown selects | [Forms](./CSS_ARCHITECTURE.md) |
| Form Group | `.form-group` | Field + label wrapper | [Settings](../features/SETTINGS.md) |
| Password Wrapper | `.cp-password-wrapper` | Password with toggle | [Settings](../features/SETTINGS.md) |
| Password Toggle | `.cp-password-toggle` | Eye icon toggle | [Settings](../features/SETTINGS.md) |
| Upload Dropzone | `.upload-dropzone` | Drag-drop file upload | [Files](../features/FILES.md) |

### Tables & Lists

| Component | Class | Usage | See Feature |
|-----------|-------|-------|-------------|
| Admin Table | `.admin-table` | Data tables | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Table Dropdown | `.table-dropdown` | Inline status selector | [Leads](../features/LEADS.md) |
| File Item | `.file-item` | File list row | [Files](../features/FILES.md) |
| Invoice Item | `.invoice-item` | Invoice list row | [Invoices](../features/INVOICES.md) |

### Navigation & Tabs

| Component | Class | Usage | See Feature |
|-----------|-------|-------|-------------|
| Sidebar Buttons | `.sidebar-buttons .btn` | Main nav items | [Admin Dashboard](../features/ADMIN_DASHBOARD.md) |
| Portal Tabs | `.portal-tabs` | Tab strip | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Portal Subtabs | `.portal-subtabs` | Horizontal button strip | [Workflows](../features/WORKFLOWS.md) |
| Tab Content | `.tab-content.active` | Tab panel visibility | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| View Toggle | `createViewToggle()` | Board/List switcher | [Tasks](../features/TASKS.md) |

### Messaging

| Component | Class | Usage | See Feature |
|-----------|-------|-------|-------------|
| Messages Container | `.messages-container` | Chat wrapper | [Messaging](../features/MESSAGING.md) |
| Messages Thread | `.messages-thread` | Scrollable message list | [Messaging](../features/MESSAGING.md) |
| Message Received | `.message-received` | Left-aligned bubble | [Messaging](../features/MESSAGING.md) |
| Message Sent | `.message-sent` | Right-aligned bubble | [Messaging](../features/MESSAGING.md) |
| Message Avatar | `.message-avatar` | User avatar (40x40) | [Messaging](../features/MESSAGING.md) |

### Modals & Dialogs

| Component | Class | Usage | See Feature |
|-----------|-------|-------|-------------|
| Modal Overlay | `.modal-overlay` | Backdrop | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Modal Content | `.modal-content` | Dialog container | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Modal Header | `.modal-header` | Title + close button | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Modal Body | `.modal-body` | Scrollable content | [CSS Architecture](./CSS_ARCHITECTURE.md) |
| Modal Footer | `.modal-footer` | Action buttons | [CSS Architecture](./CSS_ARCHITECTURE.md) |

---

## Layout Patterns

### Standard Page Structure

All admin pages follow a consistent three-tier hierarchy:

1. **Unified Portal Header** - Breadcrumbs + dynamic page title + optional controls
2. **Tab Content** - Main content area (tables, cards, grids)
3. **No Redundant Titles** - Page titles only appear in the unified header

**Implementation:**

```html
<!-- Unified Portal Header (OUTSIDE tab content) -->
<header class="portal-page-header">
  <!-- Row 1: Sidebar toggle + breadcrumbs -->
  <div class="portal-header-top">
    <button class="header-sidebar-toggle">...</button>
    <nav class="breadcrumb-nav">...</nav>
  </div>
  <!-- Row 2: Dynamic page title + optional controls -->
  <div class="portal-header-title">
    <h1 id="admin-page-title">Page Name</h1>
    <div class="header-subtabs">
      <!-- Analytics/Workflows subtabs OR view toggles -->
    </div>
  </div>
</header>

<!-- Tab Content (no page title div inside) -->
<div class="tab-content active" id="tab-name">
  <!-- Content starts immediately -->
</div>
```

**Rules:**

- ✅ One header for entire admin portal, not per-tab
- ✅ Title updates via JavaScript when switching tabs (`updateAdminPageTitle()`)
- ✅ Never duplicate titles inside tab content
- ✅ Controls (subtabs, view toggles) belong in unified header, not content area

**Pages Using This Pattern:**

- Overview, Analytics, Workflows, Tasks, Leads, Projects, Clients, Invoices, Messages, Document Requests, Knowledge Base, System Status

---

### Admin Table Structure

All data tables use a standardized four-layer hierarchy:

```html
<div class="admin-table-card portal-shadow">
  <!-- Layer 1: Header with title and action buttons -->
  <div class="admin-table-header">
    <h3>Table Title</h3>
    <div class="admin-table-actions">
      <!-- Action buttons here -->
    </div>
  </div>

  <!-- Layer 2: Optional filters (search + filter chips) -->
  <div class="table-filters">
    <div class="table-search"><!-- Search bar --></div>
    <div class="filter-chips"><!-- Active filters --></div>
  </div>

  <!-- Layer 3: Table container with scroll wrapper -->
  <div class="admin-table-container">
    <div class="admin-table-scroll-wrapper">
      <table class="admin-table">
        <!-- Table content -->
      </table>
    </div>
  </div>

  <!-- Layer 4: Optional pagination (OUTSIDE scroll wrapper) -->
  <div class="table-pagination">
    <!-- Pagination controls -->
  </div>
</div>
```

**Rules:**

- ✅ Pagination must be OUTSIDE `.admin-table-scroll-wrapper` and OUTSIDE `.admin-table-container`
- ✅ Pagination must be INSIDE `.admin-table-card`
- ✅ Filters (if used) go between header and container
- ✅ Never nest tables without proper wrapper hierarchy

---

### Action Button Order

**Standard Order (Left to Right):**

1. **Export** → 2. **Refresh** → 3. **Add/Create**

```html
<div class="admin-table-actions">
  <!-- 1. Export button (CSV/Excel) -->
  <button type="button" class="icon-btn" id="*-export">
    <span class="icon-btn-svg"><!-- Download icon --></span>
  </button>

  <!-- 2. Refresh button -->
  <button type="button" class="icon-btn" id="*-refresh">
    <span class="icon-btn-svg"><!-- Refresh icon --></span>
  </button>

  <!-- 3. Add/Create button -->
  <button type="button" class="icon-btn" id="*-add">
    <span class="icon-btn-svg"><!-- Plus icon --></span>
  </button>
</div>
```

**Rules:**

- ✅ Always follow Export → Refresh → Add order
- ✅ Not all tables need all three buttons
- ✅ If only 2 buttons, use Refresh → Add
- ✅ Use icon-only buttons (`.icon-btn`) with proper `title` and `aria-label`
- ❌ Never change the order

**Compliant Tables:**

- Leads, Projects, Clients, Invoices, Contact Submissions, Document Requests, KB Categories, KB Articles, Approval Workflows, Event Triggers

---

### Tag Placement Pattern

**Standard Pattern:** "Header Row" - Tags occupy a dedicated row at bottom of entity header card.

```html
<div class="portal-project-card portal-shadow *d-header-card">
  <!-- Header metadata (title, status, info) -->
  <div class="*d-header-top">
    <div class="*d-header-info">
      <!-- Title, status, actions -->
      <!-- Contact/client info -->
      <!-- Description -->
      <!-- Metadata fields -->
    </div>
  </div>

  <!-- Tags row (AFTER all metadata, BEFORE tabs) -->
  <div id="*d-header-tags" class="*d-header-tags"></div>
</div>

<!-- Entity detail tabs (immediately follows header) -->
<div class="*-detail-tabs portal-tabs">...</div>
```

**Rules:**

- ✅ Tags appear at bottom of header card, before tabs/content
- ✅ Full-width row, not inline with metadata
- ✅ Use reusable `createTagInput()` component from `/src/components/tag-input.ts`
- ✅ Support add, remove, and create tag operations
- ✅ Color-coded tags with contrast-aware text

**Implementation Status:**

- ✅ **Client Detail** - Full implementation with tag management UI
- ⚠️ **Project Detail** - Not yet implemented
- ⚠️ **Lead Detail** - Not yet implemented

**Naming Convention:**

- Client Detail: `cd-header-tags`
- Project Detail: `pd-header-tags` (planned)
- Lead Detail: `ld-header-tags` (planned)

---

### View Toggle Placement

**Standard Pattern:** View toggles and section toggles belong in the unified portal header, NOT buried in content.

```html
<!-- In unified portal header -->
<div class="portal-header-title">
  <h1 id="admin-page-title">Page Name</h1>
  <div class="header-controls header-subtab-group" data-for-tab="tab-name">
    <div id="*-view-toggle-mount"></div>
  </div>
</div>
```

**CSS Pattern:** Use `:has()` selector for conditional visibility:

```css
[data-page="admin"]:has(#tab-tasks.active) .header-controls[data-for-tab="tasks"] {
  display: flex;
}
```

**Rules:**

- ✅ Mount point in unified header, not content area
- ✅ Use `data-for-tab` attribute for conditional display
- ✅ Hide with CSS when tab is not active
- ✅ Always include SVG icons alongside text labels
- ❌ Never place view toggles inside `.tab-content`

**Pages Using This Pattern:**

**View Toggles (same content, different views):**

- Analytics (subtabs: Overview/Business/Visitors/Reports)
- Workflows (subtabs: Approvals/Triggers)
- Tasks (view toggle: Board/List)

**Section Toggles (different content sections):**

- Leads (section toggle: Intake/Contacts)
- Knowledge Base (section toggle: Categories/Articles)

---

### Modal Structure

**Standard Pattern:** All modals use `createPortalModal()` from `/src/components/portal-modal.ts`.

```typescript
const modal = createPortalModal({
  id: 'modal-id',
  titleId: 'modal-title-id',
  title: 'Modal Title',
  contentClassName: 'optional-custom-class',
  onClose: () => modal.hide()
});

// Populate body
modal.body.innerHTML = `<!-- Form fields or content -->`;

// Populate footer
modal.footer.innerHTML = `
  <button type="button" class="btn btn-outline" id="btn-cancel">Cancel</button>
  <button type="button" class="btn btn-primary" id="btn-save">Save</button>
`;

// Append and show
document.body.appendChild(modal.overlay);
modal.show();
```

**Structure:**

```html
<div class="modal-overlay">
  <div class="modal-content portal-shadow">
    <div class="modal-header">
      <h2 id="modal-title-id">Modal Title</h2>
      <button class="modal-close icon-btn"><!-- X icon --></button>
    </div>
    <div class="modal-body">
      <!-- Scrollable content -->
    </div>
    <div class="modal-footer">
      <!-- Action buttons (right-aligned) -->
    </div>
  </div>
</div>
```

**Rules:**

- ✅ Always use `createPortalModal()` - never create custom modal HTML
- ✅ Title in sentence case, not uppercase
- ✅ Close button in header (automatic)
- ✅ Footer buttons right-aligned
- ✅ Button order: Cancel/Close → Primary Action
- ✅ Body is scrollable, header and footer are fixed

---

### Tab Structure Patterns

#### Top-Level Tabs (Main Navigation)

```html
<!-- Sidebar navigation controls which tab is active -->
<div class="tab-content" id="tab-name">
  <!-- No page title div -->
  <!-- Content starts immediately -->
</div>
```

#### Entity Detail Tabs (Sub-Navigation)

```html
<!-- Tab navigation -->
<div class="*-detail-tabs portal-tabs">
  <button class="active" data-*-tab="overview">Overview</button>
  <button data-*-tab="files">Files</button>
  <button data-*-tab="notes">Notes</button>
</div>

<!-- Tab panels -->
<div class="portal-tab-panel active" id="*-tab-overview">...</div>
<div class="portal-tab-panel" id="*-tab-files">...</div>
<div class="portal-tab-panel" id="*-tab-notes">...</div>
```

**Rules:**

- ✅ Use `.portal-tabs` for tab navigation
- ✅ Use `.portal-tab-panel` for tab content
- ✅ Active tab has `.active` class
- ✅ `data-*-tab` attribute matches panel `id`
- ✅ Overview tab is always first and active by default

**Examples:**

- Client Detail: `cd-tab-*` (Overview, Contacts, Activity, Projects, Invoices, Notes)
- Project Detail: `pd-tab-*` (Overview, Files, Messages, Invoices, Tasks, Time, Contract, Notes)

---

### Filter Structure Pattern

**Standard Pattern (not yet implemented):**

```html
<div class="table-filters">
  <div class="table-search">
    <input type="text" placeholder="Search..." />
  </div>
  <div class="filter-chips">
    <button class="filter-chip">Status: Active <span>×</span></button>
  </div>
</div>
```

**Placement:** Between `.admin-table-header` and `.admin-table-container`

**Rules:**

- ✅ Search bar on left
- ✅ Active filter chips on right
- ✅ Each chip has remove (×) button
- ✅ Chips update in real-time as filters change

**Status:** CSS exists (`/src/styles/admin/table-filters.css`), HTML implementation pending

---

## Status Colors & Badges

### Universal Status Pattern

All status badges use: `padding: 0.25rem 0.75rem`, `border-radius: 999px`, `font-size: 0.75rem`, `font-weight: 600`, `text-transform: uppercase`

### Lead/Project Status Colors

| Status | Background | Text | Variable |
|--------|------------|------|----------|
| New | `#dbeafe` | `#1e40af` | `--status-new` |
| Active/In Progress | `#3b82f6` | `#ffffff` | `--status-active` |
| Pending | `#fef3c7` | `#92400e` | `--status-pending` |
| On Hold | `#fed7aa` | `#9a3412` | `--status-on-hold` |
| Completed | `#d1fae5` | `#065f46` | `--status-completed` |
| Cancelled | `#fee2e2` | `#991b1b` | `--status-cancelled` |

### Invoice Status Colors

| Status | Class | Background | Text |
|--------|-------|------------|------|
| Draft | `.status-draft` | `var(--color-neutral-200)` | `var(--color-dark)` |
| Pending | `.status-pending` | `#fef3c7` | `#92400e` |
| Paid | `.status-paid` | `#d1fae5` | `#065f46` |
| Overdue | `.status-overdue` | `#fee2e2` | `#991b1b` |

### Task Priority Colors

| Priority | Color | Usage |
|----------|-------|-------|
| Urgent | Red (`--color-error-500`) | Immediate action required |
| High | Amber (`#f59e0b`) | Important, time-sensitive |
| Medium | Blue (`--color-primary`) | Standard priority |
| Low | Neutral (`--portal-text-muted`) | Can wait |

### Document Request Status

| Status | Style | Color |
|--------|-------|-------|
| Requested | Warning | Yellow/Amber |
| Viewed | Info | Blue |
| Uploaded | Primary | Brand color |
| Under Review | Purple | `#8b5cf6` |
| Approved | Success | Green |
| Rejected | Danger | Red |

### Health Indicators

| Health | Color | Usage |
|--------|-------|-------|
| On Track | Green | Project/client healthy |
| At Risk | Amber | Needs attention |
| Off Track / Critical | Red | Immediate intervention |

---

## User Preferences

### Documented Preferences

The following are explicit user preferences that MUST be maintained:

1. **No emojis in design** - Use Lucide icons instead
2. **All password fields need view toggle button**
3. **GSAP for complex animations** - Not CSS animations
4. **No hardcoded colors** - Always use CSS variables
5. **Semantic class names** - Describe purpose, not appearance

### Theme Support

- Light and dark themes must be supported
- Theme persists via localStorage
- System preference respected as default

---

## Feature Documentation

Complete feature specifications with component details:

### Core Features

| Feature | Documentation | Key Components |
|---------|---------------|----------------|
| Admin Dashboard | [ADMIN_DASHBOARD.md](../features/ADMIN_DASHBOARD.md) | Stat cards, tabs, sidebar navigation |
| Client Portal | [CLIENT_PORTAL.md](../features/CLIENT_PORTAL.md) | Portal cards, mobile nav, shadows |
| Messaging | [MESSAGING.md](../features/MESSAGING.md) | Thread, bubbles, emoji picker, avatars |
| Settings | [SETTINGS.md](../features/SETTINGS.md) | Grid layout, form groups, password toggle |

### CRM Features

| Feature | Documentation | Key Components |
|---------|---------------|----------------|
| Leads | [LEADS.md](../features/LEADS.md) | Pipeline kanban, scoring rules, status badges |
| Contacts | [CONTACTS.md](../features/CONTACTS.md) | Submissions table, status dropdown |
| Clients | [CLIENTS.md](../features/CLIENTS.md) | Multi-tab interface, health score, tags |
| Projects | [PROJECTS.md](../features/PROJECTS.md) | Task kanban, burndown chart, health indicator |

### Financial Features

| Feature | Documentation | Key Components |
|---------|---------------|----------------|
| Invoices | [INVOICES.md](../features/INVOICES.md) | Summary cards, invoice list, status badges |
| Proposals | [PROPOSALS.md](../features/PROPOSALS.md) | View toggle, stats cards, status dropdown |

### Content Features

| Feature | Documentation | Key Components |
|---------|---------------|----------------|
| Tasks | [TASKS.md](../features/TASKS.md) | Kanban/list view toggle, priority colors |
| Files | [FILES.md](../features/FILES.md) | Upload dropzone, file items, type labels |
| Document Requests | [DOCUMENT_REQUESTS.md](../features/DOCUMENT_REQUESTS.md) | Request table, status badges, upload modal |
| Knowledge Base | [KNOWLEDGE_BASE.md](../features/KNOWLEDGE_BASE.md) | Category cards, article table, search |

### System Features

| Feature | Documentation | Key Components |
|---------|---------------|----------------|
| Workflows | [WORKFLOWS.md](../features/WORKFLOWS.md) | Subtabs, triggers table, eye toggle |
| Analytics | [ANALYTICS.md](../features/ANALYTICS.md) | KPI cards, charts, data grid |
| Milestones | [MILESTONES.md](../features/MILESTONES.md) | Progress indicator, deliverables list |
| Secondary Sidebar | [SECONDARY_SIDEBAR.md](../features/SECONDARY_SIDEBAR.md) | Collapsed/expanded states, icons |

### Other Features

| Feature | Documentation |
|---------|---------------|
| Portfolio | [PORTFOLIO.md](../features/PORTFOLIO.md) |
| Terminal Intake | [TERMINAL_INTAKE.md](../features/TERMINAL_INTAKE.md) |
| Intro Animation | [INTRO_ANIMATION.md](../features/INTRO_ANIMATION.md) |
| Wireframes | [WIREFRAMES.md](../features/WIREFRAMES.md) |
| PDF Generation | [PDF_GENERATION.md](../features/PDF_GENERATION.md) |
| Visitor Tracking | [VISITOR-TRACKING.md](../features/VISITOR-TRACKING.md) |
| SEO | [SEO.md](../features/SEO.md) |
| Time Tracking | [TIME_TRACKING.md](../features/TIME_TRACKING.md) |
| New Project | [NEW_PROJECT.md](../features/NEW_PROJECT.md) |
| Proposal Builder | [PROPOSAL_BUILDER.md](../features/PROPOSAL_BUILDER.md) |

---

## Related Documentation

- [CSS Architecture](./CSS_ARCHITECTURE.md) - CSS variables, component classes, file organization
- [Animations](./ANIMATIONS.md) - Animation standards and GSAP usage
