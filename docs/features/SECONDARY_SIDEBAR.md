# Secondary Sidebar Feature

**Status:** Implemented but disabled (user preferred original horizontal tabs)
**Last Updated:** 2026-02-09

## Overview

A vertical tab navigation sidebar for multi-tab detail pages (project details, client details, analytics). Sits between the main sidebar and content area, providing an alternative to horizontal tabs.

## Architecture

```text
.dashboard-container > .sidebar + #secondary-sidebar + #secondary-tabs-horizontal + .dashboard-content
```

- **Width:** 180px expanded, 56px collapsed (icon-only)
- **Features:** Collapsible, state persists in localStorage, horizontal tabs fallback on mobile

## Files

### Component

- `src/components/secondary-sidebar.ts` - Reusable component with controller API

### Styles

- `src/styles/admin/secondary-sidebar.css` - All styling (already imported in admin/index.css)

### HTML Mount Points (already in admin/index.html)

```html
<!-- Between .sidebar and .dashboard-content -->
<aside id="secondary-sidebar">
  <!-- Populated dynamically by createSecondarySidebar() -->
</aside>

<div id="secondary-tabs-horizontal">
  <!-- Populated dynamically for mobile fallback -->
</div>
```

## How to Enable for Project Details

### Step 1: Update admin-projects.ts

Add to the imports at the top:

```typescript
import { createSecondarySidebar, SECONDARY_TAB_ICONS, type SecondarySidebarController } from '../../../components/secondary-sidebar';
```

Add module-level variable after other `let` declarations:

```typescript
let secondarySidebar: SecondarySidebarController | null = null;
```

Add tabs configuration before `showProjectDetails`:

```typescript
const PROJECT_DETAIL_TABS = [
  { id: 'overview', icon: SECONDARY_TAB_ICONS.OVERVIEW, label: 'Overview' },
  { id: 'files', icon: SECONDARY_TAB_ICONS.FILES, label: 'Files' },
  { id: 'messages', icon: SECONDARY_TAB_ICONS.MESSAGES, label: 'Messages' },
  { id: 'invoices', icon: SECONDARY_TAB_ICONS.INVOICES, label: 'Invoices' },
  { id: 'tasks', icon: SECONDARY_TAB_ICONS.TASKS, label: 'Tasks' },
  { id: 'time', icon: SECONDARY_TAB_ICONS.TIMELINE, label: 'Time' },
  { id: 'contract', icon: SECONDARY_TAB_ICONS.CONTRACT, label: 'Contract' }
];
```

Add these functions:

```typescript
function initSecondarySidebar(projectName: string): void {
  cleanupSecondarySidebar();

  const container = document.querySelector('.dashboard-container');
  const mountPoint = document.getElementById('secondary-sidebar');
  const horizontalMountPoint = document.getElementById('secondary-tabs-horizontal');

  if (!mountPoint || !horizontalMountPoint) {
    console.warn('[AdminProjects] Secondary sidebar mount points not found');
    return;
  }

  container?.classList.add('has-secondary-sidebar');

  const activeHorizontalTab = document.querySelector('.project-detail-tabs button.active') as HTMLElement;
  const activeTabId = activeHorizontalTab?.dataset.pdTab || 'overview';

  const truncatedName = projectName.length > 20 ? `${projectName.slice(0, 18)}...` : projectName;

  secondarySidebar = createSecondarySidebar({
    tabs: PROJECT_DETAIL_TABS,
    activeTab: activeTabId,
    title: truncatedName,
    onBack: () => storedContext?.switchTab('projects'),
    persistState: true,
    container: container as HTMLElement,
    onTabChange: (tabId) => handleSecondaryTabChange(tabId)
  });

  mountPoint.innerHTML = '';
  mountPoint.appendChild(secondarySidebar.getElement());

  horizontalMountPoint.innerHTML = '';
  horizontalMountPoint.appendChild(secondarySidebar.getHorizontalTabs());
}

function handleSecondaryTabChange(tabId: string): void {
  const tabBtn = document.querySelector(`.project-detail-tabs button[data-pd-tab="${tabId}"]`) as HTMLButtonElement;
  if (tabBtn) {
    tabBtn.click();
  }
}

function cleanupSecondarySidebar(): void {
  if (secondarySidebar) {
    secondarySidebar.destroy();
    secondarySidebar = null;
  }

  const container = document.querySelector('.dashboard-container');
  container?.classList.remove('has-secondary-sidebar');

  const mountPoint = document.getElementById('secondary-sidebar');
  const horizontalMountPoint = document.getElementById('secondary-tabs-horizontal');
  if (mountPoint) mountPoint.innerHTML = '';
  if (horizontalMountPoint) horizontalMountPoint.innerHTML = '';
}
```

### Step 2: Call initSecondarySidebar in showProjectDetails

In `showProjectDetails()`, after `populateProjectDetailView(project)`:

```typescript
initSecondarySidebar(project.project_name || 'Project');
```

### Step 3: Clean up when leaving

In `loadProjects()`, at the start:

```typescript
cleanupSecondarySidebar();
```

### Step 4: Sync horizontal tabs with secondary sidebar

In `setupProjectDetailTabs()`, add this inside the tab click handler:

```typescript
// Sync secondary sidebar with horizontal tab
if (secondarySidebar) {
  secondarySidebar.setActiveTab(tabName);
}
```

### Step 5: Hide original horizontal tabs (optional)

Add to `secondary-sidebar.css`:

```css
[data-page="admin"] .dashboard-container.has-secondary-sidebar .project-detail-tabs {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## Component API

```typescript
interface SecondarySidebarConfig {
  tabs: SecondaryTab[];           // Array of tabs with id, icon, label
  activeTab: string;              // Currently active tab ID
  onTabChange: (tabId: string) => void;  // Callback when tab changes
  title?: string;                 // Header title (e.g., project name)
  onBack?: () => void;            // Back button callback
  startCollapsed?: boolean;       // Start in collapsed state
  persistState?: boolean;         // Persist collapse state to localStorage
  container?: HTMLElement | null; // Container to add .has-secondary-sidebar class
}

interface SecondarySidebarController {
  setActiveTab: (tabId: string) => void;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
  isCollapsed: () => boolean;
  setBadge: (tabId: string, count: number) => void;
  destroy: () => void;
  getElement: () => HTMLElement;
  getHorizontalTabs: () => HTMLElement;
}
```

## Available Icons

```typescript
SECONDARY_TAB_ICONS = {
  OVERVIEW, TASKS, FILES, MESSAGES, CONTRACT, INVOICES,
  TIMELINE, SETTINGS, ANALYTICS, USERS, PROJECTS, INFO, MILESTONES
}
```

## Responsive Behavior

- `> 1024px`: Secondary sidebar visible
- `< 1024px`: Secondary sidebar hidden, horizontal tabs fallback shown

## Styling Customization

The CSS matches the main sidebar styling:
- Acme font, uppercase, letter-spacing
- Red text on active, red background on hover
- Shadow casting onto content area
- 56px collapsed width with centered 40x40 icon buttons
