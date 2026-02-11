# Client Portal Dashboard

**Last Updated:** February 11, 2026

> **Part of "The Backend"** - The portal system consisting of both the Admin Dashboard and Client Portal.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [TypeScript Module](#typescript-module)
4. [Dashboard Sections](#dashboard-sections)
5. [Navigation](#navigation)
6. [Tab System](#tab-system)
7. [Mobile Responsiveness](#mobile-responsiveness)
8. [Login System](#login-system)
9. [File Management](#file-management)
10. [Invoice Management](#invoice-management)
11. [Project Management](#project-management)
12. [View Management](#view-management)
13. [Settings & Forms](#settings--forms)
14. [Styling](#styling)
15. [File Locations](#file-locations)
16. [Related Documentation](#related-documentation)

---

## Overview

The Client Portal is the client-facing side of "The Backend" portal system. It provides a dedicated dashboard for clients to manage their projects, communicate with the developer, view invoices, upload files, and manage account settings.

**Key Features:**

- Project progress tracking with visual progress bars
- Real-time messaging with emoji picker (`emoji-picker-element` web component)
- **File Management System:**
  - Drag & drop file upload
  - File list from API with demo fallback
  - File preview (images/PDFs open in new tab)
  - File download with original filename
  - File delete with confirmation
  - Multi-file upload support (up to 5 files)
- **Invoice System:**
  - Invoice list from API with summary stats
  - Status badges (Pending, Paid, Overdue, etc.)
  - Invoice preview in new tab
  - PDF download via pdf-lib
- **Settings with Backend Persistence:**
  - Profile updates (name, company, phone)
  - Password change with verification
  - Notification preferences
  - Billing information
- **New Project Request:**
  - Form submission to backend API
  - Project type, budget, timeline selection
  - Admin notification on submission
- Live project preview iframe
- HttpOnly cookie authentication (real login with demo fallback)

**Access:** `/client/portal.html`

---

## Architecture

### Technology Stack

|Component|Technology|
|-----------|------------|
|Template Engine|EJS (Embedded JavaScript)|
|Frontend|Vanilla TypeScript|
|Styling|CSS with CSS Variables|
|Animations|GSAP|
|Build Tool|Vite|
|Emoji Picker|`emoji-picker-element` web component|

### Module Structure

```text
src/features/client/
├── client-portal.ts              # Main portal module (~2064 lines)
├── terminal-intake.ts            # Terminal-style intake form (~1700 lines)
├── terminal-intake-ui.ts         # Terminal UI components (~600 lines)
├── terminal-intake-commands.ts   # Terminal commands (~150 lines)
├── terminal-intake-data.ts       # Terminal data/questions (~300 lines)
├── terminal-intake-types.ts      # Type definitions
└── portal-types.ts               # Portal type definitions

src/features/client/modules/      # Extracted modules (14 modules)
├── portal-ad-hoc-requests.ts     # Ad hoc request management (~576 lines)
├── portal-approvals.ts           # Approval workflows (~247 lines)
├── portal-auth.ts                # Login, logout, session (~310 lines)
├── portal-document-requests.ts   # Document request handling (~446 lines)
├── portal-files.ts               # File management (~400 lines)
├── portal-help.ts                # Help center and FAQ (~371 lines)
├── portal-invoices.ts            # Invoice display (~210 lines)
├── portal-messages.ts            # Messaging (~270 lines)
├── portal-navigation.ts          # Navigation, views, sidebar (~360 lines)
├── portal-onboarding-ui.ts       # Onboarding UI components (~494 lines)
├── portal-onboarding-wizard.ts   # Onboarding wizard flow (~551 lines)
├── portal-projects.ts            # Project loading, display (~310 lines)
├── portal-questionnaires.ts      # Questionnaire handling (~786 lines)
├── portal-settings.ts            # Settings forms (~260 lines)
└── index.ts                      # Module exports

client/
├── portal.html                   # Portal HTML entry point
├── set-password.html             # Password setup page
└── intake.html                   # Intake form page

src/styles/client-portal/         # Portal-specific styles
├── index.css                     # Bundle entry
├── components.css                # Reusable components
├── dashboard.css                 # Dashboard layout
├── files.css                     # Files tab
├── invoices.css                  # Invoices tab
├── layout.css                    # Overall layout
├── login.css                     # Login form
├── projects.css                  # Projects tab
├── settings.css                  # Settings tab
└── sidebar.css                   # Sidebar navigation

server/routes/
├── uploads.ts                    # File upload API endpoints
├── clients.ts                    # Client profile/settings API
├── projects.ts                   # Project management API
├── invoices.ts                   # Invoice API with PDF generation
├── messages.ts                   # Messaging API
├── intake.ts                     # Intake form, status
└── proposals.ts                  # Proposal builder API
```

---

## TypeScript Module

### Class Definition

```typescript
// src/features/client/client-portal.ts
import { BaseModule } from '../../modules/base';
import type { ClientProject, ClientProjectStatus } from '../../types/client';
import { gsap } from 'gsap';
import { APP_CONSTANTS } from '../../config/constants';
import 'emoji-picker-element';

export class ClientPortalModule extends BaseModule {
  private isLoggedIn = false;
  private currentProject: ClientProject | null = null;
  private currentUser: string | null = null;
  private dashboardListenersSetup = false;

  // Configuration
  private config = {
    loginSectionId: 'login-section',
    dashboardSectionId: 'dashboard-section',
    loginFormId: 'login-form',
    projectsListId: 'projects-list',
    projectDetailsId: 'project-details'
  };

  // DOM elements
  private loginSection: HTMLElement | null = null;
  private dashboardSection: HTMLElement | null = null;
  private loginForm: HTMLFormElement | null = null;
  private projectsList: HTMLElement | null = null;
  private projectDetails: HTMLElement | null = null;

  constructor() {
    super('client-portal');
  }
}
```

### Lifecycle Methods

|Method|Purpose|
|--------|---------|
|`onInit()`|Cache DOM elements, setup event listeners|
|`onDestroy()`|Cleanup event listeners and animations|
|`cacheElements()`|Query and store DOM element references|
|`setupEventListeners()`|Attach all event handlers|
|`setupDashboardEventListeners()`|Setup dashboard-specific handlers|

### State Management

|Property|Type|Purpose|
|----------|------|---------|
|`isLoggedIn`|`boolean`|Track authentication state|
|`currentProject`|`ClientProject \|null`|Currently selected project|
|`currentUser`|`string \|null`|Current user's email|
|`dashboardListenersSetup`|`boolean`|Prevent duplicate listener setup|

---

## Dashboard Sections

### 1. Quick Stats (Clickable Cards)

Three stat cards at the top of the dashboard, each clickable to navigate to the relevant section:

|Card|Data|Navigates To|
|------|------|--------------|
|Active Projects|Count of in-progress projects|Dashboard|
|Pending Invoices|Count of unpaid invoices|Invoices tab|
|Unread Messages|Count of new messages|Messages tab|

**HTML Implementation:**

```html
<!-- templates/pages/client-portal.ejs:39-52 -->
<div class="quick-stats">
    <button class="stat-card stat-card-clickable portal-shadow" data-tab="dashboard" type="button">
        <span class="stat-number">1</span>
        <span class="stat-label">Active Projects</span>
    </button>
    <button class="stat-card stat-card-clickable portal-shadow" data-tab="invoices" type="button">
        <span class="stat-number">0</span>
        <span class="stat-label">Pending Invoices</span>
    </button>
    <button class="stat-card stat-card-clickable portal-shadow" data-tab="messages" type="button">
        <span class="stat-number">1</span>
        <span class="stat-label">Unread Messages</span>
    </button>
</div>
```

**TypeScript Event Handling:**

```typescript
// src/features/client/client-portal.ts:150-170
const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
if (statCards.length > 0) {
  // Debug logging now uses logger utility (automatically disabled in production)
  statCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = (card as HTMLElement).dataset.tab;
      if (tabName) {
        this.switchTab(tabName);
        // Update active state on sidebar buttons
        sidebarButtons.forEach((b) => {
          b.classList.remove('active');
          if ((b as HTMLElement).dataset.tab === tabName) {
            b.classList.add('active');
          }
        });
      }
    });
  });
}
```

### 2. Project Cards

Displays current project status with:

- Project name
- Status badge (In Progress, Completed, On Hold)
- Progress percentage
- Visual progress bar

**HTML Implementation:**

```html
<!-- templates/pages/client-portal.ejs:54-64 -->
<div class="cp-project-cards">
    <div class="cp-project-card portal-shadow">
        <h3>Your Website Project</h3>
        <p class="project-status">Status: <span class="status-badge">In Progress</span></p>
        <p class="project-progress">Progress: 25%</p>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 25%"></div>
        </div>
    </div>
</div>
```

**CSS Class:** `.cp-project-card` (prefixed to avoid conflicts with `projects.css`)

### 3. Recent Activity

Chronological log of project events:

- Project intake received
- Account activation
- Status changes
- File uploads
- Invoice generation

```html
<!-- templates/pages/client-portal.ejs:66-73 -->
<div class="recent-activity portal-shadow">
    <h3>Recent Activity</h3>
    <ul class="activity-list">
        <li>Project intake received - Nov 30, 2025</li>
        <li>Account activated - Nov 28, 2025</li>
    </ul>
</div>
```

---

## Navigation

### Hash-Based Routing

The portal uses hash-based routing for browser navigation support. Each tab has its own URL, enabling:

- Browser back/forward navigation
- Bookmarking specific views
- Deep linking to tabs (e.g., `client/#/messages`)

**URL Structure:**

| Tab | URL Hash |
|-----|----------|
| Dashboard | `#/dashboard` |
| Files | `#/files` |
| Invoices | `#/invoices` |
| Document Requests | `#/documents` |
| Questionnaires | `#/questionnaires` |
| Requests | `#/requests` |
| Review/Preview | `#/review` |
| New Project | `#/new-project` |
| Messages | `#/messages` |
| Help | `#/help` |
| Settings | `#/settings` |

**Key Functions (portal-navigation.ts):**

| Function | Purpose |
|----------|---------|
| `initHashRouter(callbacks)` | Initialize router, set up hashchange listener |
| `navigateTo(tabName, callbacks)` | Update hash and switch to tab |
| `getTabFromHash()` | Parse current URL hash to get tab name |
| `switchTab(tabName, callbacks, shouldUpdateHash)` | Switch tab with optional hash update |

**Implementation Notes:**

- Invalid hashes redirect to dashboard
- `isNavigating` flag prevents re-entrant hash updates
- Hash router initialized after dashboard event listeners are ready

### Sidebar Navigation

Collapsible sidebar with tab buttons:

|Button|Tab ID|Element ID|Description|
|--------|--------|------------|-------------|
|DASHBOARD|`dashboard`|`btn-dashboard`|Main overview|
|FILES|`files`|`btn-files`|File management|
|MESSAGES|`messages`|`btn-messages`|Client communication|
|INVOICES|`invoices`|`btn-invoices`|Payment history|
|SETTINGS|`settings`|`btn-settings`|Account settings|
|+ NEW PROJECT|`new-project`|`btn-new-project`|Project request form|
|PROJECT PREVIEW|`preview`|`btn-preview`|Live site preview (hidden by default)|

**HTML Implementation:**

```html
<!-- templates/pages/client-portal.ejs:12-20 -->
<div class="sidebar-buttons">
    <button class="btn btn-secondary active" id="btn-dashboard" data-tab="dashboard">DASHBOARD</button>
    <button class="btn btn-secondary" id="btn-files" data-tab="files">FILES</button>
    <button class="btn btn-secondary" id="btn-messages" data-tab="messages">MESSAGES</button>
    <button class="btn btn-secondary" id="btn-invoices" data-tab="invoices">INVOICES</button>
    <button class="btn btn-secondary" id="btn-settings" data-tab="settings">SETTINGS</button>
    <button class="btn btn-secondary" id="btn-new-project" data-tab="new-project">+ NEW PROJECT</button>
    <button class="btn btn-secondary btn-preview hidden" id="btn-preview" data-tab="preview">PROJECT PREVIEW</button>
</div>
```

### Sidebar Toggle

Collapsible sidebar with toggle button:

- Collapsed state: Icons only
- Expanded state: Full button text
- Persists preference in localStorage

**TypeScript Implementation:**

```typescript
// src/features/client/client-portal.ts:1096-1105
private toggleSidebar(): void {
  const sidebar = document.getElementById('sidebar');

  if (!sidebar) {
    console.error('Sidebar element not found');
    return;
  }

  sidebar.classList.toggle('collapsed');
}
```

---

## View System (Dynamic Rendering)

The portal uses **dynamic view rendering** instead of hidden tabs. Each view is rendered on-demand when navigating to it.

### Architecture

**File:** `src/features/client/modules/portal-views.ts`

Each view has a dedicated render function that generates the HTML and inserts it into the single content container (`#portal-view-content`).

```typescript
// View Registry
export const VIEW_RENDERERS: Record<string, () => void> = {
  dashboard: renderDashboardView,
  files: renderFilesView,
  messages: renderMessagesView,
  invoices: renderInvoicesView,
  documents: renderDocumentsView,
  requests: renderRequestsView,
  questionnaires: renderQuestionnairesView,
  help: renderHelpView,
  settings: renderSettingsView,
  'new-project': renderNewProjectView,
  preview: renderPreviewView
};

// Render a view by name
export function renderView(viewName: string): void {
  const renderer = VIEW_RENDERERS[viewName];
  if (renderer) {
    clearView();
    renderer();
  }
}
```

### Benefits

- **Smaller initial payload**: Only the current view's HTML is in the DOM
- **Proper routing**: Each view has its own URL hash
- **Browser navigation**: Back/forward buttons work correctly
- **Deep linking**: Users can bookmark and share specific views
- **Memory efficient**: Unused views don't consume DOM resources

### HTML Structure

```html
<!-- Single content container in client/index.html -->
<div class="portal-view-content" id="portal-view-content">
  <!-- Content rendered dynamically by portal-views.ts -->
</div>
```

---

## Mobile Responsiveness

The Client Portal is fully responsive on mobile devices (screens under 768px).

### Mobile Navigation

On mobile, the sidebar is replaced with a hamburger menu:

- Fixed header bar at top with hamburger button (right) and page title (left)
- Sidebar slides in from the right side
- Dark overlay behind sidebar when open
- Close button inside sidebar to dismiss
- Page title updates when switching tabs

**HTML Structure:**

```html
<!-- Mobile Header Bar (visible on mobile only) -->
<header class="mobile-header" id="mobile-header">
    <h1 class="mobile-header-title" id="mobile-header-title">Dashboard</h1>
    <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle menu">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
    </button>
</header>

<!-- Mobile Overlay -->
<div class="mobile-overlay" id="mobile-overlay"></div>
```

**TypeScript Methods:**

```typescript
// Mobile menu toggle
private setupMobileMenuToggle(): void {
  const toggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  toggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('mobile-open');
    overlay?.classList.toggle('active');
  });
}

// Update mobile header title on tab switch
private updateMobileHeaderTitle(tabName: string): void {
  const titleMap: Record<string, string> = {
    dashboard: 'Dashboard',
    files: 'Files',
    messages: 'Messages',
    invoices: 'Invoices',
    settings: 'Settings',
    'new-project': 'New Project',
    preview: 'Preview'
  };
  const title = document.getElementById('mobile-header-title');
  if (title) title.textContent = titleMap[tabName] || 'Dashboard';
}
```

### Mobile Dashboard

- Stat cards stack in single column
- Project cards appear above quick stats
- Recent activity section full width

### Mobile Files

- File items stack vertically
- Drag/drop zone hidden (not functional on touch)
- Only Browse Files button shown for uploads
- Trash icon only on client-uploaded files

### Mobile Messages

- Emoji picker hidden
- Chat area takes most of screen height
- Messages thread is scrollable
- Send button visible (no Enter key on mobile keyboards)
- Avatar positioning optimized for touch

### Mobile CSS

Key mobile styles in `src/styles/pages/client-portal.css`:

```css
@media (max-width: 768px) {
  /* Fixed header bar */
  .mobile-header {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    z-index: 1000;
  }

  /* Sidebar slides from right */
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 1001;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  /* Dark overlay */
  .mobile-overlay.active {
    display: block;
    background: rgba(0, 0, 0, 0.5);
  }

  /* Stack stat cards */
  .quick-stats {
    flex-direction: column;
  }

  /* Hide emoji picker */
  .emoji-picker-container {
    display: none !important;
  }

  /* Chat fills screen */
  .messages-container {
    height: calc(100vh - 100px);
  }
}
```

---

## Login System

### Login Handler

```typescript
// src/features/client/client-portal.ts:330-391
private async handleLogin(event: Event): Promise<void> {
  event.preventDefault();
  if (!this.loginForm) return;

  const formData = new FormData(this.loginForm);
  const credentials = {
    email: formData.get('email') as string,
    password: formData.get('password') as string
  };

  // Clear previous errors
  this.clearErrors();
  document.getElementById('login-error')!.style.display = 'none';

  // Basic validation
  if (!credentials.email.trim()) {
    this.showFieldError('client-email', 'Email address is required');
    return;
  }

  if (!credentials.password.trim()) {
    this.showFieldError('client-password', 'Password is required');
    return;
  }

  this.setLoginLoading(true);

  try {
    // For demo purposes, simulate successful login
    if (credentials.email && credentials.password) {
      const mockUserData = {
        token: `demo_token_${Date.now()}`,
        user: {
          id: 1,
          email: credentials.email,
          name: credentials.email
            .split('@')[0]
            .replace(/[^a-zA-Z]/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())
        }
      };

      // Store authentication token
      localStorage.setItem('client_auth_token', mockUserData.token);

      this.isLoggedIn = true;
      this.currentUser = mockUserData.user.email;

      await this.loadMockUserProjects(mockUserData.user);
      this.showDashboard();
    }
  } catch (error) {
    console.error('Login error:', error);
    this.showLoginError(error instanceof Error ? error.message : 'Login failed');
  } finally {
    this.setLoginLoading(false);
  }
}
```

### Password Toggle

```typescript
// src/features/client/client-portal.ts:98-112
const passwordToggle = document.getElementById('password-toggle');
const passwordInput = document.getElementById('client-password') as HTMLInputElement;
if (passwordToggle && passwordInput) {
  passwordToggle.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    // SVG icon swap logic...
  });
}
```

### Password Autocomplete Best Practices

To prevent browsers from showing multiple "Save Password" prompts, follow this pattern:

|Field|Autocomplete Value|Reason|
|-------|---------------------|--------|
|Form element|`autocomplete="off"`|Prevents form-level password manager triggers|
|Username/Email|`autocomplete="username"`|Identifies the account field|
|Current Password|`autocomplete="current-password"`|For login/verification|
|New Password|`autocomplete="new-password"`|For password changes|
|Confirm Password|`autocomplete="off"`|**NOT "new-password"** - prevents duplicate save prompts|

**Files using this pattern:**

- `client/set-password.html` - Initial password setup
- `client/reset-password.html` - Password reset flow
- `src/features/client/modules/portal-views.ts` - Change password form
- `templates/pages/client-portal.ejs` - EJS template

**Important:** Never dynamically change autocomplete attributes in JavaScript as this can cause browsers to re-evaluate and show multiple save prompts.

---

## File Management

The Client Portal includes a complete file management system. For detailed documentation, see [FILES.md](./FILES.md).

### Upload Key Features

|Feature|Description|
|---------|-------------|
|Drag & Drop Upload|Upload files by dragging them to the dropzone|
|Browse Files|Traditional file picker button|
|File List from API|Dynamic file list from backend with demo fallback|
|File Preview|Open images and PDFs in new browser tab|
|File Download|Download files with original filename|
|Access Control|Clients can only access their own project files|

### Upload API Endpoints

|Endpoint|Method|Description|
|----------|--------|-------------|
|`/api/uploads/client`|GET|Get all files for authenticated client|
|`/api/uploads/project/:projectId`|GET|Get files for specific project|
|`/api/uploads/file/:fileId`|GET|Download/preview a file|
|`/api/uploads/file/:fileId`|DELETE|Delete a file|
|`/api/uploads/multiple`|POST|Upload multiple files|

### Upload TypeScript Methods

```typescript
// Key file management methods in client-portal.ts
loadFiles()                  // Fetch and render file list
setupFileUploadHandlers()    // Setup drag & drop
uploadFiles(files: File[])   // Upload files to server
previewFile(fileId, mime)    // Open file in new tab
downloadFile(fileId, name)   // Trigger file download
```

---

## Invoice Management

The Client Portal includes a complete invoice management system. For detailed documentation, see [INVOICES.md](./INVOICES.md).

### Invoice Key Features

|Feature|Description|
|---------|-------------|
|Summary Cards|Total outstanding and total paid amounts|
|Invoice List from API|Dynamic list from backend with demo fallback|
|Status Badges|Visual status indicators (Pending, Paid, Overdue, etc.)|
|Invoice Preview|Open invoice details in new tab|
|Invoice PDF Download|Download invoice as PDF via pdf-lib|

### Invoice API Endpoints

|Endpoint|Method|Description|
|----------|--------|-------------|
|`/api/invoices/me`|GET|Get all invoices for authenticated client with summary|
|`/api/invoices/:id`|GET|Get specific invoice details|
|`/api/invoices/:id/pdf`|GET|Download invoice as PDF|

### Invoice TypeScript Methods

```typescript
// Key invoice management methods in client-portal.ts
loadInvoices()              // Fetch and render invoice list
renderInvoicesList()        // Render invoice items
formatCurrency()            // Format as USD currency
previewInvoice(id)          // Open invoice in new tab
downloadInvoice(id, number) // Download PDF via blob fetch
```

---

## Project Management

### ClientProject Interface

```typescript
interface ClientProject {
  id: string;
  projectName: string;
  description: string;
  clientId: string;
  clientName: string;
  status: ClientProjectStatus;
  priority: string;
  progress: number;
  startDate: string;
  estimatedEndDate: string;
  updates: ProjectUpdate[];
  files: ProjectFile[];
  messages: ProjectMessage[];
  milestones: ProjectMilestone[];
}
```

### Mock Project Data

```typescript
// src/features/client/client-portal.ts:393-478
private async loadMockUserProjects(user: {
  id: number;
  email: string;
  name: string;
}): Promise<void> {
  const sampleProject: ClientProject = {
    id: `project-${user.id}-001`,
    projectName: 'Your Website Project',
    description: 'Custom website development based on your intake form requirements.',
    clientId: user.email,
    clientName: user.name || 'Valued Client',
    status: 'pending' as ClientProjectStatus,
    priority: 'medium',
    progress: 25,
    startDate: new Date().toISOString().split('T')[0],
    estimatedEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    updates: [
      {
        id: 'update-001',
        date: new Date().toISOString().split('T')[0],
        title: 'Project Intake Received',
        description: 'Your project details have been received...',
        author: 'No Bhad Codes Team',
        type: 'general'
      }
    ],
    messages: [
      {
        id: 'msg-001',
        sender: 'No Bhad Codes Team',
        senderRole: 'system',
        message: 'Welcome to your project portal!',
        timestamp: new Date().toISOString(),
        isRead: false
      }
    ],
    milestones: [
      {
        id: 'milestone-001',
        title: 'Project Planning',
        description: 'Review requirements and create detailed project plan',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isCompleted: false,
        deliverables: ['Requirements analysis', 'Project timeline', 'Technical specification']
      }
    ]
  };

  this.populateProjectsList([sampleProject]);
}
```

---

## View Management

### Hide All Views

```typescript
// src/features/client/client-portal.ts:1074-1094
private hideAllViews(): void {
  const views = [
    'welcome-view',
    'settings-view',
    'contact-view',
    'billing-view',
    'notifications-view',
    'project-detail-view',
    'updates-view',
    'files-view',
    'messages-view',
    'content-view'
  ];

  views.forEach((viewId) => {
    const view = document.getElementById(viewId);
    if (view) {
      view.style.display = 'none';
    }
  });
}
```

### View Methods

|Method|Purpose|
|--------|---------|
|`showDashboard()`|Display main dashboard|
|`showSettings()`|Display settings view|
|`showBillingView()`|Display billing settings|
|`showContactView()`|Display contact settings|
|`showNotificationsView()`|Display notification preferences|
|`showFilesView()`|Display files management|
|`showMessagesView()`|Display messaging interface|
|`showWelcomeView()`|Display welcome/home view|
|`showProjectDetailView()`|Display project details|

---

## Settings & Forms

Settings are now persisted to the backend API. For detailed documentation, see [SETTINGS.md](./SETTINGS.md).

### Settings API Endpoints

|Endpoint|Method|Purpose|
|----------|--------|---------|
|`/api/clients/me`|GET|Get current client profile|
|`/api/clients/me`|PUT|Update profile (name, company, phone)|
|`/api/clients/me/password`|PUT|Change password|
|`/api/clients/me/notifications`|PUT|Update notification preferences|
|`/api/clients/me/billing`|PUT|Update billing information|

### Form Save Methods

|Method|API Endpoint|Purpose|
|--------|--------------|---------|
|`saveProfileSettings()`|`/api/clients/me` + `/me/password`|Save profile and password|
|`saveNotificationSettings()`|`/api/clients/me/notifications`|Save notification preferences|
|`saveBillingSettings()`|`/api/clients/me/billing`|Save billing information|

### Success Message

```typescript
// src/features/client/client-portal.ts:1432-1455
private showSuccessMessage(message: string): void {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--color-primary);
    color: var(--color-dark);
    padding: 1rem 2rem;
    border: 2px solid var(--color-dark);
    z-index: 9999;
    font-weight: 600;
  `;

  document.body.appendChild(successDiv);

  // Remove after 3 seconds
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}
```

---

## Styling

### Shadow Utility Class

All cards and sections use the `.portal-shadow` utility class for consistent styling:

```css
.portal-shadow {
  box-shadow:
    20px 6px 30px rgba(0, 0, 0, 0.6),
    8px 8px 16px rgba(0, 0, 0, 0.8),
    3px 3px 6px rgba(0, 0, 0, 0.9);
}
```

### Color Variables Used

|Variable|Purpose|
|----------|---------|
|`--color-neutral-100`|Card backgrounds|
|`--color-neutral-300`|Secondary backgrounds|
|`--color-dark`|Text color|
|`--color-primary`|Accent color (green)|
|`#000000`|Borders (actual black)|

### Responsive Design

Settings grid adapts to viewport:

```css
.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(320px, 1fr));
  gap: 1.5rem;
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

|File|Purpose|
|------|---------|
|`client/portal.html`|Entry point HTML|
|`src/features/client/client-portal.ts`|Main TypeScript module (~2064 lines)|
|`src/features/client/modules/`|Extracted portal modules (14 files)|
|`src/styles/client-portal/`|Portal-specific styles (8 CSS files)|
|`src/portal.ts`|Entry point script (used by client/portal.html)|
|`server/routes/uploads.ts`|File upload API endpoints|
|`server/routes/clients.ts`|Client profile/settings API|
|`server/routes/projects.ts`|Project management API|
|`server/routes/invoices.ts`|Invoice API with PDF generation|
|`server/routes/messages.ts`|Messaging API|

---

## Related Documentation

- [Messages](./MESSAGES.md) - Messaging system details
- [Files](./FILES.md) - File upload and management
- [Invoices](./INVOICES.md) - Invoice system
- [Settings](./SETTINGS.md) - User settings
- [New Project](./NEW_PROJECT.md) - Project request form
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system
