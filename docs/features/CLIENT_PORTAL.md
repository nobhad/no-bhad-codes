# Client Portal Dashboard

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Dashboard Sections](#dashboard-sections)
4. [Navigation](#navigation)
5. [Styling](#styling)
6. [File Locations](#file-locations)
7. [Related Documentation](#related-documentation)

---

## Overview

The Client Portal is a dedicated dashboard for clients to manage their projects, communicate with the developer, view invoices, upload files, and manage account settings.

**Key Features:**

- Project progress tracking with visual progress bars
- Real-time messaging with emoji picker
- File upload and management
- Invoice history and status tracking
- Account and billing settings
- Notification preferences

**Access:** `/client/portal.html`

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Template Engine | EJS (Embedded JavaScript) |
| Frontend | Vanilla TypeScript |
| Styling | CSS with CSS Variables |
| Animations | GSAP |
| Build Tool | Vite |

### Module Structure

```
src/features/client/
├── client-portal.ts      # Main portal module
├── client-intake.ts      # Intake form handling
└── client-landing.ts     # Landing page logic

templates/pages/
└── client-portal.ejs     # Portal HTML template

src/styles/pages/
└── client-portal.css     # Portal-specific styles
```

### Class Hierarchy

```typescript
ClientPortalModule extends BaseModule {
  // State
  private isLoggedIn: boolean
  private currentProject: ClientProject | null

  // Lifecycle
  async init(): Promise<void>
  async destroy(): Promise<void>

  // Event Handlers
  private setupEventListeners(): void
  private setupTabNavigation(): void
  private setupEmojiPicker(): void
}
```

---

## Dashboard Sections

### 1. Quick Stats (Clickable Cards)

Three stat cards at the top of the dashboard, each clickable to navigate to the relevant section:

| Card | Data | Navigates To |
|------|------|--------------|
| Active Projects | Count of in-progress projects | Dashboard |
| Pending Invoices | Count of unpaid invoices | Invoices tab |
| Unread Messages | Count of new messages | Messages tab |

**Implementation:**

```html
<button class="stat-card stat-card-clickable cp-shadow" data-tab="invoices" type="button">
  <span class="stat-number">0</span>
  <span class="stat-label">Pending Invoices</span>
</button>
```

**Hover Effect:**
- Background changes to `var(--color-primary)` (green)
- Number color changes to light for contrast

### 2. Project Cards

Displays current project status with:
- Project name
- Status badge (In Progress, Completed, On Hold)
- Progress percentage
- Visual progress bar

**CSS Class:** `.cp-project-card` (prefixed to avoid conflicts with `projects.css`)

### 3. Recent Activity

Chronological log of project events:
- Project intake received
- Account activation
- Status changes
- File uploads
- Invoice generation

---

## Navigation

### Sidebar Navigation

Collapsible sidebar with tab buttons:

| Button | Tab ID | Description |
|--------|--------|-------------|
| DASHBOARD | `dashboard` | Main overview |
| FILES | `files` | File management |
| MESSAGES | `messages` | Client communication |
| INVOICES | `invoices` | Payment history |
| SETTINGS | `settings` | Account settings |
| + NEW PROJECT | `new-project` | Project request form |
| PROJECT PREVIEW | `preview` | Live site preview (hidden by default) |

**Tab Switching:**

```typescript
// Tab navigation via data attributes
document.querySelectorAll('[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    this.switchTab(tabId);
  });
});
```

### Sidebar Toggle

Collapsible sidebar with toggle button:
- Collapsed state: Icons only
- Expanded state: Full button text
- Persists preference in localStorage

---

## Styling

### Shadow Utility Class

All cards and sections use the `.cp-shadow` utility class for consistent styling:

```css
.cp-shadow {
  box-shadow:
    20px 6px 30px rgba(0, 0, 0, 0.6),
    8px 8px 16px rgba(0, 0, 0, 0.8),
    3px 3px 6px rgba(0, 0, 0, 0.9);
}
```

### Color Variables Used

| Variable | Purpose |
|----------|---------|
| `--color-neutral-100` | Card backgrounds |
| `--color-neutral-300` | Secondary backgrounds |
| `--color-dark` | Text color |
| `--color-primary` | Accent color (green) |
| `#000000` | Borders (actual black) |

### Responsive Design

Settings grid adapts to viewport:

```css
.settings-grid {
  grid-template-columns: repeat(3, minmax(320px, 1fr));
}

@media (max-width: 1200px) {
  .settings-grid {
    grid-template-columns: repeat(2, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `client/portal.html` | Entry point HTML |
| `templates/pages/client-portal.ejs` | Main template |
| `src/features/client/client-portal.ts` | TypeScript module |
| `src/styles/pages/client-portal.css` | Styles |
| `src/client-portal.ts` | Entry point script |

---

## Related Documentation

- [Messages](./MESSAGES.md) - Messaging system details
- [Files](./FILES.md) - File upload and management
- [Invoices](./INVOICES.md) - Invoice system
- [Settings](./SETTINGS.md) - User settings
- [New Project](./NEW_PROJECT.md) - Project request form
- [CSS Architecture](./CSS_ARCHITECTURE.md) - Styling system
