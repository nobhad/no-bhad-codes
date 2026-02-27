/**
 * ===============================================
 * ADMIN CLIENTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-clients.ts
 *
 * Client management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 *
 * Uses createTableModule factory for standardized table operations.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import type { AdminDashboardContext } from '../admin-types';
import type { ProjectResponse, InvoiceResponse } from '../../../types/api';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format-utils';
import { createModalDropdown } from '../../../components/modal-dropdown';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { CLIENTS_FILTER_CONFIG } from '../../../utils/table-filter';
import { CLIENTS_EXPORT_CONFIG } from '../../../utils/table-export';
import { createRowCheckbox } from '../../../utils/table-bulk-actions';
import { confirmDialog, confirmDanger } from '../../../utils/confirm-dialog';
import { createDOMCache, batchUpdateText, getElement } from '../../../utils/dom-cache';
import { withButtonLoading } from '../../../utils/button-loading';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { validateEmail } from '../../../../shared/validation/validators';
import { getHealthBadgeHtml } from './admin-client-details';
import { getStatusDotHTML } from '../../../components/status-badge';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { showToast } from '../../../utils/toast-notifications';
import { renderEmptyState, renderErrorState } from '../../../components/empty-state';
import { ICONS } from '../../../constants/icons';
import { renderActionsCell, createAction, conditionalAction } from '../../../factories';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { makeEditable } from '../../../components/inline-edit';
import { initDetailKeyboardNav } from '../../../components/detail-keyboard-nav';
import {
  createTableModule,
  createPaginationConfig,
  type TableModuleHelpers
} from '../../../utils/table-module-factory';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('AdminClients');

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn = typeof import('../../../react/features/admin/clients').mountClientsTable;
type ReactUnmountFn = typeof import('../../../react/features/admin/clients').unmountClientsTable;

let mountClientsTable: ReactMountFn | null = null;
let unmountClientsTable: ReactUnmountFn | null = null;
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
async function loadReactClientsTable(): Promise<boolean> {
  if (mountClientsTable && unmountClientsTable) return true;

  try {
    const module = await import('../../../react/features/admin/clients');
    mountClientsTable = module.mountClientsTable;
    unmountClientsTable = module.unmountClientsTable;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

/** Check if React clients table should be used - always true */
function shouldUseReactClientsTable(): boolean {
  return true;
}

// ============================================
// DOM CACHE - Cached element references for detail view
// ============================================

/** DOM element selector keys for client detail views and modals */
type ClientsDOMKeys = {
  // Client detail buttons and elements
  editBillingBtn: string;
  moreMenu: string;
  statusBadge: string;
  clientNameCard: string;
  // Client detail containers
  projectsList: string;
  invoicesList: string;
  totalInvoiced: string;
  totalPaid: string;
  outstanding: string;
  outstandingInvoicesCount: string;
  // Edit client info modal
  editInfoModal: string;
  editInfoForm: string;
  editInfoClose: string;
  editInfoCancel: string;
  // Edit billing modal
  editBillingModal: string;
  editBillingForm: string;
  editBillingClose: string;
  editBillingCancel: string;
  // Add client modal
  addClientModal: string;
  addClientForm: string;
  addClientClose: string;
  addClientCancel: string;
  // Table action buttons (for event delegation)
  refreshBtn: string;
  addBtn: string;
};

/** Cached DOM element references for detail views and modals */
const domCache = createDOMCache<ClientsDOMKeys>();

// Register element selectors for detail view and modals
domCache.register({
  // Client detail buttons and elements
  editBillingBtn: '#cd-btn-edit-billing',
  moreMenu: '#cd-more-menu',
  statusBadge: '#cd-status-badge',
  clientNameCard: '#cd-client-name-card',
  // Client detail containers
  projectsList: '#cd-projects-list',
  invoicesList: '#cd-invoices-list',
  totalInvoiced: '#cd-total-invoiced',
  totalPaid: '#cd-total-paid',
  outstanding: '#cd-outstanding',
  outstandingInvoicesCount: '#cd-outstanding-invoices-count',
  // Edit client info modal
  editInfoModal: '#edit-client-info-modal',
  editInfoForm: '#edit-client-info-form',
  editInfoClose: '#edit-client-info-close',
  editInfoCancel: '#edit-client-info-cancel',
  // Edit billing modal
  editBillingModal: '#edit-billing-modal',
  editBillingForm: '#edit-billing-form',
  editBillingClose: '#edit-billing-close',
  editBillingCancel: '#edit-billing-cancel',
  // Add client modal
  addClientModal: '#add-client-modal',
  addClientForm: '#add-client-form',
  addClientClose: '#add-client-modal-close',
  addClientCancel: '#add-client-cancel',
  // Table action buttons
  refreshBtn: '#refresh-clients-btn',
  addBtn: '#add-client-btn'
});

export interface Client {
  id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  client_type: 'personal' | 'business';
  phone: string | null;
  status: 'active' | 'inactive' | 'pending';
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  project_count?: number;
  // Invitation fields
  invitation_sent_at?: string | null;
  invitation_expires_at?: string | null;
  // Billing fields
  billing_name?: string | null;
  billing_email?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  billing_country?: string | null;
  // CRM fields
  health_score?: number | null;
  health_status?: 'healthy' | 'at-risk' | 'critical' | null;
  tags?: Array<{ id: number; name: string; color: string }>;
}

interface ClientsStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
}

// Module-specific state (not handled by factory)
let currentClientId: number | null = null;

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  EXPORT:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  REFRESH:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  USER_PLUS:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>'
};

// ============================================
// TABLE MODULE FACTORY
// ============================================

/**
 * Clients table module using factory pattern
 * Handles: filter UI, pagination, bulk actions, export, loading states
 */
const clientsModule = createTableModule<Client, ClientsStats>({
  moduleId: 'clients',
  filterConfig: CLIENTS_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('clients'),
  columnCount: 8,
  apiEndpoint: '/api/clients',

  bulkConfig: {
    tableId: 'clients',
    actions: [
      {
        id: 'archive',
        label: 'Archive',
        variant: 'warning',
        confirmMessage: 'Archive {count} selected clients? They can be restored later.',
        handler: async (ids) => {
          await bulkArchiveClients(ids);
        }
      },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'danger',
        confirmMessage: 'Permanently delete {count} selected clients? This cannot be undone.',
        handler: async (ids) => {
          await bulkDeleteClients(ids);
        }
      }
    ]
  },

  exportConfig: CLIENTS_EXPORT_CONFIG,
  emptyMessage: 'No clients yet.',
  filterEmptyMessage: 'No clients match the current filters. Try adjusting your filters.',

  extractData: (response: unknown) => {
    const data = response as { clients?: Client[] };
    const clients = data.clients || [];
    const stats: ClientsStats = {
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      pending: clients.filter((c) => c.status === 'pending').length,
      inactive: clients.filter((c) => c.status === 'inactive').length
    };
    return { data: clients, stats };
  },

  renderRow: (
    client: Client,
    _ctx: AdminDashboardContext,
    _helpers: TableModuleHelpers<Client>
  ) => {
    return buildClientRow(client);
  },

  renderStats: (stats: ClientsStats) => {
    batchUpdateText({
      'clients-total': stats.total.toString(),
      'clients-active': stats.active.toString(),
      'clients-pending': stats.pending.toString(),
      'clients-inactive': stats.inactive.toString()
    });
  },

  onDataLoaded: (data: Client[], ctx: AdminDashboardContext) => {
    // Setup refresh and add buttons (only add listener once)
    const refreshBtn = domCache.get('refreshBtn');
    if (refreshBtn && !refreshBtn.dataset.listenerAdded) {
      refreshBtn.dataset.listenerAdded = 'true';
      refreshBtn.addEventListener('click', () => clientsModule.load(ctx));
    }

    const addBtn = domCache.get('addBtn');
    if (addBtn && !addBtn.dataset.listenerAdded) {
      addBtn.dataset.listenerAdded = 'true';
      addBtn.addEventListener('click', () => addClient(ctx));
    }
  },

  onTableRendered: (filteredData: Client[], _ctx: AdminDashboardContext) => {
    const tableBody = clientsModule.getElement('clients-table-body');
    if (!tableBody) return;

    // Setup row click handlers
    setupClientRowHandlers(tableBody, filteredData);

    // Initialize keyboard navigation
    initTableKeyboardNav({
      tableSelector: '.clients-table',
      rowSelector: 'tbody tr[data-client-id]',
      onRowSelect: (row) => {
        const clientId = parseInt(row.dataset.clientId || '0');
        if (clientId) showClientDetails(clientId);
      },
      focusClass: 'row-focused',
      selectedClass: 'row-selected'
    });
  }
});

// Export factory-provided functions
export const getClientsData = clientsModule.getData;

/**
 * Cleanup function called when leaving the clients tab
 * Unmounts React components if they were mounted
 */
export function cleanupClientsTab(): void {
  if (reactTableMounted && unmountClientsTable) {
    unmountClientsTable();
    reactTableMounted = false;
  }
}

/**
 * Load clients data - handles both React and vanilla implementations
 */
export async function loadClients(ctx: AdminDashboardContext): Promise<void> {
  // Check if React implementation should be used
  const useReact = shouldUseReactClientsTable();
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React ClientsTable
    const mountContainer = document.getElementById('react-clients-mount');
    if (mountContainer) {
      const loaded = await loadReactClientsTable();
      if (loaded && mountClientsTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountClientsTable) {
          unmountClientsTable();
        }
        mountClientsTable(mountContainer, {
          getAuthToken: ctx.getAuthToken,
          onViewClient: (clientId: number) => showClientDetails(clientId),
          showNotification: ctx.showNotification
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
  await clientsModule.load(ctx);
}

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the Clients tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderClientsTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactClientsTable();

  if (useReact) {
    // React implementation - render minimal container (no extra classes - React component has its own structure)
    container.innerHTML = `
      <!-- React Clients Table Mount Point -->
      <div id="react-clients-mount"></div>
    `;
    return;
  }

  // Vanilla implementation - original HTML
  container.innerHTML = `
    <!-- Clients Stats -->
    <div class="quick-stats">
      <button class="stat-card stat-card-clickable" data-filter="all" data-table="clients">
        <span class="stat-number" id="clients-total">-</span>
        <span class="stat-label">Total Clients</span>
      </button>
      <button class="stat-card stat-card-clickable" data-filter="active" data-table="clients">
        <span class="stat-number" id="clients-active">-</span>
        <span class="stat-label">Active</span>
      </button>
      <button class="stat-card stat-card-clickable" data-filter="pending" data-table="clients">
        <span class="stat-number" id="clients-pending">-</span>
        <span class="stat-label">Pending</span>
      </button>
      <button class="stat-card stat-card-clickable" data-filter="inactive" data-table="clients">
        <span class="stat-number" id="clients-inactive">-</span>
        <span class="stat-label">Inactive</span>
      </button>
    </div>

    <!-- Clients Table -->
    <div class="data-table-card" id="clients-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">Client Accounts</span><span class="title-mobile">Clients</span></h3>
        <div class="data-table-actions" id="clients-filter-container">
          <button class="icon-btn" id="export-clients-btn" title="Export to CSV" aria-label="Export clients to CSV">
            ${RENDER_ICONS.EXPORT}
          </button>
          <button class="icon-btn" id="refresh-clients-btn" title="Refresh" aria-label="Refresh clients">
            ${RENDER_ICONS.REFRESH}
          </button>
          <button class="icon-btn" id="add-client-btn" title="Add Client" aria-label="Add client">
            ${RENDER_ICONS.USER_PLUS}
          </button>
        </div>
      </div>
      <!-- Bulk Action Toolbar (hidden initially) -->
      <div id="clients-bulk-toolbar" class="bulk-action-toolbar hidden"></div>
      <div class="data-table-container">
        <div class="data-table-scroll-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col" class="bulk-select-cell">
                <div class="portal-checkbox">
                  <input type="checkbox" id="clients-select-all" class="bulk-select-all" aria-label="Select all clients" />
                </div>
              </th>
              <th scope="col" class="identity-col">Client</th>
              <th scope="col" class="type-col">Type</th>
              <th scope="col" class="status-col">Status</th>
              <th scope="col" class="count-col" title="Projects">#</th>
              <th scope="col" class="date-col created-col">Created</th>
              <th scope="col" class="date-col last-active-col">Last Active</th>
              <th scope="col" class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="clients-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
            <tr class="loading-row">
              <td colspan="8">
                <div class="loading-state">
                  <span class="loading-spinner" aria-hidden="true"></span>
                  <span class="loading-message">Loading clients...</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="clients-pagination" class="table-pagination"></div>
    </div>
  `;

  // Clear caches so elements get re-queried after render
  domCache.clear();
  clientsModule.resetCache();
}

export function getCurrentClientId(): number | null {
  return currentClientId;
}

export function setCurrentClientId(id: number | null): void {
  currentClientId = id;
}

export function getCurrentClientName(): string | null {
  if (!currentClientId) return null;
  const client = clientsModule.findById(currentClientId);
  if (!client) return null;

  const contactName = client.contact_name || '';
  const companyName = client.company_name || '';
  const clientType = client.client_type || 'business';

  // For business clients, company name is primary
  if (clientType === 'business' && companyName) {
    return contactName ? `${companyName} (${contactName})` : companyName;
  }
  // For personal clients, contact name is primary
  if (contactName) {
    return companyName ? `${contactName} (${companyName})` : contactName;
  }
  return companyName || null;
}

// ============================================
// ROW BUILDING HELPER
// ============================================

/**
 * Build a single client table row
 */
function buildClientRow(client: Client): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.dataset.clientId = String(client.id);
  row.className = 'clickable-row';

  const date = formatDate(client.created_at);
  const clientType = client.client_type || 'business';

  const decodedContact = client.contact_name
    ? SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(client.contact_name))
    : '';
  const decodedCompany = client.company_name
    ? SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(client.company_name))
    : '';

  // For business clients with company, company is primary name; otherwise contact is primary
  const isBusinessWithCompany = clientType === 'business' && decodedCompany;
  const safeName = SanitizationUtils.escapeHtml(
    isBusinessWithCompany ? decodedCompany : decodedContact || ''
  );
  const safeEmail = SanitizationUtils.escapeHtml(client.email || '');
  // Secondary info: contact for business, company for personal
  const safeCompany = isBusinessWithCompany
    ? decodedContact
      ? SanitizationUtils.escapeHtml(decodedContact)
      : ''
    : decodedCompany
      ? SanitizationUtils.escapeHtml(decodedCompany)
      : '';
  const projectCount = client.project_count || 0;

  const typeLabel = clientType === 'personal' ? 'Personal' : 'Business';

  // Determine invitation/status display
  const status = client.status || 'pending';
  const hasBeenInvited = !!client.invitation_sent_at;

  let statusDisplay: string;
  let statusClass: string;
  let showInviteBtn = false;

  if (status === 'active') {
    statusDisplay = 'Active';
    statusClass = 'status-active';
  } else if (status === 'inactive') {
    statusDisplay = 'Inactive';
    statusClass = 'status-inactive';
  } else if (hasBeenInvited) {
    statusDisplay = 'Invited';
    statusClass = 'status-pending';
  } else {
    statusDisplay = 'Not Invited';
    statusClass = 'status-not-invited';
    showInviteBtn = true;
  }

  // Status cell (dot indicator only)
  const statusVariant = statusClass.replace('status-', '');
  const statusCell = getStatusDotHTML(statusVariant, { label: statusDisplay });

  // Last active date
  const clientAny = client as { last_login_at?: string };
  const lastActive = clientAny.last_login_at ? formatDate(clientAny.last_login_at) : 'Never';

  // Health badge (available for future use)
  const _healthBadge = getHealthBadgeHtml(client.health_score);

  row.innerHTML = `
    ${createRowCheckbox('clients', client.id)}
    <td class="identity-cell inline-editable-cell" data-label="Client">
      <span class="identity-name" data-field="primary-name">${safeName}</span>
      ${safeCompany ? `<span class="identity-contact" data-field="secondary-name">${safeCompany}</span>` : '<span class="identity-contact hidden" data-field="secondary-name"></span>'}
      <span class="identity-email">${safeEmail}</span>
    </td>
    <td class="type-cell" data-label="Type">${typeLabel}</td>
    <td class="status-cell" data-label="Status">${statusCell}</td>
    <td class="count-cell" data-label="Projects">${projectCount}</td>
    <td class="date-cell created-cell" data-label="Created">
      <span class="date-value">${date}</span>
      <span class="last-active-stacked">${lastActive}</span>
    </td>
    <td class="date-cell last-active-cell" data-label="Last Active">${lastActive}</td>
    <td class="actions-cell" data-label="Actions">
      ${renderActionsCell([
    conditionalAction(showInviteBtn, 'send', client.id, {
      className: 'client-invite',
      title: 'Send invitation email',
      ariaLabel: 'Send invitation email to client',
      dataAttrs: { 'client-id': client.id }
    }),
    createAction('view', client.id, {
      className: 'btn-view-client',
      title: 'View Client',
      ariaLabel: 'View client details',
      dataAttrs: { 'client-id': client.id }
    })
  ])}
    </td>
  `;

  return row;
}

/**
 * Setup event handlers for client table rows
 */
function setupClientRowHandlers(tableBody: HTMLElement, clients: Client[]): void {
  // Row click to view details (but not on checkbox, invite button, or inline-editable cells)
  tableBody.querySelectorAll('tr[data-client-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Don't navigate if clicking the checkbox, invite button, bulk select cell, or inline-editable cell
      if (
        target.closest('.bulk-select-cell') ||
        target.closest('.btn-invite-inline') ||
        target.closest('.client-invite') ||
        target.closest('.inline-editable-cell') ||
        target.tagName === 'INPUT'
      ) {
        return;
      }
      const clientId = parseInt((row as HTMLElement).dataset.clientId || '0');
      if (clientId) showClientDetails(clientId);
    });
  });

  // Invite button click handlers (icon button next to status)
  tableBody.querySelectorAll('.client-invite').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const clientId = parseInt((btn as HTMLElement).dataset.clientId || '0');
      if (clientId) {
        await sendClientInvitation(clientId);
      }
    });
  });

  // Setup inline editing for contact_name and company_name
  tableBody.querySelectorAll('.identity-cell.inline-editable-cell').forEach((cell) => {
    const clientId = parseInt((cell as HTMLElement).dataset.clientId || '0');
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    setupInlineEditingForClient(cell as HTMLElement, client);
  });
}

/**
 * Setup inline editing for a client cell
 */
function setupInlineEditingForClient(cellEl: HTMLElement, client: Client): void {
  const clientType = client.client_type || 'business';
  const isBusinessWithCompany = clientType === 'business' && client.company_name;

  const primaryNameEl = cellEl.querySelector('.identity-name') as HTMLElement;
  const secondaryNameEl = cellEl.querySelector('.identity-contact') as HTMLElement;

  if (primaryNameEl) {
    makeEditable(
      primaryNameEl,
      () => (isBusinessWithCompany ? client.company_name || '' : client.contact_name || ''),
      async (newValue) => {
        const fieldToUpdate = isBusinessWithCompany ? 'company_name' : 'contact_name';
        const response = await apiPut(`/api/clients/${client.id}`, {
          [fieldToUpdate]: newValue || null
        });
        if (response.ok) {
          if (isBusinessWithCompany) {
            client.company_name = newValue || null;
          } else {
            client.contact_name = newValue || null;
          }
          primaryNameEl.textContent = newValue
            ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(newValue))
            : '';
          showToast(
            `${isBusinessWithCompany ? 'Company name' : 'Contact name'} updated`,
            'success'
          );
        } else {
          showToast('Failed to update client', 'error');
          throw new Error('Update failed');
        }
      },
      { placeholder: isBusinessWithCompany ? 'Enter company name' : 'Enter contact name' }
    );
  }

  if (secondaryNameEl) {
    makeEditable(
      secondaryNameEl,
      () => (isBusinessWithCompany ? client.contact_name || '' : client.company_name || ''),
      async (newValue) => {
        const fieldToUpdate = isBusinessWithCompany ? 'contact_name' : 'company_name';
        const response = await apiPut(`/api/clients/${client.id}`, {
          [fieldToUpdate]: newValue || null
        });
        if (response.ok) {
          if (isBusinessWithCompany) {
            client.contact_name = newValue || null;
          } else {
            client.company_name = newValue || null;
          }
          secondaryNameEl.textContent = newValue
            ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(newValue))
            : '';
          secondaryNameEl.style.display = newValue ? '' : 'none';
          showToast(
            `${isBusinessWithCompany ? 'Contact name' : 'Company name'} updated`,
            'success'
          );
        } else {
          showToast('Failed to update client', 'error');
          throw new Error('Update failed');
        }
      },
      { placeholder: isBusinessWithCompany ? 'Enter contact name' : 'Enter company name' }
    );
  }
}

export async function showClientDetails(
  clientId: number,
  ctx?: AdminDashboardContext
): Promise<void> {
  const context = ctx || clientsModule.getContext();
  if (!context) {
    logger.error(' No context available');
    return;
  }

  const client = clientsModule.findById(clientId);
  if (!client) {
    logger.error(' Client not found:', clientId);
    return;
  }

  currentClientId = clientId;

  // Switch to client-detail tab
  context.switchTab('client-detail');

  // Check if React mode should be used
  const clientDetailsModule = await import('./admin-client-details');
  if (clientDetailsModule.shouldUseReactClientDetail()) {
    // React mode - let initClientDetailView handle everything
    try {
      await clientDetailsModule.initClientDetailView(clientId, context);
      logger.log(' React client detail initialized');
      return; // Skip vanilla implementation
    } catch (error) {
      logger.error(' React client detail failed, falling back to vanilla:', error);
      // Fall through to vanilla implementation
    }
  }

  // Vanilla implementation
  // Dynamically render the client detail tab structure
  const tabContainer = document.getElementById('tab-client-detail');
  if (tabContainer) {
    clientDetailsModule.renderClientDetailTab(tabContainer);
  }

  // Populate the detail view
  populateClientDetailView(client);

  // Setup inline editing for detail fields
  setupClientDetailInlineEditing(client, context);

  // Setup event handlers
  setupClientDetailHandlers(client, context);

  // Load client's projects and billing
  loadClientProjects(clientId);
  loadClientBilling(clientId);

  // Initialize enhanced CRM features (contacts, activity, notes, tags)
  try {
    await clientDetailsModule.initClientDetailView(clientId, context);
  } catch (error) {
    logger.error(' Failed to load CRM features:', error);
  }

  // Initialize keyboard shortcuts for detail view (E=edit, Esc=back, 1-6=tabs)
  initDetailKeyboardNav({
    editButtonSelector: '#cd-btn-edit-client',
    onBack: () => context.switchTab('clients'),
    tabContainerSelector: '#client-detail-tabs',
    containerSelector: '#tab-client-detail'
  });
}

function populateClientDetailView(client: Client): void {
  // Prepare sanitized values (decode entities before escape to fix &amp;amp; etc.)
  const decodedContact = SanitizationUtils.decodeHtmlEntities(client.contact_name || '');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(client.company_name || '');
  const decodedBillingName = SanitizationUtils.decodeHtmlEntities(
    client.billing_name || client.contact_name || ''
  );
  const clientType = client.client_type || 'business';

  // For business clients with company name, company is primary; otherwise contact name is primary
  const isBusinessWithCompany = clientType === 'business' && decodedCompany;
  const primaryName = isBusinessWithCompany
    ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany))
    : SanitizationUtils.escapeHtml(
      decodedContact ? SanitizationUtils.capitalizeName(decodedContact) : 'Unknown Client'
    );
  const secondaryName =
    isBusinessWithCompany && decodedContact
      ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedContact))
      : decodedCompany
        ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany))
        : '-';

  const safeEmail = SanitizationUtils.escapeHtml(client.email || '');
  const safePhone = SanitizationUtils.formatPhone(client.phone || '');
  const status = client.status || 'pending';
  const clientAny = client as {
    last_login_at?: string;
    invitation_sent_at?: string;
    password_hash?: string;
    invited_at?: string;
  };

  // Check if client needs invitation (pending and never invited)
  // Check multiple fields: invitation_sent_at, password_hash (set after accepting invite), invited_at
  const hasBeenInvited =
    !!clientAny.invitation_sent_at || !!clientAny.password_hash || !!clientAny.invited_at;
  const showInviteBtn = status !== 'active' && !hasBeenInvited;

  // Prepare billing values
  const safeBillingName = decodedBillingName
    ? SanitizationUtils.escapeHtml(decodedBillingName)
    : '-';
  const safeBillingEmail =
    SanitizationUtils.escapeHtml(
      SanitizationUtils.decodeHtmlEntities(client.billing_email || client.email || '')
    ) || '';

  // Batch update all client detail fields (except status and emails which need copy button)
  // For business clients: primary = company name, secondary = contact name
  // For personal clients: primary = contact name, secondary = company name (if any)
  batchUpdateText({
    'cd-client-name': primaryName, // Header title - company for business, contact for personal
    'cd-company': secondaryName, // Secondary info - contact for business, company for personal
    'cd-phone': safePhone,
    'cd-client-type': clientType === 'personal' ? 'Personal' : 'Business',
    'cd-created': formatDate(client.created_at),
    'cd-last-login': clientAny.last_login_at ? formatDateTime(clientAny.last_login_at) : 'Never',
    // Billing summary (Overview tab)
    'cd-billing-name': safeBillingName,
    // Billing details (Invoices tab)
    'cd-billing-name-full': safeBillingName,
    'cd-billing-address': client.billing_address
      ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_address))
      : '-',
    'cd-billing-city': client.billing_city
      ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_city))
      : '-',
    'cd-billing-state': client.billing_state
      ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_state))
      : '-',
    'cd-billing-zip': client.billing_zip
      ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_zip))
      : '-',
    'cd-billing-country': client.billing_country
      ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_country))
      : '-'
  });

  // Email fields with copy button (not set via batchUpdateText)
  const cdEmailEl = document.getElementById('cd-email');
  if (cdEmailEl) cdEmailEl.innerHTML = getEmailWithCopyHtml(client.email || '', safeEmail);
  const cdBillingEmailEl = document.getElementById('cd-billing-email');
  if (cdBillingEmailEl) {
    cdBillingEmailEl.innerHTML = getEmailWithCopyHtml(
      client.billing_email || client.email || '',
      safeBillingEmail
    );
  }
  const cdBillingEmailFullEl = document.getElementById('cd-billing-email-full');
  if (cdBillingEmailFullEl) {
    cdBillingEmailFullEl.innerHTML = getEmailWithCopyHtml(
      client.billing_email || client.email || '',
      safeBillingEmail
    );
  }

  // Update header status badge
  const statusBadge = document.getElementById('cd-status-badge');
  if (statusBadge) {
    const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
    statusBadge.textContent = statusDisplay;
    statusBadge.className = `status-badge status-${status}`;
  }

  // Update status field in overview with invite button if needed
  const statusEl = document.getElementById('cd-status');
  if (statusEl) {
    const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
    if (showInviteBtn) {
      statusEl.innerHTML = `
        <span class="status-cell-wrapper">
          <span>${statusDisplay}</span>
          <button class="icon-btn client-invite" id="cd-invite-btn" data-client-id="${client.id}" title="Send invitation email" aria-label="Send invitation email to client">${ICONS.SEND}</button>
        </span>`;
      // Add click handler for the invite button
      const inviteBtn = document.getElementById('cd-invite-btn');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', async () => {
          await sendClientInvitation(client.id);
        });
      }
    } else {
      statusEl.textContent = statusDisplay;
    }
  }
}

/**
 * Setup inline editing for client detail view fields
 * Allows clicking on key fields to edit them in place
 */
function setupClientDetailInlineEditing(client: Client, ctx: AdminDashboardContext): void {
  const clientType = client.client_type || 'business';
  const isBusinessClient = clientType === 'business';

  // Phone field - inline editable
  const phoneEl = document.getElementById('cd-phone');
  if (phoneEl) {
    const phoneContainer = phoneEl.closest('.contact-inline-item') as HTMLElement;
    if (phoneContainer && !phoneContainer.dataset.inlineEditSetup) {
      phoneContainer.dataset.inlineEditSetup = 'true';
      phoneContainer.classList.add('inline-editable-cell');
      makeEditable(
        phoneContainer,
        () => client.phone || '',
        async (newValue) => {
          const response = await apiPut(`/api/admin/clients/${client.id}`, { phone: newValue });
          if (response.ok) {
            const result = await response.json();
            // Update local data
            clientsModule.updateItem(client.id, result.client);
            client.phone = newValue;
            phoneEl.textContent = SanitizationUtils.formatPhone(newValue);
            ctx.showNotification('Phone updated', 'success');
          } else {
            throw new Error('Failed to update phone');
          }
        },
        { placeholder: 'Enter phone number' }
      );
    }
  }

  // Company field - inline editable (for business clients, this is secondary)
  const companyEl = document.getElementById('cd-company');
  if (companyEl) {
    const companyContainer = companyEl.closest('.contact-inline-item') as HTMLElement;
    if (companyContainer && !companyContainer.dataset.inlineEditSetup) {
      companyContainer.dataset.inlineEditSetup = 'true';
      companyContainer.classList.add('inline-editable-cell');

      // For business clients: editing company edits contact_name (secondary display)
      // For personal clients: editing company edits company_name
      const fieldToUpdate = isBusinessClient ? 'contact_name' : 'company_name';
      const currentValue = isBusinessClient ? client.contact_name || '' : client.company_name || '';

      makeEditable(
        companyContainer,
        () => currentValue,
        async (newValue) => {
          const response = await apiPut(`/api/admin/clients/${client.id}`, {
            [fieldToUpdate]: newValue
          });
          if (response.ok) {
            const result = await response.json();
            clientsModule.updateItem(client.id, result.client);
            if (isBusinessClient) {
              client.contact_name = newValue;
            } else {
              client.company_name = newValue;
            }
            companyEl.textContent = SanitizationUtils.escapeHtml(
              SanitizationUtils.capitalizeName(newValue)
            );
            ctx.showNotification(`${isBusinessClient ? 'Contact' : 'Company'} updated`, 'success');
          } else {
            throw new Error('Failed to update');
          }
        },
        { placeholder: isBusinessClient ? 'Enter contact name' : 'Enter company name' }
      );
    }
  }

  // Client name (header) - inline editable
  const nameEl = document.getElementById('cd-client-name');
  if (nameEl) {
    const nameContainer = nameEl.closest('.detail-title-group') as HTMLElement;
    if (nameContainer && !nameContainer.dataset.inlineEditSetup) {
      nameContainer.dataset.inlineEditSetup = 'true';
      nameContainer.classList.add('inline-editable-cell');

      // For business clients: header shows company_name
      // For personal clients: header shows contact_name
      const fieldToUpdate = isBusinessClient ? 'company_name' : 'contact_name';
      const currentValue = isBusinessClient ? client.company_name || '' : client.contact_name || '';

      makeEditable(
        nameContainer,
        () => currentValue,
        async (newValue) => {
          if (!newValue.trim()) {
            throw new Error('Name cannot be empty');
          }
          const response = await apiPut(`/api/admin/clients/${client.id}`, {
            [fieldToUpdate]: newValue
          });
          if (response.ok) {
            const result = await response.json();
            clientsModule.updateItem(client.id, result.client);
            if (isBusinessClient) {
              client.company_name = newValue;
            } else {
              client.contact_name = newValue;
            }
            nameEl.textContent = SanitizationUtils.escapeHtml(
              SanitizationUtils.capitalizeName(newValue)
            );
            ctx.showNotification(
              `${isBusinessClient ? 'Company' : 'Contact'} name updated`,
              'success'
            );
          } else {
            throw new Error('Failed to update name');
          }
        },
        { placeholder: isBusinessClient ? 'Enter company name' : 'Enter contact name' }
      );
    }
  }
}

function setupClientDetailHandlers(client: Client, ctx: AdminDashboardContext): void {
  // Quick action icon buttons in header
  const sendInviteBtn = document.getElementById('cd-btn-send-invite');
  if (sendInviteBtn && !sendInviteBtn.hasAttribute('data-listener-added')) {
    sendInviteBtn.setAttribute('data-listener-added', 'true');
    sendInviteBtn.addEventListener('click', () => resendClientInvite(client.id));
  }

  const editBtn = document.getElementById('cd-btn-edit');
  if (editBtn && !editBtn.hasAttribute('data-listener-added')) {
    editBtn.setAttribute('data-listener-added', 'true');
    editBtn.addEventListener('click', () => editClientInfo(client.id, ctx));
  }

  // Edit billing button (in Overview tab)
  const editBillingBtn = domCache.get('editBillingBtn', true);
  if (editBillingBtn) {
    const newEditBillingBtn = editBillingBtn.cloneNode(true) as HTMLElement;
    editBillingBtn.parentNode?.replaceChild(newEditBillingBtn, editBillingBtn);
    domCache.invalidate('editBillingBtn');
    newEditBillingBtn.addEventListener('click', () => editClientBilling(client.id, ctx));
  }

  // Edit billing button (in Invoices tab)
  const editBillingBtnInvoices = document.getElementById('cd-btn-edit-billing-invoices');
  if (editBillingBtnInvoices && !editBillingBtnInvoices.hasAttribute('data-listener-added')) {
    editBillingBtnInvoices.setAttribute('data-listener-added', 'true');
    editBillingBtnInvoices.addEventListener('click', () => editClientBilling(client.id, ctx));
  }

  // More Menu dropdown - handles all actions including edit
  const moreMenu = domCache.get('moreMenu', true);
  if (moreMenu) {
    const trigger = moreMenu.querySelector('.custom-dropdown-trigger');
    const menuItems = moreMenu.querySelectorAll('.custom-dropdown-item');

    // Toggle dropdown on trigger click
    if (trigger && !trigger.hasAttribute('data-listener-added')) {
      trigger.setAttribute('data-listener-added', 'true');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        moreMenu.classList.toggle('open');
      });
    }

    // Handle menu item clicks
    menuItems.forEach((item) => {
      const itemEl = item as HTMLElement;
      if (itemEl.hasAttribute('data-listener-added')) return;
      itemEl.setAttribute('data-listener-added', 'true');

      itemEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = itemEl.dataset.action;
        moreMenu.classList.remove('open');

        switch (action) {
        case 'edit':
          editClientInfo(client.id, ctx);
          break;
        case 'resend-invite':
          await resendClientInvite(client.id);
          break;
        case 'reset-password':
          await resetClientPassword(client.id);
          break;
        case 'archive':
          await archiveClient(client.id, ctx);
          break;
        case 'delete':
          await deleteClient(client.id);
          ctx.switchTab('clients');
          break;
        }
      });
    });

    // Close dropdown when clicking outside
    const closeHandler = (e: MouseEvent) => {
      if (!moreMenu.contains(e.target as Node)) {
        moreMenu.classList.remove('open');
      }
    };
    document.addEventListener('click', closeHandler);
  }
}

async function loadClientProjects(clientId: number): Promise<void> {
  const container = domCache.get('projectsList');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/clients/${clientId}/projects`);

    if (response.ok) {
      const data = (await response.json()) as { projects?: ProjectResponse[] };
      renderClientProjects(data.projects || [], container);
    } else {
      renderEmptyState(container, 'No projects found for this client.');
    }
  } catch (error) {
    logger.error(' Failed to load client projects:', error);
    renderErrorState(container, 'Failed to load projects.', { type: 'general' });
  }
}

function renderClientProjects(projects: ProjectResponse[], container: HTMLElement): void {
  if (projects.length === 0) {
    renderEmptyState(container, 'No projects found for this client.');
    return;
  }

  container.innerHTML = projects
    .map((project) => {
      const safeName = SanitizationUtils.escapeHtml(project.project_name || 'Untitled Project');
      const status = project.status || 'pending';
      const date = formatDate(project.created_at);

      return `
        <div class="client-project-item" data-project-id="${project.id}">
          <div class="project-info">
            <span class="project-name">${safeName}</span>
            <span class="project-status status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span>
          </div>
          <span class="project-date">${date}</span>
        </div>
      `;
    })
    .join('');

  // Add click handlers to navigate to project
  container.querySelectorAll('.client-project-item').forEach((item) => {
    item.addEventListener('click', () => {
      const projectId = parseInt((item as HTMLElement).dataset.projectId || '0');
      const ctx = clientsModule.getContext();
      if (projectId && ctx) {
        ctx.switchTab('projects');
        // Delay to allow tab switch, then show project details
        setTimeout(() => {
          import('./admin-projects').then((module) => {
            module.showProjectDetails(projectId, ctx);
          });
        }, 100);
      }
    });
  });
}

async function loadClientBilling(clientId: number): Promise<void> {
  const container = domCache.get('invoicesList');
  const totalInvoicedEl = domCache.get('totalInvoiced');
  const totalPaidEl = domCache.get('totalPaid');
  const outstandingEl = domCache.get('outstanding');

  try {
    const response = await apiFetch(`/api/invoices/client/${clientId}`);

    if (response.ok) {
      const data = (await response.json()) as { invoices?: InvoiceResponse[] };
      const invoices: InvoiceResponse[] = data.invoices || [];

      // Calculate billing totals
      let totalInvoiced = 0;
      let totalPaid = 0;

      invoices.forEach((inv: InvoiceResponse) => {
        const amount =
          typeof inv.amount_total === 'string'
            ? parseFloat(inv.amount_total)
            : inv.amount_total || 0;
        totalInvoiced += amount;
        if (inv.status === 'paid') {
          totalPaid += amount;
        }
      });

      const outstanding = totalInvoiced - totalPaid;
      const unpaidCount = invoices.filter((inv) => inv.status !== 'paid').length;

      // Update summary
      if (totalInvoicedEl) totalInvoicedEl.textContent = formatCurrency(totalInvoiced);
      if (totalPaidEl) totalPaidEl.textContent = formatCurrency(totalPaid);
      if (outstandingEl) outstandingEl.textContent = formatCurrency(outstanding);

      // Update overview card: outstanding / unpaid invoice count
      const outstandingCountEl = domCache.get('outstandingInvoicesCount');
      if (outstandingCountEl) {
        outstandingCountEl.textContent = unpaidCount > 0 ? unpaidCount.toString() : '0';
      }

      // Render invoices list
      if (container) {
        renderClientInvoices(invoices, container);
      }
    } else {
      if (container) {
        renderEmptyState(container, 'No invoices found for this client.');
      }
      const outstandingCountEl = domCache.get('outstandingInvoicesCount');
      if (outstandingCountEl) outstandingCountEl.textContent = '0';
    }
  } catch (error) {
    logger.error(' Failed to load client billing:', error);
    if (container) {
      renderErrorState(container, 'Failed to load billing data.', { type: 'general' });
    }
    const outstandingCountEl = domCache.get('outstandingInvoicesCount');
    if (outstandingCountEl) outstandingCountEl.textContent = '-';
  }
}

function renderClientInvoices(invoices: InvoiceResponse[], container: HTMLElement): void {
  if (invoices.length === 0) {
    renderEmptyState(container, 'No invoices found for this client.');
    return;
  }

  container.innerHTML = invoices
    .map((invoice) => {
      const invoiceNumber = SanitizationUtils.escapeHtml(invoice.invoice_number || '');
      const amountValue =
        typeof invoice.amount_total === 'string'
          ? parseFloat(invoice.amount_total)
          : invoice.amount_total || 0;
      const amount = formatCurrency(amountValue);
      const date = formatDate(invoice.created_at || invoice.due_date);
      const status = invoice.status || 'pending';

      return `
        <div class="client-invoice-item">
          <div class="invoice-info">
            <span class="invoice-number">${invoiceNumber}</span>
            <span class="invoice-date">${date}</span>
          </div>
          <div class="invoice-details">
            <span class="invoice-amount">${amount}</span>
            <span class="invoice-status status-${status}">${status}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

// ============================================
// CLIENT ACTIONS
// ============================================

async function resetClientPassword(clientId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Reset Password',
    message: 'Send a password reset email to this client?',
    confirmText: 'Send Email',
    icon: 'question'
  });
  if (!confirmed) return;

  try {
    // Backend uses send-invite which sends a link to set/change password (same outcome for client)
    const response = await apiPost(`/api/clients/${clientId}/send-invite`);

    if (response.ok) {
      showToast('Password reset link sent to client', 'success');
    } else {
      showToast('Failed to send password reset', 'error');
    }
  } catch (error) {
    logger.error(' Error resetting password:', error);
    showToast('Error sending password reset', 'error');
  }
}

async function resendClientInvite(clientId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Resend Invitation',
    message: 'Resend the portal invitation to this client?',
    confirmText: 'Resend',
    icon: 'question'
  });
  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/clients/${clientId}/send-invite`);

    if (response.ok) {
      showToast('Invitation resent successfully', 'success');
    } else {
      showToast('Failed to resend invitation', 'error');
    }
  } catch (error) {
    logger.error(' Error resending invite:', error);
    showToast('Error resending invitation', 'error');
  }
}

/**
 * Send invitation to a client who hasn't been invited yet
 * Called from the inline "Invite" button in the clients table
 */
async function sendClientInvitation(clientId: number): Promise<void> {
  const client = clientsModule.findById(clientId);
  if (!client) {
    showToast('Client not found', 'error');
    return;
  }

  const clientName = SanitizationUtils.decodeHtmlEntities(client.contact_name || client.email);
  const confirmed = await confirmDialog({
    title: 'Send Invitation',
    message: `Send portal invitation to ${clientName}?`,
    confirmText: 'Send Invitation',
    icon: 'question'
  });
  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/clients/${clientId}/send-invite`);

    if (response.ok) {
      showToast('Invitation sent successfully', 'success');
      // Update local client data and re-render
      clientsModule.updateItem(clientId, { invitation_sent_at: new Date().toISOString() });
    } else {
      showToast('Failed to send invitation. Please try again.', 'error');
    }
  } catch (error) {
    logger.error(' Error sending invite:', error);
    showToast('Failed to send invitation. Please try again.', 'error');
  }
}

export function editClientInfo(clientId: number, ctx: AdminDashboardContext): void {
  const client = clientsModule.findById(clientId);
  if (!client) {
    logger.error(' Client not found:', clientId);
    return;
  }

  const modal = domCache.get('editInfoModal');
  const form = domCache.getAs<HTMLFormElement>('editInfoForm');
  const closeBtn = domCache.get('editInfoClose');
  const cancelBtn = domCache.get('editInfoCancel');

  if (!modal || !form) return;

  // Form inputs - query fresh since values change between openings
  const emailInput = getElement('edit-client-email') as HTMLInputElement;
  const nameInput = getElement('edit-client-name') as HTMLInputElement;
  const companyInput = getElement('edit-client-company') as HTMLInputElement;
  const phoneInput = getElement('edit-client-phone') as HTMLInputElement;

  if (emailInput) emailInput.value = client.email || '';
  if (nameInput) nameInput.value = client.contact_name || '';
  if (companyInput) companyInput.value = client.company_name || '';
  if (phoneInput) phoneInput.value = client.phone || '';

  // Status dropdown: modal dropdown (matches form field styling)
  const statusMount = getElement('edit-client-status-mount');
  if (statusMount) {
    statusMount.innerHTML = '';
    const statusDropdown = createModalDropdown({
      options: [
        { value: 'active', label: 'Active' },
        { value: 'pending', label: 'Pending' },
        { value: 'inactive', label: 'Inactive' }
      ],
      currentValue: client.status || 'pending',
      ariaLabelPrefix: 'Status'
    });
    statusMount.appendChild(statusDropdown);
  }

  // Show modal and lock body scroll
  openModalOverlay(modal);

  // Store cleanup function - assigned after manageFocusTrap call
  let cleanupFocusTrap: (() => void) | null = null;

  // Close handlers - defined before manageFocusTrap so it can be referenced
  const closeModal = () => {
    cleanupFocusTrap?.();
    closeModalOverlay(modal);
  };

  // Setup focus trap
  cleanupFocusTrap = manageFocusTrap(modal, {
    initialFocus: emailInput,
    onClose: closeModal
  });

  const closeHandler = () => closeModal();
  closeBtn?.addEventListener('click', closeHandler, { once: true });
  cancelBtn?.addEventListener('click', closeHandler, { once: true });

  // Click outside to close
  const overlayHandler = (e: Event) => {
    if (e.target === modal) closeModal();
  };
  modal.addEventListener('click', overlayHandler, { once: true });

  // Form submit handler
  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const newEmail = emailInput?.value.trim();
    const newName = nameInput?.value.trim();
    const newCompany = companyInput?.value.trim();
    const newPhone = phoneInput?.value.trim();
    const newStatus =
      statusMount?.querySelector('.modal-dropdown')?.getAttribute('data-value') ?? '';

    // Validate email format if provided
    if (newEmail) {
      const emailValidation = validateEmail(newEmail, { allowDisposable: true });
      if (!emailValidation.isValid) {
        showToast(emailValidation.error || 'Invalid email format', 'error');
        return;
      }
    }

    await withButtonLoading(
      submitBtn,
      async () => {
        const response = await apiPut(`/api/clients/${clientId}`, {
          email: newEmail || null,
          contact_name: newName || null,
          company_name: newCompany || null,
          phone: newPhone || null,
          status: newStatus
        });

        if (response.ok) {
          const result = await response.json();
          if (result.client) {
            showToast('Client info updated successfully', 'success');
            closeModal();
            // Update local client data via factory (preserves project_count)
            const existingClient = clientsModule.findById(clientId);
            if (existingClient) {
              clientsModule.updateItem(clientId, {
                ...result.client,
                project_count: existingClient.project_count
              });
            }
            showClientDetails(clientId, ctx);
          } else {
            showToast(result.error || 'Failed to update client info', 'error');
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          showToast(errorData.error || 'Failed to update client info', 'error');
        }
      },
      'Saving...'
    );
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

function editClientBilling(clientId: number, ctx: AdminDashboardContext): void {
  const client = clientsModule.findById(clientId);
  if (!client) {
    logger.error(' Client not found:', clientId);
    return;
  }

  const modal = domCache.get('editBillingModal');
  const form = domCache.getAs<HTMLFormElement>('editBillingForm');
  const closeBtn = domCache.get('editBillingClose');
  const cancelBtn = domCache.get('editBillingCancel');

  if (!modal || !form) return;

  // Form inputs - query fresh since values change between openings
  const nameInput = getElement('edit-billing-name') as HTMLInputElement;
  const emailInput = getElement('edit-billing-email') as HTMLInputElement;
  const addressInput = getElement('edit-billing-address') as HTMLInputElement;
  const cityInput = getElement('edit-billing-city') as HTMLInputElement;
  const stateInput = getElement('edit-billing-state') as HTMLInputElement;
  const zipInput = getElement('edit-billing-zip') as HTMLInputElement;
  const countryInput = getElement('edit-billing-country') as HTMLInputElement;

  if (nameInput) nameInput.value = client.billing_name || client.contact_name || '';
  if (emailInput) emailInput.value = client.billing_email || client.email || '';
  if (addressInput) addressInput.value = client.billing_address || '';
  if (cityInput) cityInput.value = client.billing_city || '';
  if (stateInput) stateInput.value = client.billing_state || '';
  if (zipInput) zipInput.value = client.billing_zip || '';
  if (countryInput) countryInput.value = client.billing_country || '';

  // Show modal and lock body scroll
  openModalOverlay(modal);

  // Store cleanup function - assigned after manageFocusTrap call
  let cleanupFocusTrap: (() => void) | null = null;

  // Close handlers - defined before manageFocusTrap so it can be referenced
  const closeModal = () => {
    cleanupFocusTrap?.();
    closeModalOverlay(modal);
  };

  // Setup focus trap
  cleanupFocusTrap = manageFocusTrap(modal, {
    initialFocus: nameInput,
    onClose: closeModal
  });

  const closeHandler = () => closeModal();
  closeBtn?.addEventListener('click', closeHandler, { once: true });
  cancelBtn?.addEventListener('click', closeHandler, { once: true });

  // Click outside to close
  const overlayHandler = (e: Event) => {
    if (e.target === modal) closeModal();
  };
  modal.addEventListener('click', overlayHandler, { once: true });

  // Form submit handler
  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const newBillingName = nameInput?.value.trim();
    const newBillingEmail = emailInput?.value.trim();
    const newBillingAddress = addressInput?.value.trim();
    const newBillingCity = cityInput?.value.trim();
    const newBillingState = stateInput?.value.trim();
    const newBillingZip = zipInput?.value.trim();
    const newBillingCountry = countryInput?.value.trim();

    // Validate billing email format if provided
    if (newBillingEmail) {
      const emailValidation = validateEmail(newBillingEmail, { allowDisposable: true });
      if (!emailValidation.isValid) {
        showToast(emailValidation.error || 'Invalid billing email format', 'error');
        return;
      }
    }

    await withButtonLoading(
      submitBtn,
      async () => {
        const response = await apiPut(`/api/clients/${clientId}`, {
          billing_name: newBillingName || null,
          billing_email: newBillingEmail || null,
          billing_address: newBillingAddress || null,
          billing_city: newBillingCity || null,
          billing_state: newBillingState || null,
          billing_zip: newBillingZip || null,
          billing_country: newBillingCountry || null
        });

        if (response.ok) {
          showToast('Billing details updated successfully', 'success');
          closeModal();
          await clientsModule.load(ctx);
          showClientDetails(clientId, ctx);
        } else {
          showToast('Failed to update billing details', 'error');
        }
      },
      'Saving...'
    );
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

async function archiveClient(clientId: number, ctx: AdminDashboardContext): Promise<void> {
  const client = clientsModule.findById(clientId);
  if (!client) {
    logger.error(' Client not found:', clientId);
    return;
  }

  const clientName = SanitizationUtils.decodeHtmlEntities(client.contact_name || client.email);
  const confirmed = await confirmDialog({
    title: 'Archive Client',
    message: `Archive "${clientName}"? They can be restored from the clients list later.`,
    confirmText: 'Archive',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    const response = await apiPut(`/api/clients/${clientId}`, { status: 'inactive' });

    if (response.ok) {
      showToast('Client archived', 'success');
      await clientsModule.load(ctx);
      showClientDetails(clientId, ctx);
    } else {
      showToast('Failed to archive client', 'error');
    }
  } catch (error) {
    logger.error(' Error archiving client:', error);
    showToast('Error archiving client', 'error');
  }
}

async function deleteClient(clientId: number): Promise<void> {
  const client = clientsModule.findById(clientId);
  if (!client) {
    logger.error(' Client not found:', clientId);
    return;
  }

  const deleteClientName = SanitizationUtils.decodeHtmlEntities(
    client.contact_name || client.email
  );
  const confirmed = await confirmDanger(
    `Are you sure you want to delete client "${deleteClientName}"? This cannot be undone.`,
    'Delete Client'
  );
  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/clients/${clientId}`);

    if (response.ok) {
      showToast('Client deleted successfully', 'success');
      const ctx = clientsModule.getContext();
      if (ctx) clientsModule.load(ctx);
    } else {
      showToast('Failed to delete client', 'error');
    }
  } catch (error) {
    logger.error(' Error deleting client:', error);
    showToast('Error deleting client', 'error');
  }
}

function addClient(ctx: AdminDashboardContext): void {
  const modalEl = domCache.get('addClientModal');
  const formEl = domCache.getAs<HTMLFormElement>('addClientForm');
  const closeBtn = domCache.get('addClientClose');
  const cancelBtn = domCache.get('addClientCancel');

  if (!modalEl || !formEl) return;

  // Capture validated references for use in nested functions
  const modal = modalEl;
  const form = formEl;

  // Reset form
  form.reset();

  // Show modal and lock body scroll
  openModalOverlay(modal);

  // Track if form was submitted successfully to avoid double cleanup
  let submitted = false;

  // Setup focus trap
  let cleanupFocusTrap: (() => void) | null = null;

  // Close modal and clean up event listeners (function declaration for hoisting)
  function closeModal(): void {
    if (!submitted) {
      form.removeEventListener('submit', handleSubmit);
    }
    cleanupFocusTrap?.();
    closeModalOverlay(modal);
    form.reset();
  }

  // Form submit handler (function declaration for hoisting)
  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    // Form inputs - query fresh for current values
    const emailInput = getElement('new-client-email') as HTMLInputElement;
    const nameInput = getElement('new-client-name') as HTMLInputElement;
    const companyInput = getElement('new-client-company') as HTMLInputElement;
    const phoneInput = getElement('new-client-phone') as HTMLInputElement;

    const email = emailInput?.value.trim();
    const contactName = nameInput?.value.trim();
    const companyName = companyInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!email) {
      showToast('Email is required', 'error');
      return;
    }

    // Validate email format
    const emailValidation = validateEmail(email, { allowDisposable: true });
    if (!emailValidation.isValid) {
      showToast(emailValidation.error || 'Invalid email format', 'error');
      return;
    }

    await withButtonLoading(
      submitBtn,
      async () => {
        const response = await apiPost('/api/clients', {
          email,
          contact_name: contactName || null,
          company_name: companyName || null,
          phone: phone || null,
          status: 'pending'
        });

        if (response.ok) {
          showToast('Client added successfully', 'success');
          submitted = true;
          form.removeEventListener('submit', handleSubmit);
          closeModal();
          await clientsModule.load(ctx);
        } else {
          showToast('Failed to add client. Please try again.', 'error');
        }
      },
      'Adding...'
    );
  }

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });

  // Click outside to close
  modal.addEventListener(
    'click',
    (e) => {
      if (e.target === modal) closeModal();
    },
    { once: true }
  );

  // Add form submit listener (not once - will be removed on success or modal close)
  form.addEventListener('submit', handleSubmit);

  // Setup focus trap after event listeners are attached
  cleanupFocusTrap = manageFocusTrap(modal, {
    initialFocus: '#new-client-email',
    onClose: closeModal
  });
}

// ============================================
// BULK ACTIONS
// ============================================

/**
 * Bulk archive selected clients
 */
async function bulkArchiveClients(clientIds: number[]): Promise<void> {
  const ctx = clientsModule.getContext();
  if (!ctx) return;

  try {
    // Archive each client (set status to inactive)
    const results = await Promise.all(
      clientIds.map((id) =>
        apiPut(`/api/clients/${id}`, { status: 'inactive' })
          .then((res) => ({ id, success: res.ok }))
          .catch(() => ({ id, success: false }))
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (successCount > 0) {
      showToast(
        `Archived ${successCount} client${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        failCount > 0 ? 'warning' : 'success'
      );
      // Reload clients
      await clientsModule.load(ctx);
    } else {
      showToast('Failed to archive clients', 'error');
    }
  } catch (error) {
    logger.error(' Bulk archive error:', error);
    showToast('Error archiving clients', 'error');
  }
}

/**
 * Bulk delete selected clients
 */
async function bulkDeleteClients(clientIds: number[]): Promise<void> {
  const ctx = clientsModule.getContext();
  if (!ctx) return;

  try {
    // Delete each client
    const results = await Promise.all(
      clientIds.map((id) =>
        apiDelete(`/api/clients/${id}`)
          .then((res) => ({ id, success: res.ok }))
          .catch(() => ({ id, success: false }))
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (successCount > 0) {
      showToast(
        `Deleted ${successCount} client${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        failCount > 0 ? 'warning' : 'success'
      );
      // Reload clients
      await clientsModule.load(ctx);
    } else {
      showToast('Failed to delete clients', 'error');
    }
  } catch (error) {
    logger.error(' Bulk delete error:', error);
    showToast('Error deleting clients', 'error');
  }
}
