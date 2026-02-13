/**
 * ===============================================
 * ADMIN DELETED ITEMS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-deleted-items.ts
 *
 * Soft-deleted items management for admin dashboard.
 * Allows viewing, restoring, and permanently deleting items.
 */

import { apiFetch, apiPost, apiDelete } from '../../../utils/api-client';
import { ICONS } from '../../../constants/icons';
import { confirmDialog } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { formatDate } from '../../../utils/format-utils';
import type { AdminDashboardContext } from '../admin-types';

/**
 * Represents a soft-deleted item from any entity table
 */
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

interface DeletedItemsResponse {
  items: DeletedItem[];
  stats: DeletedItemsStats;
}

// Module state
let deletedItems: DeletedItem[] = [];
let currentTypeFilter: string = 'all';

// Cached DOM references
const cachedElements: Map<string, HTMLElement | null> = new Map();

/**
 * Get cached element by ID
 */
function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) || null;
}

/**
 * Clear cached elements when section is unloaded
 */
function clearElementCache(): void {
  cachedElements.clear();
}

/**
 * Store context for later use (no-op, context passed directly to functions)
 */
export function setDeletedItemsContext(_ctx: AdminDashboardContext): void {
  // Context is passed directly to functions that need it
}

/**
 * Load deleted items from API and render
 */
export async function loadDeletedItems(ctx: AdminDashboardContext): Promise<void> {
  setDeletedItemsContext(ctx);

  const tableBody = getElement('deleted-items-table-body');
  if (tableBody) {
    showTableLoading(tableBody, 6, 'Loading deleted items...');
  }

  try {
    const response = await apiFetch('/api/admin/deleted-items');

    if (response.ok) {
      const json = await response.json();
      const data: DeletedItemsResponse = json.data ?? json;
      deletedItems = data.items || [];
      updateDeletedItemsDisplay(data, ctx);
    } else if (response.status !== 401) {
      console.error('[AdminDeletedItems] API error:', response.status);
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">Error loading deleted items</td></tr>';
      }
    }
  } catch (error) {
    console.error('[AdminDeletedItems] Failed to load:', error);
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">Network error loading deleted items</td></tr>';
    }
  }
}

/**
 * Update the deleted items display with data
 */
function updateDeletedItemsDisplay(
  data: DeletedItemsResponse,
  ctx: AdminDashboardContext
): void {
  // Update stats
  updateStats(data.stats);

  // Setup filter buttons if not already done
  setupTypeFilters(ctx);

  // Render the table
  renderDeletedItemsTable(data.items, ctx);
}

/**
 * Update stat counts
 */
function updateStats(stats: DeletedItemsStats): void {
  const statElements = {
    clients: getElement('deleted-stat-clients'),
    projects: getElement('deleted-stat-projects'),
    invoices: getElement('deleted-stat-invoices'),
    leads: getElement('deleted-stat-leads'),
    proposals: getElement('deleted-stat-proposals'),
    total: getElement('deleted-stat-total')
  };

  if (statElements.clients) statElements.clients.textContent = String(stats.clients);
  if (statElements.projects) statElements.projects.textContent = String(stats.projects);
  if (statElements.invoices) statElements.invoices.textContent = String(stats.invoices);
  if (statElements.leads) statElements.leads.textContent = String(stats.leads);
  if (statElements.proposals) statElements.proposals.textContent = String(stats.proposals);
  if (statElements.total) statElements.total.textContent = String(stats.total);
}

/**
 * Setup type filter buttons
 */
function setupTypeFilters(ctx: AdminDashboardContext): void {
  const filterContainer = getElement('deleted-items-filter-container');
  if (!filterContainer || filterContainer.dataset.initialized === 'true') return;

  filterContainer.dataset.initialized = 'true';

  const filterButtons = filterContainer.querySelectorAll('[data-filter]');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentTypeFilter = btn.getAttribute('data-filter') || 'all';
      renderDeletedItemsTable(deletedItems, ctx);
    });
  });
}

/**
 * Render the deleted items table
 */
function renderDeletedItemsTable(
  items: DeletedItem[],
  ctx: AdminDashboardContext
): void {
  const tableBody = getElement('deleted-items-table-body');
  if (!tableBody) return;

  // Filter by type if needed
  const filtered = currentTypeFilter === 'all'
    ? items
    : items.filter(item => item.type === currentTypeFilter);

  if (filtered.length === 0) {
    showTableEmpty(tableBody, 6, 'No deleted items found');
    return;
  }

  tableBody.innerHTML = filtered.map(item => {
    const daysUntilPermanent = item.days_until_permanent;
    const urgencyClass = daysUntilPermanent <= 7
      ? 'status-danger'
      : daysUntilPermanent <= 14
        ? 'status-warning'
        : '';

    return `
      <tr data-id="${item.id}" data-type="${item.type}">
        <td>
          <span class="entity-type-badge entity-type-${item.type}">${item.type}</span>
        </td>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td>${formatDate(item.deleted_at)}</td>
        <td>${item.deleted_by || 'System'}</td>
        <td class="${urgencyClass}">
          <strong>${daysUntilPermanent}</strong> days
        </td>
        <td class="actions-cell">
          <button
            class="btn-icon restore-btn"
            title="Restore item"
            data-action="restore"
            data-id="${item.id}"
            data-type="${item.type}"
          >
            ${ICONS.ROTATE_CCW}
          </button>
          <button
            class="btn-icon btn-danger permanent-delete-btn"
            title="Permanently delete"
            data-action="permanent-delete"
            data-id="${item.id}"
            data-type="${item.type}"
          >
            ${ICONS.TRASH}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach action handlers
  attachActionHandlers(tableBody, ctx);
}

/**
 * Attach click handlers for restore and permanent delete
 */
function attachActionHandlers(
  tableBody: HTMLElement,
  ctx: AdminDashboardContext
): void {
  // Restore buttons
  tableBody.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLElement;
      const id = parseInt(button.dataset.id || '0', 10);
      const type = button.dataset.type || '';

      if (!id || !type) return;

      const confirmed = await confirmDialog({
        title: 'Restore Item',
        message: `Are you sure you want to restore this ${type}? It will be visible again in the main list.`,
        confirmText: 'Restore',
        cancelText: 'Cancel'
      });

      if (confirmed) {
        await restoreItem(id, type, ctx);
      }
    });
  });

  // Permanent delete buttons
  tableBody.querySelectorAll('[data-action="permanent-delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLElement;
      const id = parseInt(button.dataset.id || '0', 10);
      const type = button.dataset.type || '';

      if (!id || !type) return;

      const confirmed = await confirmDialog({
        title: 'Permanently Delete',
        message: `This will permanently delete this ${type} and all associated data. This action cannot be undone.`,
        confirmText: 'Delete Forever',
        cancelText: 'Cancel',
        danger: true
      });

      if (confirmed) {
        await permanentlyDeleteItem(id, type, ctx);
      }
    });
  });
}

/**
 * Restore a soft-deleted item
 */
async function restoreItem(
  id: number,
  type: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/deleted-items/${type}/${id}/restore`, {});

    if (response.ok) {
      showToast(`${capitalizeFirst(type)} restored successfully`, 'success');
      await loadDeletedItems(ctx);
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to restore item', 'error');
    }
  } catch (error) {
    console.error('[AdminDeletedItems] Restore error:', error);
    showToast('Error restoring item', 'error');
  }
}

/**
 * Permanently delete an item
 */
async function permanentlyDeleteItem(
  id: number,
  type: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiDelete(`/api/admin/deleted-items/${type}/${id}/permanent`);

    if (response.ok) {
      showToast(`${capitalizeFirst(type)} permanently deleted`, 'success');
      await loadDeletedItems(ctx);
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to delete item', 'error');
    }
  } catch (error) {
    console.error('[AdminDeletedItems] Permanent delete error:', error);
    showToast('Error deleting item', 'error');
  }
}

/**
 * Helper to capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Cleanup when section is unloaded
 */
export function cleanupDeletedItems(): void {
  clearElementCache();
}
