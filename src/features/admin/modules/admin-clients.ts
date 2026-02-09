/**
 * ===============================================
 * ADMIN CLIENTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-clients.ts
 *
 * Client management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import type { AdminDashboardContext } from '../admin-types';
import type {
  ProjectResponse,
  InvoiceResponse
} from '../../../types/api';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format-utils';
import { createModalDropdown } from '../../../components/modal-dropdown';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  CLIENTS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import { exportToCsv, CLIENTS_EXPORT_CONFIG } from '../../../utils/table-export';
import {
  createPaginationUI,
  applyPagination,
  getDefaultPaginationState,
  loadPaginationState,
  savePaginationState,
  type PaginationState,
  type PaginationConfig
} from '../../../utils/table-pagination';
import {
  createBulkActionToolbar,
  setupBulkSelectionHandlers,
  resetSelection,
  createRowCheckbox,
  type BulkActionConfig
} from '../../../utils/table-bulk-actions';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { confirmDialog, confirmDanger } from '../../../utils/confirm-dialog';
import { showTableError } from '../../../utils/error-utils';
import { createDOMCache, batchUpdateText, getElement } from '../../../utils/dom-cache';
import { withButtonLoading } from '../../../utils/button-loading';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { validateEmail } from '../../../../shared/validation/validators';
import { getHealthBadgeHtml } from './admin-client-details';
import { getStatusDotHTML } from '../../../components/status-badge';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { showToast } from '../../../utils/toast-notifications';

// ============================================
// DOM CACHE - Cached element references
// ============================================

/** DOM element selector keys for the clients module */
type ClientsDOMKeys = {
  // Table elements
  tableBody: string;
  filterContainer: string;
  refreshBtn: string;
  addBtn: string;
  exportBtn: string;
  bulkToolbar: string;
  pagination: string;
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
};

/** Cached DOM element references for performance */
const domCache = createDOMCache<ClientsDOMKeys>();

// Register all element selectors (called once when module loads)
domCache.register({
  // Table elements
  tableBody: '#clients-table-body',
  filterContainer: '#clients-filter-container',
  refreshBtn: '#refresh-clients-btn',
  addBtn: '#add-client-btn',
  exportBtn: '#export-clients-btn',
  bulkToolbar: '#clients-bulk-toolbar',
  pagination: '#clients-pagination',
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
  addClientCancel: '#add-client-cancel'
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

interface ClientsData {
  clients: Client[];
  stats: {
    total: number;
    active: number;
    pending: number;
    inactive: number;
  };
}

let clientsData: Client[] = [];
let storedContext: AdminDashboardContext | null = null;
let currentClientId: number | null = null;
let filterState: FilterState = loadFilterState(CLIENTS_FILTER_CONFIG.storageKey);
let filterUIInitialized = false;

// Pagination configuration and state
const CLIENTS_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'clients',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_clients_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(CLIENTS_PAGINATION_CONFIG),
  ...loadPaginationState(CLIENTS_PAGINATION_CONFIG.storageKey!)
};

// Bulk action configuration
const CLIENTS_BULK_CONFIG: BulkActionConfig = {
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
};

export function getCurrentClientId(): number | null {
  return currentClientId;
}

export function setCurrentClientId(id: number | null): void {
  currentClientId = id;
}

export function getClientsData(): Client[] {
  return clientsData;
}

export function getCurrentClientName(): string | null {
  if (!currentClientId) return null;
  const client = clientsData.find(c => c.id === currentClientId);
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

export async function loadClients(ctx: AdminDashboardContext): Promise<void> {
  storedContext = ctx;

  // Initialize filter UI once
  if (!filterUIInitialized) {
    initializeFilterUI(ctx);
    filterUIInitialized = true;
  }

  // Show loading state (use cached ref)
  const tableBody = domCache.get('tableBody');
  if (tableBody) {
    showTableLoading(tableBody, 8, 'Loading clients...');
  }

  try {
    const response = await apiFetch('/api/clients');

    if (response.ok) {
      const data = await response.json();
      clientsData = data.clients || [];

      // Calculate stats
      const stats = {
        total: clientsData.length,
        active: clientsData.filter(c => c.status === 'active').length,
        pending: clientsData.filter(c => c.status === 'pending').length,
        inactive: clientsData.filter(c => c.status === 'inactive').length
      };

      updateClientsDisplay({ clients: clientsData, stats }, ctx);
    } else {
      const errorText = await response.text();
      console.error('[AdminClients] API error:', response.status, errorText);
      if (tableBody) {
        showTableError(
          tableBody,
          6,
          `Error loading clients (${response.status})`,
          () => loadClients(ctx)
        );
      }
    }
  } catch (error) {
    console.error('[AdminClients] Failed to load clients:', error);
    if (tableBody) {
      showTableError(
        tableBody,
        6,
        'Network error loading clients',
        () => loadClients(ctx)
      );
    }
  }
}

/**
 * Initialize filter UI for clients table
 */
function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = domCache.get('filterContainer');
  if (!container) return;

  // Create filter UI
  const filterUI = createFilterUI(
    CLIENTS_FILTER_CONFIG,
    filterState,
    (newState) => {
      filterState = newState;
      // Reset to first page when filters change
      paginationState.currentPage = 1;
      // Re-render table with new filters
      if (clientsData.length > 0) {
        renderClientsTable(clientsData, ctx);
      }
    }
  );

  // Insert before export button (Search → Filter → Export → Refresh → Add order)
  const exportBtn = domCache.get('exportBtn');
  if (exportBtn) {
    container.insertBefore(filterUI, exportBtn);
  } else {
    container.appendChild(filterUI);
  }

  // Setup sortable headers after table is rendered
  setTimeout(() => {
    createSortableHeaders(CLIENTS_FILTER_CONFIG, filterState, (column, direction) => {
      filterState = { ...filterState, sortColumn: column, sortDirection: direction };
      saveFilterState(CLIENTS_FILTER_CONFIG.storageKey, filterState);
      if (clientsData.length > 0) {
        renderClientsTable(clientsData, ctx);
      }
    });
  }, 100);

  // Setup export button
  const exportBtnEl = domCache.get('exportBtn');
  if (exportBtnEl && !exportBtnEl.dataset.listenerAdded) {
    exportBtnEl.dataset.listenerAdded = 'true';
    exportBtnEl.addEventListener('click', () => {
      // Export filtered data
      const filteredClients = applyFilters(clientsData, filterState, CLIENTS_FILTER_CONFIG);
      exportToCsv(filteredClients as unknown as Record<string, unknown>[], CLIENTS_EXPORT_CONFIG);
      showToast(`Exported ${filteredClients.length} clients to CSV`, 'success');
    });
  }

  // Setup bulk action toolbar
  const bulkToolbarContainer = domCache.get('bulkToolbar');
  if (bulkToolbarContainer) {
    const toolbar = createBulkActionToolbar({
      ...CLIENTS_BULK_CONFIG,
      onSelectionChange: () => {
        // Selection change callback if needed
      }
    });
    bulkToolbarContainer.replaceWith(toolbar);
    // Re-register with new element
    domCache.invalidate('bulkToolbar');
  }
}

function updateClientsDisplay(data: ClientsData, ctx: AdminDashboardContext): void {
  // Update stats using batch update
  batchUpdateText({
    'clients-total': data.stats.total.toString(),
    'clients-active': data.stats.active.toString(),
    'clients-pending': data.stats.pending.toString(),
    'clients-inactive': data.stats.inactive.toString()
  });

  // Update table
  renderClientsTable(data.clients, ctx);

  // Setup refresh button (only add listener once, use cached ref)
  const refreshBtn = domCache.get('refreshBtn');
  if (refreshBtn && !refreshBtn.dataset.listenerAdded) {
    refreshBtn.dataset.listenerAdded = 'true';
    refreshBtn.addEventListener('click', () => loadClients(ctx));
  }

  // Setup add client button (only add listener once, use cached ref)
  const addBtn = domCache.get('addBtn');
  if (addBtn && !addBtn.dataset.listenerAdded) {
    addBtn.dataset.listenerAdded = 'true';
    addBtn.addEventListener('click', () => addClient(ctx));
  }
}

function renderClientsTable(clients: Client[], ctx: AdminDashboardContext): void {
  const tableBody = domCache.get('tableBody');
  if (!tableBody) return;

  if (!clients || clients.length === 0) {
    showTableEmpty(tableBody, 7, 'No clients yet.');
    renderPaginationUI(0, ctx);
    return;
  }

  // Apply filters
  const filteredClients = applyFilters(clients, filterState, CLIENTS_FILTER_CONFIG);

  if (filteredClients.length === 0) {
    showTableEmpty(tableBody, 7, 'No clients match the current filters. Try adjusting your filters.');
    renderPaginationUI(0, ctx);
    return;
  }

  // Update pagination state with total items
  paginationState.totalItems = filteredClients.length;

  // Apply pagination
  const paginatedClients = applyPagination(filteredClients, paginationState);

  // Reset bulk selection when data changes
  resetSelection('clients');

  tableBody.innerHTML = paginatedClients
    .map((client) => {
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
        isBusinessWithCompany ? decodedCompany : (decodedContact || '')
      );
      const safeEmail = SanitizationUtils.escapeHtml(client.email || '');
      // Secondary info: contact for business, company for personal
      const safeCompany = isBusinessWithCompany
        ? (decodedContact ? SanitizationUtils.escapeHtml(decodedContact) : '')
        : (decodedCompany ? SanitizationUtils.escapeHtml(decodedCompany) : '');
      const projectCount = client.project_count || 0;

      const typeLabel = clientType === 'personal' ? 'Personal' : 'Business';

      // Determine invitation/status display
      // Status logic: active = activated, pending + invited = waiting, pending + not invited = not invited
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
        // Pending but invitation was sent
        statusDisplay = 'Invited';
        statusClass = 'status-pending';
      } else {
        // Pending and never invited - show invite button
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

      // Invite button for actions column (if not yet invited)
      const inviteBtn = showInviteBtn
        ? `<button class="icon-btn icon-btn-invite" data-client-id="${client.id}" title="Send invitation email" aria-label="Send invitation email to client">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
             </svg>
           </button>`
        : '';

      // Health badge (available for future use)
      const _healthBadge = getHealthBadgeHtml(client.health_score);

      // Standard column order: ☐ | Client (name+email+company) | Type | Status | Projects | Created | Last Active | Actions
      return `
        <tr data-client-id="${client.id}" class="clickable-row">
          ${createRowCheckbox('clients', client.id)}
          <td class="identity-cell contact-cell">
            <span class="identity-name">${safeName}</span>
            ${safeCompany ? `<span class="identity-contact">${safeCompany}</span>` : ''}
            <span class="identity-email">${safeEmail}</span>
          </td>
          <td class="type-cell">${typeLabel}</td>
          <td class="status-cell">${statusCell}</td>
          <td class="count-cell">${projectCount}</td>
          <td class="date-cell created-cell">
            <span class="date-value">${date}</span>
            <span class="last-active-stacked">${lastActive}</span>
          </td>
          <td class="date-cell last-active-cell">${lastActive}</td>
          <td class="actions-cell">
            <div class="table-actions">
              ${inviteBtn}
              <button class="icon-btn btn-view-client" data-client-id="${client.id}" title="View Client" aria-label="View client details">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Row click to view details (but not on checkbox or invite button)
  tableBody.querySelectorAll('tr[data-client-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Don't navigate if clicking the checkbox, invite button, or bulk select cell
      if (target.closest('.bulk-select-cell') ||
          target.closest('.btn-invite-inline') ||
          target.closest('.icon-btn-invite') ||
          target.tagName === 'INPUT') {
        return;
      }
      const clientId = parseInt((row as HTMLElement).dataset.clientId || '0');
      if (clientId) showClientDetails(clientId);
    });
  });

  // Invite button click handlers (icon button next to status)
  tableBody.querySelectorAll('.icon-btn-invite').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent row click
      const clientId = parseInt((btn as HTMLElement).dataset.clientId || '0');
      if (clientId) {
        await sendClientInvitation(clientId);
      }
    });
  });

  // Setup bulk selection handlers
  const allRowIds = paginatedClients.map(c => c.id);
  setupBulkSelectionHandlers(CLIENTS_BULK_CONFIG, allRowIds);

  // Render pagination
  renderPaginationUI(filteredClients.length, ctx);
}

export async function showClientDetails(clientId: number, ctx?: AdminDashboardContext): Promise<void> {
  const context = ctx || storedContext;
  if (!context) {
    console.error('[AdminClients] No context available');
    return;
  }

  const client = clientsData.find(c => c.id === clientId);
  if (!client) {
    console.error('[AdminClients] Client not found:', clientId);
    return;
  }


  currentClientId = clientId;

  // Switch to client-detail tab
  context.switchTab('client-detail');

  // Populate the detail view
  populateClientDetailView(client);

  // Setup event handlers
  setupClientDetailHandlers(client, context);

  // Load client's projects and billing
  loadClientProjects(clientId);
  loadClientBilling(clientId);

  // Initialize enhanced CRM features (contacts, activity, notes, tags)
  try {
    const clientDetailsModule = await import('./admin-client-details');
    await clientDetailsModule.initClientDetailView(clientId, context);
  } catch (error) {
    console.error('[AdminClients] Failed to load CRM features:', error);
  }
}

function populateClientDetailView(client: Client): void {
  // Prepare sanitized values (decode entities before escape to fix &amp;amp; etc.)
  const decodedContact = SanitizationUtils.decodeHtmlEntities(client.contact_name || '');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(client.company_name || '');
  const decodedBillingName = SanitizationUtils.decodeHtmlEntities(client.billing_name || client.contact_name || '');
  const clientType = client.client_type || 'business';

  // For business clients with company name, company is primary; otherwise contact name is primary
  const isBusinessWithCompany = clientType === 'business' && decodedCompany;
  const primaryName = isBusinessWithCompany
    ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany))
    : SanitizationUtils.escapeHtml(decodedContact ? SanitizationUtils.capitalizeName(decodedContact) : 'Unknown Client');
  const secondaryName = isBusinessWithCompany && decodedContact
    ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedContact))
    : (decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '-');

  const safeEmail = SanitizationUtils.escapeHtml(client.email || '');
  const safePhone = SanitizationUtils.formatPhone(client.phone || '');
  const status = client.status || 'pending';
  const clientAny = client as { last_login_at?: string; invitation_sent_at?: string; password_hash?: string; invited_at?: string };

  // Check if client needs invitation (pending and never invited)
  // Check multiple fields: invitation_sent_at, password_hash (set after accepting invite), invited_at
  const hasBeenInvited = !!clientAny.invitation_sent_at || !!clientAny.password_hash || !!clientAny.invited_at;
  const showInviteBtn = status !== 'active' && !hasBeenInvited;

  // Prepare billing values
  const safeBillingName = decodedBillingName ? SanitizationUtils.escapeHtml(decodedBillingName) : '-';
  const safeBillingEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_email || client.email || '')) || '';

  // Batch update all client detail fields (except status and emails which need copy button)
  // For business clients: primary = company name, secondary = contact name
  // For personal clients: primary = contact name, secondary = company name (if any)
  batchUpdateText({
    'cd-client-name': primaryName, // Header title - company for business, contact for personal
    'cd-company': secondaryName,   // Secondary info - contact for business, company for personal
    'cd-phone': safePhone,
    'cd-client-type': clientType === 'personal' ? 'Personal' : 'Business',
    'cd-created': formatDate(client.created_at),
    'cd-last-login': clientAny.last_login_at
      ? formatDateTime(clientAny.last_login_at)
      : 'Never',
    // Billing summary (Overview tab)
    'cd-billing-name': safeBillingName,
    // Billing details (Invoices tab)
    'cd-billing-name-full': safeBillingName,
    'cd-billing-address': client.billing_address ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_address)) : '-',
    'cd-billing-city': client.billing_city ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_city)) : '-',
    'cd-billing-state': client.billing_state ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_state)) : '-',
    'cd-billing-zip': client.billing_zip ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_zip)) : '-',
    'cd-billing-country': client.billing_country ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(client.billing_country)) : '-'
  });

  // Email fields with copy button (not set via batchUpdateText)
  const cdEmailEl = document.getElementById('cd-email');
  if (cdEmailEl) cdEmailEl.innerHTML = getEmailWithCopyHtml(client.email || '', safeEmail);
  const cdBillingEmailEl = document.getElementById('cd-billing-email');
  if (cdBillingEmailEl) cdBillingEmailEl.innerHTML = getEmailWithCopyHtml(client.billing_email || client.email || '', safeBillingEmail);
  const cdBillingEmailFullEl = document.getElementById('cd-billing-email-full');
  if (cdBillingEmailFullEl) cdBillingEmailFullEl.innerHTML = getEmailWithCopyHtml(client.billing_email || client.email || '', safeBillingEmail);

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
          <button class="icon-btn icon-btn-invite" id="cd-invite-btn" data-client-id="${client.id}" title="Send invitation email" aria-label="Send invitation email to client">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
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
      const data = await response.json() as { projects?: ProjectResponse[] };
      renderClientProjects(data.projects || [], container);
    } else {
      container.innerHTML = '<p class="empty-state">No projects found for this client.</p>';
    }
  } catch (error) {
    console.error('[AdminClients] Failed to load client projects:', error);
    container.innerHTML = '<p class="empty-state">Failed to load projects.</p>';
  }
}

function renderClientProjects(projects: ProjectResponse[], container: HTMLElement): void {
  if (projects.length === 0) {
    container.innerHTML = '<p class="empty-state">No projects found for this client.</p>';
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
      if (projectId && storedContext) {
        storedContext.switchTab('projects');
        // Delay to allow tab switch, then show project details
        setTimeout(() => {
          import('./admin-projects').then((module) => {
            module.showProjectDetails(projectId, storedContext!);
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
      const data = await response.json() as { invoices?: InvoiceResponse[] };
      const invoices: InvoiceResponse[] = data.invoices || [];

      // Calculate billing totals
      let totalInvoiced = 0;
      let totalPaid = 0;

      invoices.forEach((inv: InvoiceResponse) => {
        const amount = typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0);
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
        container.innerHTML = '<p class="empty-state">No invoices found for this client.</p>';
      }
      const outstandingCountEl = domCache.get('outstandingInvoicesCount');
      if (outstandingCountEl) outstandingCountEl.textContent = '0';
    }
  } catch (error) {
    console.error('[AdminClients] Failed to load client billing:', error);
    if (container) {
      container.innerHTML = '<p class="empty-state">Failed to load billing data.</p>';
    }
    const outstandingCountEl = domCache.get('outstandingInvoicesCount');
    if (outstandingCountEl) outstandingCountEl.textContent = '-';
  }
}

function renderClientInvoices(invoices: InvoiceResponse[], container: HTMLElement): void {
  if (invoices.length === 0) {
    container.innerHTML = '<p class="empty-state">No invoices found for this client.</p>';
    return;
  }

  container.innerHTML = invoices
    .map((invoice) => {
      const invoiceNumber = SanitizationUtils.escapeHtml(invoice.invoice_number || '');
      const amountValue = typeof invoice.amount_total === 'string' ? parseFloat(invoice.amount_total) : (invoice.amount_total || 0);
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
    console.error('[AdminClients] Error resetting password:', error);
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
    console.error('[AdminClients] Error resending invite:', error);
    showToast('Error resending invitation', 'error');
  }
}

/**
 * Send invitation to a client who hasn't been invited yet
 * Called from the inline "Invite" button in the clients table
 */
async function sendClientInvitation(clientId: number): Promise<void> {
  const client = clientsData.find(c => c.id === clientId);
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
      // Update local client data to reflect invitation sent
      const clientIndex = clientsData.findIndex(c => c.id === clientId);
      if (clientIndex !== -1) {
        clientsData[clientIndex].invitation_sent_at = new Date().toISOString();
      }
      // Re-render table to update status
      if (storedContext) {
        renderClientsTable(clientsData, storedContext);
      }
    } else {
      showToast('Failed to send invitation. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Error sending invite:', error);
    showToast('Failed to send invitation. Please try again.', 'error');
  }
}

function editClientInfo(clientId: number, ctx: AdminDashboardContext): void {
  const client = clientsData.find(c => c.id === clientId);
  if (!client) {
    console.error('[AdminClients] Client not found:', clientId);
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
    const newStatus = statusMount?.querySelector('.modal-dropdown')?.getAttribute('data-value') ?? '';

    // Validate email format if provided
    if (newEmail) {
      const emailValidation = validateEmail(newEmail, { allowDisposable: true });
      if (!emailValidation.isValid) {
        showToast(emailValidation.error || 'Invalid email format', 'error');
        return;
      }
    }

    await withButtonLoading(submitBtn, async () => {
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
          // Update local client data with response (no need to reload all clients)
          const clientIndex = clientsData.findIndex(c => c.id === clientId);
          if (clientIndex !== -1) {
            // Preserve computed fields that the API might not return
            const existingClient = clientsData[clientIndex];
            clientsData[clientIndex] = {
              ...existingClient,
              ...result.client,
              // Preserve project_count which is computed
              project_count: existingClient.project_count
            };
          }
          showClientDetails(clientId, ctx);
        } else {
          showToast(result.error || 'Failed to update client info', 'error');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast(errorData.error || 'Failed to update client info', 'error');
      }
    }, 'Saving...');
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

function editClientBilling(clientId: number, ctx: AdminDashboardContext): void {
  const client = clientsData.find(c => c.id === clientId);
  if (!client) {
    console.error('[AdminClients] Client not found:', clientId);
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

    await withButtonLoading(submitBtn, async () => {
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
        await loadClients(ctx);
        showClientDetails(clientId, ctx);
      } else {
        showToast('Failed to update billing details', 'error');
      }
    }, 'Saving...');
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

async function archiveClient(clientId: number, ctx: AdminDashboardContext): Promise<void> {
  const client = clientsData.find(c => c.id === clientId);
  if (!client) {
    console.error('[AdminClients] Client not found:', clientId);
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
      await loadClients(ctx);
      showClientDetails(clientId, ctx);
    } else {
      showToast('Failed to archive client', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Error archiving client:', error);
    showToast('Error archiving client', 'error');
  }
}

async function deleteClient(clientId: number): Promise<void> {
  const client = clientsData.find(c => c.id === clientId);
  if (!client) {
    console.error('[AdminClients] Client not found:', clientId);
    return;
  }

  const deleteClientName = SanitizationUtils.decodeHtmlEntities(client.contact_name || client.email);
  const confirmed = await confirmDanger(
    `Are you sure you want to delete client "${deleteClientName}"? This cannot be undone.`,
    'Delete Client'
  );
  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/clients/${clientId}`);

    if (response.ok) {
      showToast('Client deleted successfully', 'success');
      if (storedContext) loadClients(storedContext);
    } else {
      showToast('Failed to delete client', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Error deleting client:', error);
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

    await withButtonLoading(submitBtn, async () => {
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
        await loadClients(ctx);
      } else {
        showToast('Failed to add client. Please try again.', 'error');
      }
    }, 'Adding...');
  }

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });

  // Add form submit listener (not once - will be removed on success or modal close)
  form.addEventListener('submit', handleSubmit);

  // Setup focus trap after event listeners are attached
  cleanupFocusTrap = manageFocusTrap(modal, {
    initialFocus: '#new-client-email',
    onClose: closeModal
  });
}

/**
 * Render pagination UI for clients table
 */
function renderPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('clients-pagination');
  if (!container) return;

  // Update state
  paginationState.totalItems = totalItems;

  // Create pagination UI
  const paginationUI = createPaginationUI(
    CLIENTS_PAGINATION_CONFIG,
    paginationState,
    (newState) => {
      paginationState = newState;
      savePaginationState(CLIENTS_PAGINATION_CONFIG.storageKey!, paginationState);
      // Re-render table with new pagination
      if (clientsData.length > 0) {
        renderClientsTable(clientsData, ctx);
      }
    }
  );

  // Replace container content
  container.innerHTML = '';
  container.appendChild(paginationUI);
}

/**
 * Bulk archive selected clients
 */
async function bulkArchiveClients(clientIds: number[]): Promise<void> {
  if (!storedContext) return;

  try {
    // Archive each client (set status to inactive)
    const results = await Promise.all(
      clientIds.map(id =>
        apiPut(`/api/clients/${id}`, { status: 'inactive' })
          .then(res => ({ id, success: res.ok }))
          .catch(() => ({ id, success: false }))
      )
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      showToast(
        `Archived ${successCount} client${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        failCount > 0 ? 'warning' : 'success'
      );
      // Reload clients
      await loadClients(storedContext);
    } else {
      showToast('Failed to archive clients', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Bulk archive error:', error);
    showToast('Error archiving clients', 'error');
  }
}

/**
 * Bulk delete selected clients
 */
async function bulkDeleteClients(clientIds: number[]): Promise<void> {
  if (!storedContext) return;

  try {
    // Delete each client
    const results = await Promise.all(
      clientIds.map(id =>
        apiDelete(`/api/clients/${id}`)
          .then(res => ({ id, success: res.ok }))
          .catch(() => ({ id, success: false }))
      )
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      showToast(
        `Deleted ${successCount} client${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        failCount > 0 ? 'warning' : 'success'
      );
      // Reload clients
      await loadClients(storedContext);
    } else {
      showToast('Failed to delete clients', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Bulk delete error:', error);
    showToast('Error deleting clients', 'error');
  }
}
