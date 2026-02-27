/**
 * ===============================================
 * UNIVERSAL ADMIN HANDLERS
 * ===============================================
 * @file src/features/admin/handlers/universal-handlers.ts
 *
 * Consolidated handlers for common admin patterns:
 * - Table row clicks
 * - Button actions (refresh, export, add)
 * - Bulk operations
 * - Dropdown menus
 */

import { showToast } from '../../../utils/toast-notifications';
import { exportToCsv, type ExportConfig } from '../../../utils/table-export';
import { apiFetch, apiPut, apiDelete } from '../../../utils/api-client';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('UniversalHandlers');

// =====================================================
// TYPES
// =====================================================

interface TableRowClickConfig {
  /** Container selector (e.g., '#clients-table tbody') */
  container: string;
  /** Row selector (e.g., 'tr[data-client-id]') */
  rowSelector: string;
  /** Data attribute for ID (e.g., 'clientId' for data-client-id) */
  idAttribute: string;
  /** Selectors to exclude from triggering click (e.g., checkboxes, buttons) */
  excludeSelectors?: string[];
  /** Callback when row is clicked */
  onRowClick: (id: number, row: HTMLElement) => void;
}

interface ButtonHandlerConfig {
  /** Button selector */
  selector: string;
  /** Click handler */
  onClick: () => void | Promise<void>;
  /** Optional guard attribute to prevent duplicate listeners */
  guardAttribute?: string;
}

interface RefreshButtonConfig {
  /** Button selector */
  selector: string;
  /** Data loading function */
  loadData: () => void | Promise<void>;
}

interface ExportButtonConfig<T> {
  /** Button selector */
  selector: string;
  /** Function to get current data (after filters applied) */
  getData: () => T[];
  /** Export configuration */
  exportConfig: ExportConfig;
  /** Entity name for toast (e.g., 'clients', 'invoices') */
  entityName: string;
}

interface BulkActionConfig {
  /** API endpoint template (use {id} as placeholder) */
  endpoint: string;
  /** HTTP method */
  method: 'PUT' | 'DELETE' | 'POST';
  /** Request body (optional, for PUT/POST) */
  body?: Record<string, unknown>;
  /** Action name for toast messages (e.g., 'archived', 'deleted') */
  actionName: string;
  /** Entity name for toast (e.g., 'client', 'invoice') */
  entityName: string;
  /** Callback after successful action */
  onSuccess?: () => void | Promise<void>;
}

interface DropdownConfig {
  /** Trigger button selector */
  triggerSelector: string;
  /** Dropdown menu selector */
  menuSelector: string;
  /** Item click handler */
  onItemClick?: (action: string, itemEl: HTMLElement) => void;
}

// =====================================================
// TABLE ROW CLICK HANDLER
// =====================================================

/**
 * Set up click handlers for table rows with proper exclusions
 * Uses event delegation for performance
 */
export function setupTableRowClicks(config: TableRowClickConfig): void {
  const container = document.querySelector(config.container);
  if (!container) return;

  // Check if already initialized
  const containerEl = container as HTMLElement;
  if (containerEl.dataset.rowClickInitialized === 'true') return;
  containerEl.dataset.rowClickInitialized = 'true';

  const defaultExclusions = [
    '.bulk-select-cell',
    '[data-action]',
    '.inline-editable-cell',
    'input',
    'button',
    '.btn',
    '.dropdown-trigger',
    '.custom-dropdown'
  ];

  const exclusions = [...defaultExclusions, ...(config.excludeSelectors || [])];

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Check exclusions
    for (const selector of exclusions) {
      if (target.closest(selector)) return;
    }

    // Find the row
    const row = target.closest(config.rowSelector) as HTMLElement | null;
    if (!row) return;

    // Get ID from data attribute
    const id = parseInt(row.dataset[config.idAttribute] || '0', 10);
    if (!id) return;

    config.onRowClick(id, row);
  });
}

// =====================================================
// BUTTON HANDLERS
// =====================================================

/**
 * Set up a button click handler with duplicate prevention
 */
export function setupButtonHandler(config: ButtonHandlerConfig): void {
  const btn = document.querySelector(config.selector) as HTMLElement | null;
  if (!btn) return;

  const guard = config.guardAttribute || 'listenerAdded';
  if (btn.dataset[guard] === 'true') return;
  btn.dataset[guard] = 'true';

  btn.addEventListener('click', async () => {
    await config.onClick();
  });
}

/**
 * Set up multiple button handlers at once
 */
export function setupButtonHandlers(configs: ButtonHandlerConfig[]): void {
  configs.forEach(setupButtonHandler);
}

/**
 * Set up a refresh button
 */
export function setupRefreshButton(config: RefreshButtonConfig): void {
  setupButtonHandler({
    selector: config.selector,
    onClick: config.loadData
  });
}

/**
 * Set up an export button
 */
export function setupExportButton<T extends Record<string, unknown>>(
  config: ExportButtonConfig<T>
): void {
  setupButtonHandler({
    selector: config.selector,
    onClick: () => {
      const data = config.getData();
      exportToCsv(data, config.exportConfig);
      showToast(`Exported ${data.length} ${config.entityName} to CSV`, 'success');
    }
  });
}

// =====================================================
// BULK ACTION FACTORY
// =====================================================

/**
 * Create a bulk action handler function
 */
export function createBulkActionHandler(config: BulkActionConfig) {
  return async (ids: number[]): Promise<{ success: number; failed: number }> => {
    if (ids.length === 0) {
      showToast(`No ${config.entityName}s selected`, 'warning');
      return { success: 0, failed: 0 };
    }

    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const endpoint = config.endpoint.replace('{id}', String(id));
            let response: Response;

            switch (config.method) {
            case 'PUT':
              response = await apiPut(endpoint, config.body || {});
              break;
            case 'DELETE':
              response = await apiDelete(endpoint);
              break;
            case 'POST':
              response = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config.body || {})
              });
              break;
            }

            return { id, success: response.ok };
          } catch {
            return { id, success: false };
          }
        })
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        const plural = successCount > 1 ? 's' : '';
        const failMsg = failCount > 0 ? ` (${failCount} failed)` : '';
        showToast(
          `${config.actionName} ${successCount} ${config.entityName}${plural}${failMsg}`,
          failCount > 0 ? 'warning' : 'success'
        );

        if (config.onSuccess) {
          await config.onSuccess();
        }
      } else {
        showToast(`Failed to ${config.actionName.toLowerCase()} ${config.entityName}s`, 'error');
      }

      return { success: successCount, failed: failCount };
    } catch (error) {
      logger.error('BulkAction: Error:', error);
      showToast(`Error ${config.actionName.toLowerCase()} ${config.entityName}s`, 'error');
      return { success: 0, failed: ids.length };
    }
  };
}

// =====================================================
// DROPDOWN MENU HANDLER
// =====================================================

/**
 * Set up dropdown menu behavior
 */
export function setupDropdownMenu(config: DropdownConfig): void {
  const trigger = document.querySelector(config.triggerSelector) as HTMLElement | null;
  const menu = document.querySelector(config.menuSelector) as HTMLElement | null;

  if (!trigger || !menu) return;
  if (trigger.dataset.dropdownInitialized === 'true') return;
  trigger.dataset.dropdownInitialized = 'true';

  // Toggle on trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle('open');
    menu.classList.toggle('hidden');
  });

  // Handle item clicks
  if (config.onItemClick) {
    menu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!item) return;

      const action = item.dataset.action;
      if (action) {
        config.onItemClick!(action, item);
      }

      // Close menu after action
      menu.classList.remove('open');
      menu.classList.add('hidden');
    });
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target as Node) && !trigger.contains(e.target as Node)) {
      menu.classList.remove('open');
      menu.classList.add('hidden');
    }
  });
}

// =====================================================
// DATA ATTRIBUTE ACTION HANDLERS
// =====================================================

/**
 * Universal handler for data-action attributes
 * Consolidates all action button patterns into one delegation
 */
export function setupDataActionHandlers(
  containerSelector: string,
  handlers: Record<string, (id: number, target: HTMLElement) => void | Promise<void>>
): void {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const containerEl = container as HTMLElement;
  if (containerEl.dataset.actionHandlersInitialized === 'true') return;
  containerEl.dataset.actionHandlersInitialized = 'true';

  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const actionEl = target.closest('[data-action]') as HTMLElement | null;
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    if (!action || !handlers[action]) return;

    // Prevent row click from firing
    e.stopPropagation();

    // Get ID from closest row or element with data-*-id
    const row = actionEl.closest('[data-id]') as HTMLElement | null;
    const id = row ? parseInt(row.dataset.id || '0', 10) : 0;

    await handlers[action](id, actionEl);
  });
}

// =====================================================
// CARD CLICK HANDLER
// =====================================================

interface CardClickConfig {
  /** Container selector */
  container: string;
  /** Card selector */
  cardSelector: string;
  /** Data attribute for value (e.g., 'tab' for data-tab) */
  dataAttribute: string;
  /** Click handler */
  onClick: (value: string, card: HTMLElement) => void;
}

/**
 * Set up click handlers for clickable cards
 */
export function setupCardClicks(config: CardClickConfig): void {
  const container = document.querySelector(config.container);
  if (!container) return;

  const containerEl = container as HTMLElement;
  if (containerEl.dataset.cardClickInitialized === 'true') return;
  containerEl.dataset.cardClickInitialized = 'true';

  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest(config.cardSelector) as HTMLElement | null;
    if (!card) return;

    const value = card.dataset[config.dataAttribute];
    if (value) {
      config.onClick(value, card);
    }
  });
}

// =====================================================
// STATUS UPDATE HANDLER
// =====================================================

interface StatusUpdateConfig {
  /** API endpoint template (use {id} as placeholder) */
  endpoint: string;
  /** Field name for status */
  statusField: string;
  /** Entity name for toast */
  entityName: string;
  /** Callback after successful update */
  onSuccess?: () => void | Promise<void>;
}

/**
 * Create a status update handler
 */
export function createStatusUpdateHandler(config: StatusUpdateConfig) {
  return async (id: number, newStatus: string): Promise<boolean> => {
    try {
      const endpoint = config.endpoint.replace('{id}', String(id));
      const response = await apiPut(endpoint, { [config.statusField]: newStatus });

      if (response.ok) {
        showToast(`${config.entityName} status updated`, 'success');
        if (config.onSuccess) {
          await config.onSuccess();
        }
        return true;
      }
      showToast(`Failed to update ${config.entityName} status`, 'error');
      return false;

    } catch (error) {
      logger.error('StatusUpdate: Error:', error);
      showToast(`Error updating ${config.entityName} status`, 'error');
      return false;
    }
  };
}
