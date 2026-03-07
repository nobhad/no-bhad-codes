/**
 * ===============================================
 * PORTAL FEATURE MODULE BASE CLASS
 * ===============================================
 * @file src/features/shared/PortalFeatureModule.ts
 *
 * Base class for all portal feature modules.
 * Provides capability-driven rendering and common functionality
 * that adapts based on user role.
 *
 * CORE PRINCIPLE: All UI rendering is driven by capabilities,
 * not hardcoded role checks.
 */

import { BaseModule } from '../../modules/core/base';
import type { FeatureCapabilities } from '../../../server/config/unified-navigation';
import type {
  PortalContext,
  ModuleState,
  DataItem,
  ToolbarConfig,
  ActionConfig,
  ColumnDef,
  PaginationParams
} from './types';

/**
 * Abstract base class for portal feature modules
 *
 * All feature modules (messaging, files, invoices, etc.) should extend this class.
 * It provides:
 * - Capability-driven UI rendering
 * - Standard toolbar with create/export/bulk actions
 * - Standard row actions with view/edit/delete
 * - Lifecycle management (activate/deactivate)
 * - API endpoint resolution based on role
 */
export abstract class PortalFeatureModule extends BaseModule {
  /** Portal context with role, capabilities, and actions */
  protected context!: PortalContext;

  /** Shorthand for context.capabilities */
  protected capabilities!: FeatureCapabilities;

  /** Current module state */
  protected moduleState: ModuleState = 'idle';

  /** Container element for module content */
  protected container: HTMLElement | null = null;

  /** Current pagination state */
  protected pagination: PaginationParams = {
    page: 1,
    limit: 25,
    sortBy: undefined,
    sortOrder: 'desc'
  };

  constructor(name: string) {
    super(name);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the module with portal context
   * Called when the module is first loaded
   */
  async initWithContext(context: PortalContext): Promise<void> {
    this.context = context;
    this.capabilities = context.capabilities;
    await super.init();
  }

  /**
   * Set the container element for module content
   */
  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  // ============================================
  // LIFECYCLE METHODS (implement in subclasses)
  // ============================================

  /**
   * Activate the module (when tab is switched to this module)
   * Load data and render the view
   */
  abstract activate(): Promise<void>;

  /**
   * Deactivate the module (when switching away from this tab)
   * Clean up any listeners, intervals, etc.
   */
  abstract deactivate(): Promise<void>;

  /**
   * Get the API endpoint for this module
   * Should return role-appropriate endpoint
   */
  protected abstract getApiEndpoint(): string;

  /**
   * Render the main view
   */
  protected abstract renderView(): void;

  // ============================================
  // CAPABILITY-DRIVEN UI RENDERING
  // ============================================

  /**
   * Render toolbar with buttons based on capabilities
   * Only shows buttons the user has permission to use
   */
  protected renderToolbar(config?: ToolbarConfig): string {
    const buttons: string[] = [];

    // Search input (always shown if configured)
    if (config?.showSearch) {
      buttons.push(`
        <div class="toolbar-search">
          <input
            type="text"
            class="form-input toolbar-search-input"
            placeholder="${config.searchPlaceholder || 'Search...'}"
            id="${this.name}-search"
          />
        </div>
      `);
    }

    // Primary actions based on capabilities
    if (this.capabilities.canCreate) {
      buttons.push(this.renderCreateButton());
    }

    if (this.capabilities.canExport) {
      buttons.push(this.renderExportButton());
    }

    if (this.capabilities.canBulkAction) {
      buttons.push(this.renderBulkActionButton());
    }

    // Custom primary actions
    if (config?.primaryActions) {
      for (const action of config.primaryActions) {
        if (!action.requiresCapability || this.capabilities[action.requiresCapability]) {
          buttons.push(this.renderActionButton(action));
        }
      }
    }

    return `
      <div class="data-table-actions toolbar">
        ${buttons.join('')}
      </div>
    `;
  }

  /**
   * Render action buttons for a data row based on capabilities
   */
  protected renderRowActions<T extends DataItem>(item: T): string {
    const actions: string[] = [];

    // View is always available
    actions.push(this.renderViewButton(item));

    // Edit requires canEdit capability
    if (this.capabilities.canEdit) {
      actions.push(this.renderEditButton(item));
    }

    // Delete requires canDelete capability
    if (this.capabilities.canDelete) {
      actions.push(this.renderDeleteButton(item));
    }

    return `<div class="row-actions">${actions.join('')}</div>`;
  }

  /**
   * Render a data table with columns based on role/capabilities
   */
  protected renderTable<T extends DataItem>(
    items: T[],
    columns: ColumnDef<T>[],
    options?: { showCheckboxes?: boolean }
  ): string {
    const showCheckboxes = options?.showCheckboxes && this.capabilities.canBulkAction;

    const headerCells = columns.map(
      (col) => `
        <th class="${col.align ? `text-${col.align}` : ''}" ${col.width ? `style="width: ${col.width}"` : ''}>
          ${col.sortable ? `<button class="sort-btn" data-sort="${col.id}">${col.header}</button>` : col.header}
        </th>
      `
    );

    if (showCheckboxes) {
      headerCells.unshift(`
        <th class="checkbox-col">
          <input type="checkbox" class="bulk-select-all" aria-label="Select all" />
        </th>
      `);
    }

    // Always add actions column if user has any action capabilities
    if (this.capabilities.canEdit || this.capabilities.canDelete) {
      headerCells.push('<th class="actions-col">Actions</th>');
    }

    const rows = items.map((item) => {
      const cells = columns.map((col) => {
        const value =
          typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor as keyof T];
        const rendered = col.render ? col.render(value, item) : String(value ?? '');
        return `<td class="${col.align ? `text-${col.align}` : ''}">${rendered}</td>`;
      });

      if (showCheckboxes) {
        cells.unshift(`
          <td class="checkbox-col">
            <input type="checkbox" class="bulk-select-item" data-id="${item.id}" aria-label="Select row" />
          </td>
        `);
      }

      if (this.capabilities.canEdit || this.capabilities.canDelete) {
        cells.push(`<td class="actions-col">${this.renderRowActions(item)}</td>`);
      }

      return `<tr data-id="${item.id}">${cells.join('')}</tr>`;
    });

    return `
      <div class="data-table-card">
        <table class="admin-table">
          <thead>
            <tr>${headerCells.join('')}</tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows.join('') : `<tr><td colspan="${headerCells.length}" class="empty-state">No items found</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  // ============================================
  // BUTTON TEMPLATES
  // ============================================

  protected renderCreateButton(): string {
    return `
      <button class="btn btn-primary" data-action="create">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Create</span>
      </button>
    `;
  }

  protected renderExportButton(): string {
    return `
      <button class="btn btn-secondary" data-action="export">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Export</span>
      </button>
    `;
  }

  protected renderBulkActionButton(): string {
    return `
      <button class="btn btn-secondary" data-action="bulk" disabled>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="15"></line>
          <line x1="15" y1="9" x2="9" y2="15"></line>
        </svg>
        <span>Bulk Actions</span>
      </button>
    `;
  }

  protected renderActionButton(action: ActionConfig): string {
    const variantClass = action.variant ? `btn-${action.variant}` : 'btn-secondary';
    return `
      <button class="btn ${variantClass}" data-action="${action.id}">
        ${action.icon ? action.icon : ''}
        <span>${action.label}</span>
      </button>
    `;
  }

  protected renderViewButton<T extends DataItem>(item: T): string {
    return `
      <button class="btn-icon" data-action="view" data-id="${item.id}" aria-label="View">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    `;
  }

  protected renderEditButton<T extends DataItem>(item: T): string {
    return `
      <button class="btn-icon" data-action="edit" data-id="${item.id}" aria-label="Edit">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
        </svg>
      </button>
    `;
  }

  protected renderDeleteButton<T extends DataItem>(item: T): string {
    return `
      <button class="btn-icon btn-danger" data-action="delete" data-id="${item.id}" aria-label="Delete">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
      </button>
    `;
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  protected setModuleState(state: ModuleState): void {
    this.moduleState = state;
    this.dispatchEvent('state-change', { state });
  }

  protected isLoading(): boolean {
    return this.moduleState === 'loading';
  }

  /**
   * Check if module is in ready state (module-specific)
   * Note: Overrides BaseModule.isReady() which checks initialization
   */
  isModuleReady(): boolean {
    return this.moduleState === 'ready';
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Show loading state in container
   */
  protected showLoading(): void {
    if (this.container) {
      this.container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      `;
    }
    this.setModuleState('loading');
  }

  /**
   * Show error state in container
   */
  protected showError(message: string): void {
    if (this.container) {
      this.container.innerHTML = `
        <div class="error-state">
          <p class="error-message">${message}</p>
          <button class="btn btn-secondary" data-action="retry">Retry</button>
        </div>
      `;
    }
    this.setModuleState('error');
  }

  /**
   * Show empty state in container
   */
  protected showEmpty(message: string = 'No items found'): void {
    if (this.container) {
      this.container.innerHTML = `
        <div class="empty-state">
          <p>${message}</p>
          ${this.capabilities.canCreate ? '<button class="btn btn-primary" data-action="create">Create New</button>' : ''}
        </div>
      `;
    }
  }

  /**
   * Notify user of an action result
   */
  protected notify(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.context.showNotification(message, type);
  }

  /**
   * Check if user has a specific capability
   */
  protected can(capability: keyof FeatureCapabilities): boolean {
    return this.capabilities[capability];
  }

  /**
   * Get the role from context
   */
  protected get role() {
    return this.context.role;
  }

  /**
   * Check if current user is admin
   */
  protected get isAdmin(): boolean {
    return this.context.role === 'admin';
  }

  /**
   * Check if current user is client
   */
  protected get isClient(): boolean {
    return this.context.role === 'client';
  }
}
