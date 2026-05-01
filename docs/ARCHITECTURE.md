# 🏗️ NO BHAD CODES - ARCHITECTURE GUIDE

Enterprise-Level Client Management System with Portfolio

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Project Structure](#project-structure)
3. [Core Architecture](#core-architecture)
4. [Adding New Features](#adding-new-features)
5. [Module System](#module-system)
6. [Service Layer](#service-layer)
7. [Component System](#component-system)
8. [Styling Architecture](#styling-architecture)
9. [Build & Deployment](#build--deployment)
10. [Testing Strategy](#testing-strategy)
11. [Best Practices](#best-practices)

---

## 🎯 SYSTEM OVERVIEW

**No Bhad Codes** is a **solo freelance** client management system built with modern TypeScript. There is no team management — a single admin (the business owner) manages all operations.

- **The Backend (Portal System):**
  - **Client Portal** - Project tracking, file sharing, communication
  - **Admin Dashboard** - Client management, analytics, performance monitoring
- **Portfolio Showcase** - Project gallery with interactive business card
- **Scalable Architecture** - Dependency injection, modular design, service-oriented structure

### Technology Stack

- **Frontend**: TypeScript + React 19 + Zustand, Vite, GSAP
- **Portal Architecture**: React SPA, React Router v7, Zustand state management
- **Main Site Architecture**: Dependency Injection, Module Pattern, Service-Oriented
- **Styling**: CSS Modules, Design System, Responsive Design
- **Build**: Vite with advanced code splitting
- **Testing**: Vitest (unit), Playwright (e2e)

---

## 📁 PROJECT STRUCTURE

```text
no-bhad-codes/
├── 📄 HTML PAGES (Feature-Based)
│   ├── index.html                    # Main portfolio landing
│   ├── client/
│   │   ├── intake.html              # Terminal-style intake form
│   │   ├── portal.html               # Client management portal
│   │   └── set-password.html         # Invitation password setup
│   ├── admin/
│   │   └── index.html                # Admin dashboard
│   └── projects/
│       └── index.html                # Project showcase
│
├── 📁 src/ (SOURCE CODE)
│   ├── main-site.ts                 # Main site entry (index, intake)
│   ├── portal.ts                   # Client portal entry (portal, set-password)
│   ├── main.ts                     # Legacy/build entry (mockups, build.html)
│   │
│   ├── 🏗️ CORE ARCHITECTURE
│   │   ├── core/
│   │   │   ├── app.ts               # Application controller (refactored Dec 19)
│   │   │   ├── env.ts               # Environment/config helpers
│   │   │   ├── services-config.ts   # Service registrations
│   │   │   ├── modules-config.ts    # Module definitions
│   │   │   ├── debug.ts             # Development helpers
│   │   │   ├── container.ts         # Dependency injection
│   │   │   └── state/               # State management (refactored Dec 19)
│   │   │       ├── index.ts         # Re-exports
│   │   │       ├── types.ts         # Type definitions
│   │   │       ├── state-manager.ts # Generic StateManager class
│   │   │       └── app-state.ts     # App instance, middleware, reducers
│   │   │
│   │   ├── 🎯 FEATURES (Domain-Driven)
│   │   │   └── main-site/           # Main site (landing, contact, etc.)
│   │
│   ├── 🚀 REACT PORTAL (src/react/)
│   │   ├── app/
│   │   │   ├── PortalApp.tsx        # Root SPA with providers
│   │   │   ├── PortalRoutes.tsx     # All routes (lazy-loaded, role-based)
│   │   │   ├── PortalLayout.tsx     # Sidebar + header + main content
│   │   │   ├── PortalSidebar.tsx    # Navigation sidebar
│   │   │   ├── PortalHeader.tsx     # Global header
│   │   │   ├── mount-portal.tsx     # SPA mount factory
│   │   │   └── LazyTabRoute.tsx     # Lazy route wrapper
│   │   ├── stores/
│   │   │   └── portal-store.ts      # Zustand store (role, tab, theme, sidebar)
│   │   ├── hooks/
│   │   │   └── usePortalAuth.ts     # Auth hook (bridges HttpOnly JWT to React)
│   │   ├── features/
│   │   │   ├── admin/               # Admin-only feature modules (25+ features)
│   │   │   │   ├── clients/, contacts/, leads/, crm/
│   │   │   │   ├── projects/, project-detail/, tasks/
│   │   │   │   ├── invoices/, contracts/, proposals/
│   │   │   │   ├── files/, document-requests/, questionnaires/
│   │   │   │   ├── settings/, knowledge-base/, workflows/
│   │   │   │   ├── integrations/, data-quality/, analytics/
│   │   │   │   ├── modals/          # AdminModalsProvider + modal components
│   │   │   │   └── shared/          # Shared filter configs
│   │   │   └── portal/              # Client-only feature modules (15+ features)
│   │   │       ├── dashboard/, projects/, messages/, files/
│   │   │       ├── invoices/, contracts/, proposals/, approvals/
│   │   │       ├── questionnaires/, deliverables/, ad-hoc-requests/
│   │   │       ├── settings/, help/, onboarding/, preview/
│   │   │       └── shared/          # Shared filter configs
│   │   └── components/
│   │       └── portal/              # Shared React portal components
│   │           └── NotificationBell.tsx
│   │   │
│   │   ├── 🧩 MODULES (Reusable UI — under src/modules/)
│   │   │   ├── core/base.ts         # Base module class
│   │   │   ├── ui/                  # 7 files: navigation, footer, contact-form, business-card*, projects, submenu
│   │   │   ├── animation/           # 8 files: intro, intro-mobile, about-hero, base-hero, contact, page-hero, page-transition, text-animation
│   │   │   └── utilities/theme.ts  # Theme switching
│   │   │
│   │   ├── ⚙️ SERVICES (Business Logic — 9 files)
│   │   │   ├── auth-service.ts      # Authentication
│   │   │   ├── base-service.ts      # Base service class
│   │   │   ├── bundle-analyzer.ts   # Build analysis
│   │   │   ├── code-protection-service.ts
│   │   │   ├── contact-service.ts   # Communication
│   │   │   ├── data-service.ts      # Data management
│   │   │   ├── performance-service.ts
│   │   │   ├── router-service.ts    # Routing
│   │   │   └── visitor-tracking.ts  # Analytics/consent
│   │   │
│   │   ├── 🎨 COMPONENTS (UI Building Blocks — src/components/)
│   │   │   ├── index.ts                # Central registry (now modular)
│   │   │   ├── ui-components.ts        # UI primitives (buttons, modals, headers)
│   │   │   ├── dashboard-components.ts # Dashboard widgets (stats, activity, charts)
│   │   │   ├── form-components.ts      # Forms, inputs, validation
│   │   │   ├── table-components.ts     # Tables, lists, data views
│   │   │   ├── portal-components.ts    # Portal-specific UI
│   │   │   ├── state-components.ts     # Stateful components
│   │   │   ├── utility-components.ts   # Utility and helper components
│   │   │   ├── base-component.ts, modal-component.ts
│   │   │   ├── page-header.ts, page-title.ts, breadcrumbs.ts
│   │   │   ├── tab-router.ts, search-bar.ts, empty-state.ts
│   │   │   ├── quick-stats.ts, recent-activity.ts, timeline.ts
│   │   │   └── ... (analytics-dashboard, chart-simple, kanban-board, etc.)
│   │   │
│   ├── constants/
│   │   ├── business.ts            # Frontend mirror of server/config/business.ts
│   │   └── icons.ts               # Centralized SVG icons
│   ├── config/                    # App configuration (api, branding, constants)
│   ├── design-system/, types/, utils/
│   │
├── 📁 server/ (BACKEND — at repo root, sibling of src/)
│   ├── routes/                       # API routes (auth, admin, clients, projects, etc.)
│   ├── services/                     # Backend services
│   │   ├── analytics-service.ts      # BI analytics, KPIs, dashboards
│   │   ├── client-service.ts         # CRM, contacts, tags, health
│   │   ├── file-service.ts           # File management
│   │   ├── invoice-service.ts        # Invoicing, deposits, credits
│   │   ├── lead-service.ts           # Lead management, scoring
│   │   ├── message-service.ts        # Messaging, threads, subscriptions
│   │   ├── project-service.ts        # Project management, tasks
│   │   ├── proposal-service.ts       # Proposal templates, versioning
│   │   ├── scheduler-service.ts      # Invoice reminders, recurring, soft delete cleanup
│   │   ├── soft-delete-service.ts    # 30-day soft delete recovery system
│   │   ├── email-service.ts          # Email delivery
│   │   ├── cache-service.ts          # Redis caching
│   │   ├── approval-service.ts       # Approval workflows
│   │   ├── document-request-service.ts
│   │   ├── knowledge-base-service.ts
│   │   ├── workflow-trigger-service.ts
│   │   ├── timeline-service.ts
│   │   ├── notification-preferences-service.ts
│   │   └── logger.ts                 # Logging infrastructure
│   ├── database/                     # SQLite, migrations, init, query-helpers.ts
│   │   ├── migrations/               # Migration scripts
│   │   │   ├── 089_additional_performance_indexes.sql  # Index creation (2024)
│   │   │   └── ...
│   │   └── ...
│   ├── middleware/                   # auth, sanitization, audit, etc.
│   ├── config/                       # Swagger, environment
│   └── templates/                    # Email templates
│
├── 📁 CONFIG & BUILD
│   ├── vite.config.js               # Build configuration
│   ├── tsconfig.json               # TypeScript config
│   ├── package.json                # Dependencies
│   └── eslint.config.js            # Code quality
│
├── 📁 TESTING
│   ├── tests/e2e/                  # End-to-end tests
│   └── src/**/*.test.ts            # Unit tests
│
└── 📁 DOCUMENTATION
    ├── docs/
    │   ├── ARCHITECTURE.md          # This file
    │   ├── OPTIMIZATION.md          # Performance guide
    │   └── README.md               # Setup guide
    └── CLAUDE.md                   # AI assistant instructions
```

---

## 🏗️ CORE ARCHITECTURE

### 4. Component Registry Refactor (2024)

#### Modular Export Structure

The central component registry (`src/components/index.ts`) was split into logical group files for maintainability:

- `ui-components.ts`: UI primitives (buttons, modals, headers)
- `dashboard-components.ts`: Dashboard widgets (stats, activity, charts)
- `form-components.ts`: Forms, inputs, validation
- `table-components.ts`: Tables, lists, data views
- `portal-components.ts`: Portal-specific UI
- `state-components.ts`: Stateful components
- `utility-components.ts`: Utility and helper components

Each group file exports related components, and `index.ts` re-exports from these. This reduces file size and improves discoverability.

**Example:**

```typescript
// src/components/index.ts
export * from './ui-components';
export * from './dashboard-components';
export * from './form-components';
export * from './table-components';
export * from './portal-components';
export * from './state-components';
export * from './utility-components';
```

---

### 5. Database Migration Fixes

#### Migration Error Resolution

Migration script `089_additional_performance_indexes.sql` attempted to create indexes for tables that did not exist (`client_onboarding_progress`, `email_log`). These index creation statements were commented out to allow migrations to succeed. Ensure migration scripts match the current schema to avoid errors.

---

### 1. Application Bootstrap (`src/main.ts`)

#### Single entry point for the entire application

```typescript
// All HTML pages load this single file
import { app } from './core/app';

// Auto-initializes based on current page
// Handles module registration and DI container setup
```

### 2. Dependency Injection Container (`src/core/container.ts`)

#### Enterprise-level service management

```typescript
// Singleton pattern for service instances
container.singleton('DataService', async () => {
  const { DataService } = await import('../services/data-service');
  return new DataService();
});

// Service dependencies automatically resolved
container.register('ContactService', contactServiceFactory, {
  dependencies: ['DataService', 'ValidationService']
});
```

### 3. Module System (`src/modules/`)

#### Page-aware, lifecycle-managed UI modules

```typescript
export class MyModule extends BaseModule {
  // Automatic lifecycle management
  async onInit(): Promise<void> { }
  onDestroy(): void { }
  
  // Built-in error handling, logging, cleanup
}
```

---

## 🚀 ADDING NEW FEATURES

### 📄 Adding a New Page

#### Example: Adding an Invoicing System

#### Step 1: Create HTML File

```bash
# Create feature directory
mkdir invoicing

# Create HTML file
touch invoicing/index.html
```

```html
<!-- invoicing/index.html -->
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <title>Invoicing System - No Bhad Codes</title>
    <!-- Standard head content -->
</head>
<body>
    <!-- Your page content -->
    
    <!-- Load main application -->
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

#### Step 2: Update Vite Config

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        // ... existing entries
        invoicing: './invoicing/index.html'  // ← Add this
      }
    }
  }
})
```

#### Step 3: Create Feature Module

```bash
# Create feature directory
mkdir src/features/invoicing
touch src/features/invoicing/invoicing-module.ts
touch src/features/invoicing/invoice-generator.ts
```

```typescript
// src/features/invoicing/invoicing-module.ts
import { BaseModule } from '../../modules/base';
import type { Invoice } from '../../types/invoice';

export class InvoicingModule extends BaseModule {
  constructor() {
    super('invoicing');
  }

  protected override async onInit(): Promise<void> {
    // Only initialize on invoicing pages
    const path = window.location.pathname;
    if (!path.includes('/invoicing')) return;

    this.cacheElements();
    this.setupEventListeners();
    await this.loadInvoices();
  }

  private async loadInvoices(): Promise<void> {
    // Your invoicing logic here
  }
}
```

#### Step 4: Register Module in Core App

```typescript
// src/core/app.ts - Add to setupModules()
{
  name: 'InvoicingModule',
  type: 'dom',
  factory: async () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/invoicing')) {
      const { InvoicingModule } = await import('../features/invoicing/invoicing-module');
      return new InvoicingModule();
    }
    return createDummyModule('InvoicingModule');
  }
}
```

#### Step 5: Create Types

```typescript
// src/types/invoice.ts
export interface Invoice {
  id: string;
  clientId: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}
```

#### Step 6: Create Services (if needed)

```typescript
// src/services/invoice-service.ts
export class InvoiceService extends BaseService {
  async generateInvoice(data: InvoiceData): Promise<Invoice> {
    // Invoice generation logic
  }
  
  async sendInvoice(invoiceId: string): Promise<void> {
    // Email sending logic
  }
}
```

#### Step 7: Add Styles

```css
/* src/styles/invoicing.css */
.invoice-container {
  /* Your invoicing styles */
}
```

---

## 🧩 MODULE SYSTEM

### Creating a New Module

#### Modules are self-contained UI components with lifecycle management

```typescript
// src/modules/my-new-module.ts
import { BaseModule } from './base';
import { gsap } from 'gsap';

interface MyModuleConfig {
  containerId: string;
  animationDuration: number;
}

export class MyNewModule extends BaseModule {
  private config: MyModuleConfig;
  private container: HTMLElement | null = null;

  constructor(config: Partial<MyModuleConfig> = {}) {
    super('my-new-module');
    
    this.config = {
      containerId: 'my-container',
      animationDuration: 0.5,
      ...config
    };
  }

  // Required: Initialize the module
  protected override async onInit(): Promise<void> {
    this.cacheElements();
    this.setupEventListeners();
    this.setupAnimations();
  }

  // Required: Cleanup when module is destroyed
  protected override onDestroy(): void {
    // Remove event listeners
    // Kill GSAP timelines
    // Clear intervals/timeouts
  }

  private cacheElements(): void {
    this.container = this.getElement(
      'My Container', 
      `#${this.config.containerId}`,
      false // not required
    );
  }

  private setupEventListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('click', this.handleClick.bind(this));
  }

  private setupAnimations(): void {
    if (!this.container) return;

    gsap.fromTo(this.container, 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: this.config.animationDuration }
    );
  }

  private handleClick(event: Event): void {
    // Handle clicks
  }
}
```

### Module Registration Patterns

```typescript
// src/core/modules-config.ts - Different registration patterns

// 1. PAGE-SPECIFIC MODULE (only loads on certain pages)
// The portal is a React SPA mounted into a server-rendered EJS shell.
{
  name: 'ReactPortalModule',
  type: 'dom',
  factory: async () => {
    const path = window.location.pathname;
    const isPortalPage = path.includes('/dashboard') || path.includes('/admin');
    if (isPortalPage) {
      const { mountPortalApp } = await import('../react/app/mount-portal');
      const container = document.querySelector('.portal') as HTMLElement;
      const cleanup = container ? mountPortalApp(container) : () => {};
      return { init: () => {}, destroy: cleanup, name: 'ReactPortalModule' };
    }
    return createDummyModule('ReactPortalModule');
  }
}

// 2. GLOBAL MODULE (loads on all pages)
{
  name: 'ThemeModule',
  type: 'dom',
  factory: async () => {
    const { ThemeModule } = await import('../modules/theme');
    return new ThemeModule({ debug: this.debug });
  }
}

// 3. CONDITIONAL MODULE (loads based on DOM elements)
{
  name: 'ContactFormModule',
  type: 'dom',
  factory: async () => {
    if (document.getElementById('contact-form')) {
      const { ContactFormModule } = await import('../modules/contact-form');
      return new ContactFormModule();
    }
    return createDummyModule('ContactFormModule');
  }
}

// 4. MODULE WITH DEPENDENCIES
{
  name: 'BusinessCardModule',
  type: 'dom',
  factory: async () => {
    const { BusinessCardModule } = await import('../modules/business-card');
    const dataService = await container.resolve('DataService');
    return new BusinessCardModule({ dataService });
  },
  dependencies: ['DataService']
}
```

---

## ⚙️ SERVICE LAYER

### Creating a New Service

#### Services handle business logic and data operations

```typescript
// src/services/notification-service.ts
import { BaseService } from './base-service';

interface NotificationConfig {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration: number;
  maxNotifications: number;
}

export class NotificationService extends BaseService {
  private config: NotificationConfig;
  private notifications: Map<string, HTMLElement> = new Map();

  constructor(config: Partial<NotificationConfig> = {}) {
    super('notification-service');
    
    this.config = {
      position: 'top-right',
      duration: 5000,
      maxNotifications: 5,
      ...config
    };
  }

  async show(message: string, type: 'success' | 'error' | 'info' = 'info'): Promise<string> {
    const id = this.generateId();
    const notification = this.createNotification(id, message, type);
    
    this.notifications.set(id, notification);
    this.addToDOM(notification);
    
    // Auto-remove after duration
    setTimeout(() => this.remove(id), this.config.duration);
    
    return id;
  }

  async remove(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (!notification) return;

    // Animate out
    await this.animateOut(notification);
    
    // Remove from DOM and map
    notification.remove();
    this.notifications.delete(id);
  }

  private createNotification(id: string, message: string, type: string): HTMLElement {
    // Create notification element
  }

  private async animateOut(element: HTMLElement): Promise<void> {
    // GSAP animation
  }
}
```

### Service Registration

```typescript
// src/core/app.ts - Register service in setupServices()
container.register('NotificationService', async () => {
  const { NotificationService } = await import('../services/notification-service');
  return new NotificationService({
    position: 'top-right',
    duration: 4000
  });
}, { singleton: true });
```

### Using Services in Modules

```typescript
// src/modules/my-module.ts
export class MyModule extends BaseModule {
  private notificationService?: NotificationService;

  protected override async onInit(): Promise<void> {
    // Resolve service from container
    this.notificationService = await container.resolve('NotificationService');
  }

  private async showSuccess(): Promise<void> {
    if (this.notificationService) {
      await this.notificationService.show('Operation completed!', 'success');
    }
  }
}
```

---

## 🎨 COMPONENT SYSTEM

### Creating Reusable Components

```typescript
// src/components/data-table.ts
import { BaseComponent } from './base-component';

interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  render?: (value: any, row: any) => string;
}

interface DataTableConfig {
  columns: TableColumn[];
  data: any[];
  sortable?: boolean;
  searchable?: boolean;
  pagination?: boolean;
  pageSize?: number;
}

export class DataTable extends BaseComponent<DataTableConfig> {
  private tableElement: HTMLElement | null = null;
  private currentSort: { column: string; direction: 'asc' | 'desc' } | null = null;

  protected override getDefaultConfig(): DataTableConfig {
    return {
      columns: [],
      data: [],
      sortable: true,
      searchable: true,
      pagination: true,
      pageSize: 10
    };
  }

  protected override async onInit(): Promise<void> {
    this.createTable();
    this.setupEventListeners();
  }

  public updateData(data: any[]): void {
    this.config.data = data;
    this.render();
  }

  private createTable(): void {
    this.tableElement = document.createElement('div');
    this.tableElement.className = 'data-table';
    this.container.appendChild(this.tableElement);
    
    this.render();
  }

  private render(): void {
    if (!this.tableElement) return;

    const html = `
      ${this.config.searchable ? this.renderSearch() : ''}
      ${this.renderTable()}
      ${this.config.pagination ? this.renderPagination() : ''}
    `;
    
    this.tableElement.innerHTML = html;
  }

  private renderTable(): string {
    return `
      <table class="table">
        <thead>
          ${this.renderHeader()}
        </thead>
        <tbody>
          ${this.renderBody()}
        </tbody>
      </table>
    `;
  }

  private renderHeader(): string {
    return this.config.columns
      .map(column => `
        <th class="${column.sortable ? 'sortable' : ''}" 
            data-column="${column.key}">
          ${column.title}
          ${this.renderSortIcon(column.key)}
        </th>
      `).join('');
  }

  private renderBody(): string {
    return this.config.data
      .map(row => `
        <tr>
          ${this.config.columns.map(column => `
            <td>${this.renderCell(column, row)}</td>
          `).join('')}
        </tr>
      `).join('');
  }

  private renderCell(column: TableColumn, row: any): string {
    const value = row[column.key];
    return column.render ? column.render(value, row) : String(value);
  }
}
```

### Using Components in Modules

```typescript
// src/modules/admin-users.ts
import { DataTable } from '../components/data-table';

export class AdminUsersModule extends BaseModule {
  private dataTable?: DataTable;

  protected override async onInit(): Promise<void> {
    const container = this.getElement('Users Table', '#users-table-container');
    if (!container) return;

    this.dataTable = new DataTable(container, {
      columns: [
        { key: 'name', title: 'Name', sortable: true },
        { key: 'email', title: 'Email', sortable: true },
        { key: 'status', title: 'Status', render: this.renderStatus },
        { key: 'actions', title: 'Actions', render: this.renderActions }
      ],
      data: await this.loadUsers()
    });

    await this.dataTable.init();
  }

  private renderStatus(value: string): string {
    return `<span class="status status-${value}">${value}</span>`;
  }

  private renderActions(value: any, row: any): string {
    return `
      <button onclick="editUser('${row.id}')">Edit</button>
      <button onclick="deleteUser('${row.id}')">Delete</button>
    `;
  }
}
```

---

## 🎨 STYLING ARCHITECTURE

### CSS Organization

#### Modular Architecture (Updated February 2026)

```text
src/styles/
├── main.css                     # Modular entry point
├── base/                        # Foundation layer
│   ├── fonts.css               # @font-face definitions (imported first)
│   ├── reset.css               # CSS reset & normalize
│   ├── typography.css          # Typography system
│   └── layout.css              # Layout primitives
├── components/                  # Component layer
│   ├── form-fields.css         # Form inputs
│   ├── form-buttons.css        # Button styles
│   ├── form-validation.css     # Validation states
│   ├── nav-base.css            # Navigation base
│   ├── nav-animations.css      # Nav animations
│   ├── nav-responsive.css      # Mobile navigation
│   ├── nav-portal.css          # Portal dropdowns
│   ├── business-card.css       # Interactive business card
│   └── loading.css             # Loading states
├── client-portal/              # Client portal (modular)
│   ├── index.css               # Import orchestrator
│   └── (10 modular files)      # components, layout, sidebar, etc.
├── shared/                     # Shared portal components
│   ├── portal-buttons.css
│   ├── portal-cards.css
│   ├── portal-forms.css
│   ├── portal-badges.css
│   └── (8 more files)          # layout, messages, files, etc.
├── admin/                      # Admin dashboard styles
│   ├── index.css
│   └── (4 files)               # analytics, client-detail, etc.
├── pages/                      # Page-specific layer
│   ├── contact.css
│   ├── admin.css
│   ├── client.css
│   └── projects.css
└── design-system/              # Design tokens
    ├── index.css               # Design system entry
    └── tokens/
        ├── colors.css          # 381 lines - Complete color system
        ├── typography.css      # 283 lines - Type scale
        ├── spacing.css         # 437 lines - Spacing scale
        ├── animations.css      # 455 lines - Animation presets
        ├── shadows.css         # 218 lines - Elevation system
        ├── borders.css         # 200 lines - Border styles
        ├── breakpoints.css     # 536 lines - Responsive breakpoints
        └── z-index.css         # 305 lines - Stacking context
```

#### Key Improvements:

- **Font Loading**: `fonts.css` imported first for proper font availability
- **Navigation Split**: `navigation.css` split into 4 focused files
- **Form Split**: Forms split into fields, buttons, validation
- **Client Portal Modular**: 10 files in `client-portal/` directory
- **Shared Components**: Reusable portal components in `shared/`
- **Portal Prefix**: Uses `.portal-` prefix (not `.cp-`) for consistency

### Adding New Styles

#### 1. Design Token Pattern

```css
/* src/design-system/tokens/colors.css */
:root {
  /* Brand Colors */
  --color-primary: #00ff41;
  --color-primary-light: rgba(0, 255, 65, 0.1);
  --color-primary-dark: #00cc34;
  
  /* Semantic Colors */
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;
  --color-info: #3b82f6;
  
  /* Neutral Scale */
  --color-neutral-50: #fafafa;
  --color-neutral-100: #f5f5f5;
  --color-neutral-200: #e5e5e5;
  --color-neutral-300: #d4d4d4;
  --color-neutral-400: #a3a3a3;
  --color-neutral-500: #737373;
  --color-neutral-600: #525252;
  --color-neutral-700: #404040;
  --color-neutral-800: #262626;
  --color-neutral-900: #171717;
}
```

#### 2. Feature-Specific Styles

```css
/* src/styles/invoicing.css */
@import '../design-system/index.css';

.invoice-container {
  background: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.invoice-status {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.invoice-status--draft {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.invoice-status--sent {
  background: var(--color-info-light);
  color: var(--color-info-dark);
}

.invoice-status--paid {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}
```

#### 3. Component Styles

```css
/* src/components/data-table.css */
.data-table {
  width: 100%;
  background: var(--color-neutral-50);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.data-table__search {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-neutral-200);
}

.data-table__table {
  width: 100%;
  border-collapse: collapse;
}

.data-table__th {
  padding: var(--space-3) var(--space-4);
  background: var(--color-neutral-100);
  font-weight: var(--font-semibold);
  text-align: left;
  border-bottom: 1px solid var(--color-neutral-200);
}

.data-table__th--sortable {
  cursor: pointer;
  user-select: none;
}

.data-table__th--sortable:hover {
  background: var(--color-neutral-200);
}

.data-table__td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-neutral-100);
}

.data-table__row:last-child .data-table__td {
  border-bottom: none;
}
```

---

## 🚀 BUILD & DEPLOYMENT

### Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // Multi-entry configuration
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'client-landing': './client/landing.html',
        'client-portal': './client/portal.html',
        admin: './admin/index.html',
        projects: './projects/index.html'
      },
      output: {
        // Advanced code splitting
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('gsap')) return 'vendor-gsap';
            return 'vendor-libs';
          }
          
          if (id.includes('src/features/admin/')) return 'admin';
          if (id.includes('src/features/client/')) return 'client';
          if (id.includes('src/core/')) return 'core';
          if (id.includes('src/services/')) return 'services';
          if (id.includes('src/components/')) return 'components';
        }
      }
    },
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false
  },
  
  server: {
    port: 4000,
    open: true
  },
  
  // Pre-bundle optimization
  optimizeDeps: {
    include: ['gsap'],
    exclude: []
  }
});
```

### Environment-Specific Builds

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## 🧪 TESTING STRATEGY

### Unit Testing (Vitest)

```typescript
// src/services/notification-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from './notification-service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    document.body.innerHTML = ''; // Clear DOM
  });

  it('should show notification', async () => {
    const id = await service.show('Test message', 'info');
    
    expect(id).toBeTruthy();
    expect(document.querySelectorAll('.notification')).toHaveLength(1);
  });

  it('should remove notification after duration', async () => {
    vi.useFakeTimers();
    
    const id = await service.show('Test message', 'info');
    
    vi.advanceTimersByTime(5000);
    
    expect(document.querySelectorAll('.notification')).toHaveLength(0);
    
    vi.useRealTimers();
  });
});
```

### E2E Testing (Playwright)

```typescript
// tests/e2e/client-portal.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Client Portal', () => {
  test('should login and access dashboard', async ({ page }) => {
    await page.goto('/client/portal');
    
    // Login
    await page.fill('#client-email', 'demo@example.com');
    await page.fill('#client-password', 'password123');
    await page.click('#login-btn');
    
    // Should redirect to dashboard
    await expect(page.locator('#dashboard-section')).toBeVisible();
    await expect(page.locator('#login-section')).toBeHidden();
  });

  test('should display project information', async ({ page }) => {
    // Login first
    await page.goto('/client/portal');
    await page.fill('#client-email', 'demo@example.com');
    await page.fill('#client-password', 'password123');
    await page.click('#login-btn');
    
    // Check project details
    await page.click('.project-item:first-child');
    await expect(page.locator('#project-title')).toContainText('E-commerce');
    await expect(page.locator('#project-status')).toBeVisible();
  });
});
```

---

## 📋 BEST PRACTICES

### 1. File Naming Conventions

```bash
# Modules (PascalCase classes, kebab-case files)
src/modules/business-card-renderer.ts   → BusinessCardRenderer
src/react/app/mount-portal.tsx          → mountPortalApp (React SPA mount)

# Services (PascalCase classes, kebab-case files)
src/services/notification-service.ts    → NotificationService
src/services/data-service.ts            → DataService

# Components (PascalCase classes, kebab-case files)
src/components/data-table.ts            → DataTable
src/components/modal-component.ts       → ModalComponent

# Types (PascalCase interfaces, kebab-case files)
src/types/client.ts                     → ClientProject, ClientMessage
src/types/invoice.ts                    → Invoice, InvoiceItem

# Styles (kebab-case)
src/styles/portal/client/index.css   # Client portal styles entry point
src/styles/pages/admin.css
```

### 2. TypeScript Best Practices

```typescript
// ✅ Good: Specific interfaces
interface ClientProject {
  id: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

// ✅ Good: Generic constraints
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// ✅ Good: Utility types
type PartialProject = Partial<ClientProject>;
type ProjectStatus = ClientProject['status'];

// ❌ Bad: Any types (avoid this pattern)
const data: any = getProjectData();

// ✅ Good: Use type-safe database row helpers
import { getString, getNumber } from '../database/row-helpers.js';
const project = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
const projectName = getString(project, 'name');
const projectId = getNumber(project, 'id');

// ❌ Bad: Unclear interfaces
interface Project {
  data: any;
  stuff: unknown;
}
```

### 3. Module Organization

```typescript
// ✅ Good: Clear separation of concerns
class ClientPortalModule extends BaseModule {
  // Properties first
  private isLoggedIn = false;
  private currentProject: ClientProject | null = null;

  // Constructor
  constructor() {
    super('client-portal');
  }

  // Lifecycle methods
  protected override async onInit(): Promise<void> { }
  protected override onDestroy(): void { }

  // Public methods
  public login(credentials: LoginCredentials): Promise<void> { }
  public logout(): void { }

  // Private methods (grouped by functionality)
  private cacheElements(): void { }
  private setupEventListeners(): void { }
  private setupAnimations(): void { }
}
```

### 4. Error Handling

```typescript
// ✅ Good: Comprehensive error handling
class DataService extends BaseService {
  async fetchProject(id: string): Promise<ClientProject> {
    try {
      const response = await fetch(`/api/projects/${id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!this.validateProject(data)) {
        throw new Error('Invalid project data received');
      }
      
      return data;
    } catch (error) {
      this.logError('fetchProject', error);
      
      if (error instanceof NetworkError) {
        throw new Error('Network connection failed');
      }
      
      if (error instanceof ValidationError) {
        throw new Error('Invalid project data');
      }
      
      throw new Error('Failed to fetch project');
    }
  }

  private validateProject(data: unknown): data is ClientProject {
    return typeof data === 'object' &&
           data !== null &&
           'id' in data &&
           'status' in data;
  }
}
```

### 5. Performance Optimization

```typescript
// ✅ Good: Lazy loading with dynamic imports
async loadModule(name: string): Promise<BaseModule> {
  switch (name) {
    case 'admin':
      const { AdminModule } = await import('./features/admin/admin-module');
      return new AdminModule();
    
    case 'client-portal':
      const { ClientPortalModule } = await import('./features/client/client-portal');
      return new ClientPortalModule();
    
    default:
      throw new Error(`Unknown module: ${name}`);
  }
}

// ✅ Good: Debounced user input
class SearchModule extends BaseModule {
  private searchDebounced = this.debounce(this.performSearch.bind(this), 300);

  private setupSearch(): void {
    const searchInput = this.getElement('Search', '#search-input');
    searchInput?.addEventListener('input', this.searchDebounced);
  }

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
}
```

---

## 🎯 DEVELOPMENT WORKFLOW

### 1. Starting a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/new-invoicing-system

# 2. Create feature directory
mkdir src/features/invoicing

# 3. Create main files
touch src/features/invoicing/invoicing-module.ts
touch src/features/invoicing/invoice-generator.ts
touch src/types/invoice.ts
touch src/styles/invoicing.css

# 4. Create tests
touch src/features/invoicing/invoicing-module.test.ts
touch tests/e2e/invoicing.spec.ts
```

### 2. Development Process

```bash
# 1. Install dependencies if needed
npm install new-dependency

# 2. Start development server
npm run dev

# 3. Run tests during development
npm run test

# 4. Check TypeScript types
npm run type-check

# 5. Run linting
npm run lint

# 6. Format code
npm run format
```

### 3. Before Committing

```bash
# 1. Run all checks
npm run lint
npm run type-check
npm run test:run

# 2. Build to ensure no issues
npm run build

# 3. Run E2E tests
npm run test:e2e

# 4. Commit with conventional commits
git commit -m "feat: add invoicing system with PDF generation"
```

---

## 🚀 DEPLOYMENT

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy (example with Netlify)
netlify deploy --prod --dir=dist
```

### Environment Variables

```bash
# Vercel Environment Variables
VITE_API_URL=https://no-bhad-codes-production.up.railway.app
SENTRY_DSN=<your-sentry-dsn>
VITE_ADMIN_PASSWORD_HASH=<sha256-hash-of-admin-password>
```

---

## 📚 RESOURCES

### Key Files to Understand

- `src/main.ts` - Application entry point
- `src/core/app.ts` - Application controller
- `src/core/container.ts` - Dependency injection
- `src/modules/base.ts` - Base module class
- `vite.config.js` - Build configuration

### Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Production build
npm run preview            # Preview build
npm run type-check         # TypeScript check
npm run lint               # ESLint check
npm run format             # Prettier format
npm run test               # Run tests
npm run test:e2e           # E2E tests

# Analysis
npm run bundle-analyzer    # Analyze bundle size
npm run audit              # Security audit
```

---

## 🔍 CODEBASE HEALTH

### Last Code Review: February 17, 2026

### Critical Issues

|File|Issue|Status|
|------|-------|--------|
|`src/modules/navigation.ts`|15+ console.log calls, untracked event listeners|FIXED|
|Dead code cleanup|app.ts.backup, unused entry points|FIXED (Jan 15, 2026)|
|Console logging|~80+ console.log statements in production code|FIXED (Jan 15, 2026 - refactored to debug logger)|
|`src/modules/animation/intro-animation.ts`|400+ lines, hardcoded SVG paths|FIXED (refactored Dec 19, SVG paths in config)|
|`src/services/code-protection-service.ts`|Event listener cleanup issues|FIXED|
|`src/features/admin/admin-security.ts`|localStorage for auth data|FIXED (all modules migrated to HttpOnly cookies)|
|Animation CSS conflicts|CSS transitions conflicting with GSAP|FIXED (Dec 22)|
|Font loading issues|Acme font not displaying|FIXED (Dec 22, fonts.css imported first)|

### Files Exceeding Size Guidelines (300 lines)

|File|Lines|Status|
|------|-------|--------|
|`src/core/app.ts`|452|FIXED - Split Dec 19 (was 992 lines, now 4 files)|
|`src/core/state/`|4 files|FIXED - Split Dec 19 (was 824 lines in state.ts)|
|`src/services/visitor-tracking.ts`|730|Pending - Split by tracking concern|
|`src/features/admin/admin-dashboard.ts`|~200|FIXED - Split Jan 20, 2026 (was 1886 lines)|
|`src/features/admin/modules/`|28 files|FIXED - Extracted from admin-dashboard.ts|
|`src/styles/components/nav-*.css`|4 files|FIXED - Split Dec 19 (was 1792 lines)|
|`src/styles/client-portal/`|10 files|FIXED - Split into modular directory|
|`src/modules/animation/intro-animation.ts`|1569|Large but organized|

#### December 22, 2025 Animation Improvements:

- Removed CSS transitions conflicting with GSAP animations
- Fixed intro nav links to use GSAP fade instead of CSS keyframes
- Implemented contact section blur animation sequence
- Added coyote paw entry animation for home page navigation
- Created `fonts.css` for proper font loading order

#### December 19, 2025 Refactoring Summary:

- `app.ts` (992 lines) → `app.ts` (452), `services-config.ts` (125), `modules-config.ts` (326), `debug.ts` (155)
- `state.ts` (824 lines) → `state/types.ts` (67), `state/state-manager.ts` (491), `state/app-state.ts` (172), `state/index.ts` (22)
- `navigation.css` (1792 lines) → `nav-base.css`, `nav-animations.css`, `nav-responsive.css`, `nav-portal.css`

#### January 20, 2026 Refactoring Summary:

Major refactoring completed for admin dashboard and shared infrastructure:

- `admin-dashboard.ts` (1886 lines) → Split into coordinator + services + renderers:
  - `admin-dashboard.ts` (~200 lines) - Main coordinator only
  - `services/admin-data.service.ts` - Data fetching and caching with TTL
  - `services/admin-chart.service.ts` - Chart.js integration
  - `services/admin-export.service.ts` - CSV/data export
  - `renderers/admin-contacts.renderer.ts` - Contact table and modal rendering
  - `renderers/admin-messaging.renderer.ts` - Messaging UI and thread rendering
- Added TypeScript interfaces in `/src/types/` and `/server/types/`
- Consolidated logging system in `/shared/logging/` and facades
- Centralized auth state in `/src/auth/`
- Shared validation patterns in `/shared/validation/`

### Server Code Status

The server code (`/server/`) is **production-ready** with excellent architecture:

- Comprehensive middleware stack (auth, validation, security, caching)
- Well-designed service layer with proper separation of concerns
- SQLite with connection pooling and migrations
- Redis caching support
- Sentry error tracking integration
- **HttpOnly cookie authentication** (XSS-protected token storage)
- **Soft delete system** with 30-day recovery window (February 6, 2026)

### Authentication Architecture (Updated December 17, 2025)

The system uses **HttpOnly cookies** for secure JWT token storage:

```text
┌─────────────┐     POST /api/auth/login      ┌─────────────┐
│   Client    │ ──────────────────────────────▶│   Server    │
│   Browser   │                                │             │
│             │◀────────────────────────────── │             │
└─────────────┘   Set-Cookie: auth_token=JWT  └─────────────┘
                  (HttpOnly, Secure, SameSite)

┌─────────────┐     GET /api/protected        ┌─────────────┐
│   Client    │ ──────────────────────────────▶│   Server    │
│   Browser   │   Cookie: auth_token=JWT      │             │
│             │   (sent automatically)        │             │
└─────────────┘                               └─────────────┘
```

#### Key Files:

|File|Purpose|
|------|---------|
|`server/utils/auth-constants.ts`|Cookie configuration (COOKIE_CONFIG)|
|`server/middleware/auth.ts`|Token verification from cookie or header|
|`server/routes/auth.ts`|Login/logout endpoints set/clear cookies|
|`src/services/auth-service.ts`|Client-side auth state (no token access)|

#### Security Features:

- `httpOnly: true` - JavaScript cannot access the token
- `secure: true` (production) - Only sent over HTTPS
- `sameSite: 'strict'` - CSRF protection
- Shorter expiry for admin tokens (1 hour vs 7 days)

#### Remaining Work:

- Admin dashboard modules still use Authorization headers (lower priority)

### CSS Architecture Status (Updated February 2, 2026)

Token system is excellent and now consistently used:

- Hardcoded `#000` values migrated to `var(--color-black)` (27 instances)
- Legacy `--fg`/`--bg` variables migrated to semantic tokens (65+ instances)
- CSS files split into modular components
- Navigation CSS split into 4 files (`nav-base`, `nav-animations`, `nav-responsive`, `nav-portal`)
- Form CSS split into 3 files (`form-fields`, `form-buttons`, `form-validation`)
- Created `fonts.css` for proper font loading (imported first)
- Client portal uses `.portal-` prefix for component classes
- Client portal modularized into 10 files in `src/styles/client-portal/`
- Shared portal components in `src/styles/shared/`
- See `/docs/design/DESIGN_SYSTEM.md` for detailed findings

---

This architecture supports enterprise-level client management while maintaining developer productivity and code quality. Each pattern and practice has been battle-tested in production environments.
