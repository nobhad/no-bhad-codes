# 🏗️ NO BHAD CODES - ARCHITECTURE GUIDE

**Enterprise-Level Client Management System with Portfolio**

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

**No Bhad Codes** is a sophisticated client management system built with modern TypeScript, featuring:

- **Client Portal** - Project tracking, file sharing, communication
- **Admin Dashboard** - Client management, analytics, performance monitoring
- **Portfolio Showcase** - Project gallery with interactive business card
- **Enterprise Architecture** - Dependency injection, modular design, scalable structure

### Technology Stack

- **Frontend**: TypeScript, Vite, GSAP
- **Architecture**: Dependency Injection, Module Pattern, Service-Oriented
- **Styling**: CSS Modules, Design System, Responsive Design
- **Build**: Vite with advanced code splitting
- **Testing**: Vitest (unit), Playwright (e2e)

---

## 📁 PROJECT STRUCTURE

```
no-bhad-codes/
├── 📄 HTML PAGES (Feature-Based)
│   ├── index.html                    # Main portfolio landing
│   ├── client/
│   │   ├── landing.html             # Client onboarding
│   │   └── portal.html              # Client management portal
│   ├── admin/
│   │   └── index.html               # Admin dashboard
│   └── projects/
│       └── index.html               # Project showcase
│
├── 📁 src/ (SOURCE CODE)
│   ├── main.ts                      # 🚀 SINGLE ENTRY POINT
│   │
│   ├── 🏗️ CORE ARCHITECTURE
│   │   ├── core/
│   │   │   ├── app.ts               # Application controller
│   │   │   ├── container.ts         # Dependency injection
│   │   │   └── state.ts             # Global state management
│   │   │
│   │   ├── 🎯 FEATURES (Domain-Driven)
│   │   │   ├── admin/               # Admin management
│   │   │   │   ├── admin-dashboard.ts
│   │   │   │   └── admin-security.ts
│   │   │   ├── client/              # Client portal
│   │   │   │   └── client-portal.ts
│   │   │   └── projects/            # Project management
│   │   │
│   │   ├── 🧩 MODULES (Reusable UI)
│   │   │   ├── base.ts              # Base module class
│   │   │   ├── navigation.ts        # Site navigation
│   │   │   ├── theme.ts             # Theme switching
│   │   │   ├── business-card-renderer.ts
│   │   │   └── contact-form.ts
│   │   │
│   │   ├── ⚙️ SERVICES (Business Logic)
│   │   │   ├── data-service.ts      # Data management
│   │   │   ├── contact-service.ts   # Communication
│   │   │   ├── performance-service.ts
│   │   │   └── visitor-tracking.ts
│   │   │
│   │   ├── 🎨 COMPONENTS (UI Building Blocks)
│   │   │   ├── base-component.ts
│   │   │   ├── modal-component.ts
│   │   │   └── performance-dashboard.ts
│   │   │
│   │   ├── 📝 TYPES (TypeScript Definitions)
│   │   │   ├── client.ts            # Client portal types
│   │   │   ├── project.ts           # Project types
│   │   │   └── modules.ts           # Module system types
│   │   │
│   │   ├── 🎨 STYLES (Modular CSS Architecture)
│   │   │   ├── main.css         # New modular CSS entry point
│   │   │   ├── base/                # Foundation layer
│   │   │   │   ├── reset.css        # CSS reset & normalize
│   │   │   │   ├── typography.css   # Typography system
│   │   │   │   └── layout.css       # Layout primitives
│   │   │   ├── components/          # Component-specific styles
│   │   │   │   ├── form.css         # Consolidated form system
│   │   │   │   ├── navigation.css   # Navigation & menus
│   │   │   │   ├── business-card.css # Interactive business card
│   │   │   │   └── loading.css      # Loading states
│   │   │   └── pages/               # Page-specific overrides
│   │   │       ├── contact.css      # Contact page styles
│   │   │       ├── admin.css        # Admin dashboard
│   │   │       ├── client.css       # Client portal
│   │   │       └── projects.css     # Project showcase
│   │   │
│   │   ├── 🎨 DESIGN SYSTEM
│   │   │   ├── index.css
│   │   │   └── tokens/
│   │   │       ├── colors.css
│   │   │       ├── typography.css
│   │   │       ├── spacing.css
│   │   │       └── animations.css
│   │   │
│   │   └── 🛠️ UTILS (Helper Functions)
│   │       ├── sanitization-utils.ts
│   │       └── obfuscation-utils.ts
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

### 1. Application Bootstrap (`src/main.ts`)

**Single entry point for the entire application**

```typescript
// All HTML pages load this single file
import { app } from './core/app';

// Auto-initializes based on current page
// Handles module registration and DI container setup
```

### 2. Dependency Injection Container (`src/core/container.ts`)

**Enterprise-level service management**

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

**Page-aware, lifecycle-managed UI modules**

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

**Example: Adding an Invoicing System**

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

**Modules are self-contained UI components with lifecycle management**

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
// src/core/app.ts - Different registration patterns

// 1. PAGE-SPECIFIC MODULE (only loads on certain pages)
{
  name: 'ClientPortalModule',
  type: 'dom',
  factory: async () => {
    const path = window.location.pathname;
    if (path.includes('/client') && path.includes('/portal')) {
      const { ClientPortalModule } = await import('../features/client/client-portal');
      return new ClientPortalModule();
    }
    return createDummyModule('ClientPortalModule');
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

**Services handle business logic and data operations**

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

**New Modular Architecture (2024)**

```scss
// Layered CSS Architecture
src/styles/
├── main.css                 // New modular entry point
├── base/                        // Foundation layer
│   ├── reset.css               // CSS reset & normalize
│   ├── typography.css          // Typography system
│   └── layout.css              // Layout primitives
├── components/                  // Component layer
│   ├── form.css                // Consolidated form system
│   ├── navigation.css          // Navigation & menus
│   ├── business-card.css       // Interactive business card
│   ├── loading.css             // Loading states
│   └── portfolio-carousel.css  // Portfolio component
├── pages/                       // Page-specific layer
│   ├── contact.css             // Contact page overrides
│   ├── admin.css               // Admin dashboard
│   ├── client.css              // Client portal
│   └── projects.css            // Project showcase
└── design-system/               // Design tokens (existing)
    ├── index.css               // Design system entry
    └── tokens/
        ├── colors.css          // Color palette
        ├── typography.css      // Font scales, weights
        ├── spacing.css         // Margin, padding scales
        ├── borders.css         // Border styles, radius
        ├── shadows.css         // Box shadow tokens
        ├── animations.css      // Animation presets
        ├── breakpoints.css     // Media query breakpoints
        └── z-index.css        // Z-index scale
```

**Key Improvements:**
- **Consolidated Form System**: All form styles in `components/form.css`
- **Proper Layering**: Base → Components → Pages → Design System  
- **Eliminated Duplication**: Single import in `main.css`
- **Better Organization**: Logical separation by function

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
    port: 3000,
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
src/modules/client-portal.ts            → ClientPortalModule

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
src/styles/pages/client-portal.css
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

// ❌ Bad: Any types
const data: any = getProjectData();

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

**This architecture supports enterprise-level client management while maintaining developer productivity and code quality. Each pattern and practice has been battle-tested in production environments.**