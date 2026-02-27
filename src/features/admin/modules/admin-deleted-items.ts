/**
 * ===============================================
 * ADMIN DELETED ITEMS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-deleted-items.ts
 *
 * Soft-deleted items management for admin dashboard.
 * Allows viewing, restoring, and permanently deleting items.
 *
 * Uses createTableModule factory for standardized table operations.
 */

import { apiPost, apiDelete } from '../../../utils/api-client';
import { renderActionsCell, createAction } from '../../../factories';
import { confirmDialog } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import type { AdminDashboardContext } from '../admin-types';
import { createLogger } from '../../../utils/logger';
import {
  createTableModule,
  createPaginationConfig,
  type TableModuleHelpers
} from '../../../utils/table-module-factory';
import type { TableFilterConfig } from '../../../utils/table-filter';

const logger = createLogger('AdminDeletedItems');

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn =
  typeof import('../../../react/features/admin/deleted-items').mountDeletedItemsTable;
type ReactUnmountFn =
  typeof import('../../../react/features/admin/deleted-items').unmountDeletedItemsTable;

let mountDeletedItemsTable: ReactMountFn | null = null;
let unmountDeletedItemsTable: ReactUnmountFn | null = null;
let reactTableMounted = false;
let reactMountContainer: HTMLElement | null = null;

/**
 * Check if React table is actually mounted (container exists and has content)
 */
function isReactTableActuallyMounted(): boolean {
  if (!reactTableMounted) return false;
  // Check if the container still exists in the DOM and has content
  if (
    !reactMountContainer ||
    !reactMountContainer.isConnected ||
    reactMountContainer.children.length === 0
  ) {
    reactTableMounted = false;
    reactMountContainer = null;
    return false;
  }
  return true;
}

/** Lazy load React mount functions */
async function loadReactDeletedItemsTable(): Promise<boolean> {
  if (mountDeletedItemsTable && unmountDeletedItemsTable) return true;

  try {
    const module = await import('../../../react/features/admin/deleted-items');
    mountDeletedItemsTable = module.mountDeletedItemsTable;
    unmountDeletedItemsTable = module.unmountDeletedItemsTable;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

/** Feature flag for React deleted items table */
function shouldUseReactDeletedItemsTable(): boolean {
  return true;
}

// Late-bound module reload function (assigned after module creation)
let reloadModule: ((ctx: AdminDashboardContext) => Promise<void>) | null = null;

// ===============================================
// TYPES
// ===============================================

interface DeletedItem {
  id: number;
  type: 'client' | 'project' | 'invoice' | 'lead' | 'proposal';
  name: string;
  deleted_at: string;
  deleted_by: string | null;
  days_until_permanent: number;
}

interface DeletedItemsStats {
  clients: number;
  projects: number;
  invoices: number;
  leads: number;
  proposals: number;
  total: number;
}

// ===============================================
// FILTER CONFIGURATION
// ===============================================

const DELETED_ITEMS_FILTER_CONFIG: TableFilterConfig = {
  tableId: 'deleted-items',
  searchFields: ['name', 'deleted_by'],
  statusField: 'type',
  statusOptions: [
    { value: 'client', label: 'Clients' },
    { value: 'project', label: 'Projects' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'lead', label: 'Leads' },
    { value: 'proposal', label: 'Proposals' }
  ],
  dateField: 'deleted_at',
  sortableColumns: [
    { key: 'type', label: 'Type', type: 'string' },
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'deleted_at', label: 'Deleted', type: 'date' },
    { key: 'deleted_by', label: 'Deleted By', type: 'string' },
    { key: 'days_until_permanent', label: 'Days Left', type: 'number' }
  ],
  storageKey: 'admin_deleted_items_filter'
};

// ===============================================
// HELPER FUNCTIONS
// ===============================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function restoreItem(id: number, type: string, reloadFn: () => Promise<void>): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/deleted-items/${type}/${id}/restore`, {});

    if (response.ok) {
      showToast(`${capitalizeFirst(type)} restored successfully`, 'success');
      await reloadFn();
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to restore item', 'error');
    }
  } catch (error) {
    logger.error('Restore error:', error);
    showToast('Error restoring item', 'error');
  }
}

async function permanentlyDeleteItem(
  id: number,
  type: string,
  reloadFn: () => Promise<void>
): Promise<void> {
  try {
    const response = await apiDelete(`/api/admin/deleted-items/${type}/${id}/permanent`);

    if (response.ok) {
      showToast(`${capitalizeFirst(type)} permanently deleted`, 'success');
      await reloadFn();
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to delete item', 'error');
    }
  } catch (error) {
    logger.error('Permanent delete error:', error);
    showToast('Error deleting item', 'error');
  }
}

// ===============================================
// ROW RENDERING
// ===============================================

function buildDeletedItemRow(
  item: DeletedItem,
  ctx: AdminDashboardContext,
  helpers: TableModuleHelpers<DeletedItem>
): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.dataset.id = String(item.id);
  row.dataset.type = item.type;

  const daysUntilPermanent = item.days_until_permanent;
  const urgencyClass =
    daysUntilPermanent <= 7 ? 'status-danger' : daysUntilPermanent <= 14 ? 'status-warning' : '';

  row.innerHTML = `
    <td class="type-cell" data-label="Type">
      <span class="entity-type-badge entity-type-${item.type}">${item.type}</span>
    </td>
    <td class="name-cell" data-label="Name">${SanitizationUtils.escapeHtml(item.name)}</td>
    <td class="date-cell" data-label="Deleted">${formatDate(item.deleted_at)}</td>
    <td class="name-cell" data-label="Deleted By">${item.deleted_by || 'System'}</td>
    <td class="count-cell ${urgencyClass}" data-label="Days Left">
      <span class="days-count">${daysUntilPermanent}</span> days
    </td>
    <td class="actions-cell" data-label="Actions">
      ${renderActionsCell([
    createAction('restore', item.id, {
      className: 'restore-btn',
      title: 'Restore item',
      dataAttrs: { type: item.type }
    }),
    createAction('delete', item.id, {
      className: 'permanent-delete-btn',
      title: 'Permanently delete',
      dataAttrs: { type: item.type }
    })
  ])}
    </td>
  `;

  // Attach action handlers
  const restoreBtn = row.querySelector('[data-action="restore"]');
  const deleteBtn = row.querySelector('[data-action="permanent-delete"]');

  const reloadFn = async () => {
    const storedCtx = helpers.getContext();
    if (storedCtx && reloadModule) {
      await reloadModule(storedCtx);
    }
  };

  restoreBtn?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Restore Item',
      message: `Are you sure you want to restore this ${item.type}? It will be visible again in the main list.`,
      confirmText: 'Restore',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      await restoreItem(item.id, item.type, reloadFn);
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Permanently Delete',
      message: `This will permanently delete this ${item.type} and all associated data. This action cannot be undone.`,
      confirmText: 'Delete Forever',
      cancelText: 'Cancel',
      danger: true
    });

    if (confirmed) {
      await permanentlyDeleteItem(item.id, item.type, reloadFn);
    }
  });

  return row;
}

// ===============================================
// STATS RENDERING
// ===============================================

function renderStats(stats: DeletedItemsStats): void {
  const updates: Record<string, string> = {
    'deleted-stat-clients': String(stats.clients),
    'deleted-stat-projects': String(stats.projects),
    'deleted-stat-invoices': String(stats.invoices),
    'deleted-stat-leads': String(stats.leads),
    'deleted-stat-proposals': String(stats.proposals),
    'deleted-stat-total': String(stats.total)
  };

  for (const [id, value] of Object.entries(updates)) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}

// ===============================================
// MODULE FACTORY
// ===============================================

const deletedItemsModule = createTableModule<DeletedItem, DeletedItemsStats>({
  moduleId: 'deleted-items',
  filterConfig: DELETED_ITEMS_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('deleted-items'),
  columnCount: 6,
  apiEndpoint: '/api/admin/deleted-items',

  extractData: (json) => {
    const data = json as { items?: DeletedItem[]; stats?: DeletedItemsStats };
    return {
      data: data.items || [],
      stats: data.stats
    };
  },

  renderRow: buildDeletedItemRow,

  renderStats: (stats) => {
    renderStats(stats);
  },

  emptyMessage: 'No deleted items found.',
  filterEmptyMessage: 'No deleted items match the current filters.',
  loadingMessage: 'Loading deleted items...',

  defaultSort: {
    column: 'deleted_at',
    direction: 'desc'
  }
});

// Assign late-bound reload function now that module exists
reloadModule = deletedItemsModule.load;

// ===============================================
// PUBLIC API
// ===============================================

/**
 * Cleanup function called when leaving the deleted items tab
 * Unmounts React components if they were mounted
 */
export function cleanupDeletedItemsTab(): void {
  if (reactTableMounted && unmountDeletedItemsTable) {
    unmountDeletedItemsTable();
    reactTableMounted = false;
  }
  deletedItemsModule.resetCache();
}

/**
 * Renders the Deleted Items tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderDeletedItemsTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactDeletedItemsTable();

  if (useReact) {
    // React implementation - render minimal container
    container.innerHTML = `
      <!-- React Deleted Items Table Mount Point -->
      <div id="react-deleted-items-mount"></div>
    `;
  }
  // Vanilla implementation - factory renders table structure on load
}

/**
 * Load deleted items - handles both React and vanilla implementations
 */
export async function loadDeletedItems(ctx: AdminDashboardContext): Promise<void> {
  // Check if React implementation should be used
  const useReact = shouldUseReactDeletedItemsTable();
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React DeletedItemsTable
    const mountContainer = document.getElementById('react-deleted-items-mount');
    if (mountContainer) {
      const loaded = await loadReactDeletedItemsTable();
      if (loaded && mountDeletedItemsTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountDeletedItemsTable) {
          unmountDeletedItemsTable();
        }
        mountDeletedItemsTable(mountContainer, {
          onNavigate: (tab: string, entityId?: string) => {
            if (entityId) {
              ctx.switchTab(tab);
            } else {
              ctx.switchTab(tab);
            }
          }
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        reactMountSuccess = true;
      } else {
        logger.error(' React module failed to load, falling back to vanilla');
      }
    }

    if (reactMountSuccess) {
      return;
    }
    // Fall through to vanilla implementation if React failed
  }

  // Vanilla implementation
  await deletedItemsModule.load(ctx);
}

export const setDeletedItemsContext = deletedItemsModule.setContext;
export const getDeletedItemsData = deletedItemsModule.getData;
