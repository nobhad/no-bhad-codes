/**
 * ===============================================
 * EJS TABLE LOADER
 * ===============================================
 * @file src/features/shared/table-manager/loadEjsTable.ts
 *
 * Fetches HTML table fragments from the server and initializes
 * the TableManager for interactivity. Used by both admin-dashboard
 * and portal-navigation tab switching.
 */

import { createTableManagerFromElement } from './TableManager';
import { SELECTORS } from './constants';
import { hasEjsTable } from '../../../config/table-definitions';
import { createLogger } from '../../../utils/logger';
import type { TableManager } from './TableManager';

const logger = createLogger('EjsTableLoader');

/** Cache of active TableManager instances keyed by table ID */
const activeManagers = new Map<string, TableManager>();

/**
 * Load an EJS hybrid table into a container.
 *
 * 1. Fetches HTML from /dashboard/tab/:tabId
 * 2. Injects into the tab container
 * 3. Creates and initializes a TableManager
 *
 * @param tabId - The table definition ID (e.g., 'admin-clients')
 * @param container - The DOM container to inject into
 * @param callbacks - Optional action/navigation callbacks
 */
export async function loadEjsTable(
  tabId: string,
  container: HTMLElement,
  callbacks?: {
    onAction?: (action: string, rowId: string | number, row: Record<string, unknown>) => void;
    onRowClick?: (rowId: string | number, row: Record<string, unknown>) => void;
    onBulkAction?: (action: string, selectedIds: Set<string>) => void;
  }
): Promise<TableManager | null> {
  // Destroy previous manager for this table if it exists
  const existing = activeManagers.get(tabId);
  if (existing) {
    existing.destroy();
    activeManagers.delete(tabId);
  }

  try {
    logger.log(`Loading EJS table: ${tabId}`);

    const response = await fetch(`/dashboard/tab/${tabId}`, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'text/html'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load table: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    container.innerHTML = html;

    // Find the table root element
    const tableEl = container.querySelector<HTMLElement>(SELECTORS.TABLE_ROOT);
    if (!tableEl) {
      logger.warn(`No ${SELECTORS.TABLE_ROOT} found in response for: ${tabId}`);
      return null;
    }

    // Create and init the TableManager
    const manager = createTableManagerFromElement(tableEl, {
      ...callbacks,
      onRefresh: async () => {
        // Re-load the entire table on refresh
        await loadEjsTable(tabId, container, callbacks);
      }
    });

    if (manager) {
      manager.init();
      activeManagers.set(tabId, manager);
      logger.log(`TableManager initialized for: ${tabId}`);
    }

    return manager;
  } catch (error) {
    logger.error(`Failed to load EJS table ${tabId}:`, error);

    // Show error state in container
    container.innerHTML = `
      <div class="portal-main-container">
        <div class="error-state">
          <p>Failed to load data</p>
          <button class="btn btn-secondary" data-action="retry-ejs-table">Retry</button>
        </div>
      </div>
    `;

    // Bind retry
    const retryBtn = container.querySelector('[data-action="retry-ejs-table"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadEjsTable(tabId, container, callbacks);
      }, { once: true });
    }

    return null;
  }
}

/** Destroy a specific table manager by ID */
export function destroyEjsTable(tabId: string): void {
  const manager = activeManagers.get(tabId);
  if (manager) {
    manager.destroy();
    activeManagers.delete(tabId);
  }
}

/** Destroy all active table managers */
export function destroyAllEjsTables(): void {
  activeManagers.forEach((manager) => manager.destroy());
  activeManagers.clear();
}

// Re-export hasEjsTable for convenience
export { hasEjsTable };
