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
  ClientResponse,
  ProjectResponse,
  InvoiceResponse
} from '../../../types/api';
import { formatCurrency } from '../../../utils/format-utils';
import { initModalDropdown, setModalDropdownValue } from '../../../utils/modal-dropdown';
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
import { showTableLoading } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { createDOMCache, batchUpdateText, getElement } from '../../../utils/dom-cache';

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
  // Client detail buttons
  editInfoBtn: string;
  editBillingBtn: string;
  resetPwBtn: string;
  resendBtn: string;
  deleteBtn: string;
  // Client detail containers
  projectsList: string;
  invoicesList: string;
  totalInvoiced: string;
  totalPaid: string;
  outstanding: string;
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
  // Client detail buttons
  editInfoBtn: '#cd-btn-edit-info',
  editBillingBtn: '#cd-btn-edit-billing',
  resetPwBtn: '#cd-btn-reset-password',
  resendBtn: '#cd-btn-resend-invite',
  deleteBtn: '#cd-btn-delete',
  // Client detail containers
  projectsList: '#cd-projects-list',
  invoicesList: '#cd-invoices-list',
  totalInvoiced: '#cd-total-invoiced',
  totalPaid: '#cd-total-paid',
  outstanding: '#cd-outstanding',
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
  // Billing fields
  billing_name?: string | null;
  billing_email?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  billing_country?: string | null;
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

export function getCurrentClientId(): number | null {
  return currentClientId;
}

export function setCurrentClientId(id: number | null): void {
  currentClientId = id;
}

export function getClientsData(): Client[] {
  return clientsData;
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
    showTableLoading(tableBody, 6, 'Loading clients...');
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
      // Re-render table with new filters
      if (clientsData.length > 0) {
        renderClientsTable(clientsData, ctx);
      }
    }
  );

  // Insert before the refresh button (use cached ref)
  const refreshBtn = domCache.get('refreshBtn');
  if (refreshBtn) {
    container.insertBefore(filterUI, refreshBtn);
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

function renderClientsTable(clients: Client[], _ctx: AdminDashboardContext): void {
  const tableBody = domCache.get('tableBody');
  if (!tableBody) return;

  if (!clients || clients.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No clients found</td></tr>';
    return;
  }

  // Apply filters
  const filteredClients = applyFilters(clients, filterState, CLIENTS_FILTER_CONFIG);

  if (filteredClients.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No clients match the current filters</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredClients
    .map((client) => {
      const date = new Date(client.created_at).toLocaleDateString();

      const safeName = SanitizationUtils.escapeHtml(
        client.contact_name ? SanitizationUtils.capitalizeName(client.contact_name) : '-'
      );
      const safeEmail = SanitizationUtils.escapeHtml(client.email || '-');
      const safeCompany = client.company_name
        ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(client.company_name))
        : '';
      const status = client.status || 'pending';
      const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
      const projectCount = client.project_count || 0;

      // Client type - plain text
      const clientType = client.client_type || 'business';
      const typeLabel = clientType === 'personal' ? 'Personal' : 'Business';

      return `
        <tr data-client-id="${client.id}" class="clickable-row">
          <td>${safeName}${safeCompany ? `<br><small>${safeCompany}</small>` : ''}</td>
          <td>${typeLabel}</td>
          <td>${safeEmail}</td>
          <td>${displayStatus}</td>
          <td>${projectCount}</td>
          <td>${date}</td>
        </tr>
      `;
    })
    .join('');

  // Row click to view details
  tableBody.querySelectorAll('tr[data-client-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const clientId = parseInt((row as HTMLElement).dataset.clientId || '0');
      if (clientId) showClientDetails(clientId);
    });
  });
}

export function showClientDetails(clientId: number, ctx?: AdminDashboardContext): void {
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
}

function populateClientDetailView(client: Client): void {
  // Prepare sanitized values
  const safeName = SanitizationUtils.escapeHtml(
    client.contact_name ? SanitizationUtils.capitalizeName(client.contact_name) : 'Unknown Client'
  );
  const safeEmail = SanitizationUtils.escapeHtml(client.email || '-');
  const safeCompany = client.company_name
    ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(client.company_name))
    : '-';
  const safePhone = SanitizationUtils.formatPhone(client.phone || '');
  const status = client.status || 'pending';
  const clientType = client.client_type || 'business';
  const clientAny = client as { last_login_at?: string };

  // Batch update all client detail fields
  batchUpdateText({
    'client-detail-title': 'Client Details',
    'cd-client-name': safeName,
    'cd-email': safeEmail,
    'cd-company': safeCompany,
    'cd-phone': safePhone,
    'cd-status': status.charAt(0).toUpperCase() + status.slice(1),
    'cd-client-type': clientType === 'personal' ? 'Personal' : 'Business',
    'cd-created': new Date(client.created_at).toLocaleDateString(),
    'cd-last-login': clientAny.last_login_at
      ? new Date(clientAny.last_login_at).toLocaleString()
      : 'Never',
    'cd-project-count': (client.project_count || 0).toString(),
    // Billing details
    'cd-billing-name': SanitizationUtils.escapeHtml(client.billing_name || client.contact_name || '') || '-',
    'cd-billing-email': SanitizationUtils.escapeHtml(client.billing_email || client.email || '') || '-',
    'cd-billing-address': client.billing_address ? SanitizationUtils.escapeHtml(client.billing_address) : '-',
    'cd-billing-city': client.billing_city ? SanitizationUtils.escapeHtml(client.billing_city) : '-',
    'cd-billing-state': client.billing_state ? SanitizationUtils.escapeHtml(client.billing_state) : '-',
    'cd-billing-zip': client.billing_zip ? SanitizationUtils.escapeHtml(client.billing_zip) : '-',
    'cd-billing-country': client.billing_country ? SanitizationUtils.escapeHtml(client.billing_country) : '-'
  });
}

function setupClientDetailHandlers(client: Client, ctx: AdminDashboardContext): void {
  // Force refresh cached refs since we're using cloneNode which changes DOM elements
  // Edit client info button (in overview header)
  const editInfoBtn = domCache.get('editInfoBtn', true);
  if (editInfoBtn) {
    const newEditInfoBtn = editInfoBtn.cloneNode(true) as HTMLElement;
    editInfoBtn.parentNode?.replaceChild(newEditInfoBtn, editInfoBtn);
    domCache.invalidate('editInfoBtn'); // Invalidate since element was replaced
    newEditInfoBtn.addEventListener('click', () => editClientInfo(client.id, ctx));
  }

  // Edit billing button
  const editBillingBtn = domCache.get('editBillingBtn', true);
  if (editBillingBtn) {
    const newEditBillingBtn = editBillingBtn.cloneNode(true) as HTMLElement;
    editBillingBtn.parentNode?.replaceChild(newEditBillingBtn, editBillingBtn);
    domCache.invalidate('editBillingBtn');
    newEditBillingBtn.addEventListener('click', () => editClientBilling(client.id, ctx));
  }

  // Reset password button
  const resetPwBtn = domCache.get('resetPwBtn', true);
  if (resetPwBtn) {
    const newResetBtn = resetPwBtn.cloneNode(true) as HTMLElement;
    resetPwBtn.parentNode?.replaceChild(newResetBtn, resetPwBtn);
    domCache.invalidate('resetPwBtn');
    newResetBtn.addEventListener('click', () => resetClientPassword(client.id));
  }

  // Send/Resend invite button
  const resendBtn = domCache.get('resendBtn', true);
  if (resendBtn) {
    // Check if invitation was already sent (has password_hash means invited)
    const hasBeenInvited = (client as ClientResponse & { password_hash?: string; invited_at?: string }).password_hash ||
                           (client as ClientResponse & { password_hash?: string; invited_at?: string }).invited_at;
    const buttonText = hasBeenInvited ? 'Resend Invitation' : 'Send Invitation';

    // Update the button's innerHTML to replace text while keeping SVG
    const svg = resendBtn.querySelector('svg');
    if (svg) {
      resendBtn.innerHTML = '';
      resendBtn.appendChild(svg.cloneNode(true));
      resendBtn.appendChild(document.createTextNode(` ${  buttonText}`));
    }

    // Clone to reset event listeners
    const newResendBtn = resendBtn.cloneNode(true) as HTMLElement;
    resendBtn.parentNode?.replaceChild(newResendBtn, resendBtn);
    domCache.invalidate('resendBtn');
    newResendBtn.addEventListener('click', () => resendClientInvite(client.id));
  }

  // Delete button
  const deleteBtn = domCache.get('deleteBtn', true);
  if (deleteBtn) {
    const newDeleteBtn = deleteBtn.cloneNode(true) as HTMLElement;
    deleteBtn.parentNode?.replaceChild(newDeleteBtn, deleteBtn);
    domCache.invalidate('deleteBtn');
    newDeleteBtn.addEventListener('click', () => {
      deleteClient(client.id);
      // Go back to clients list after delete
      ctx.switchTab('clients');
    });
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
      const date = new Date(project.created_at).toLocaleDateString();

      return `
        <div class="client-project-item" data-project-id="${project.id}">
          <div class="project-info">
            <span class="project-name">${safeName}</span>
            <span class="project-status">${status}</span>
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

      // Update summary
      if (totalInvoicedEl) totalInvoicedEl.textContent = formatCurrency(totalInvoiced);
      if (totalPaidEl) totalPaidEl.textContent = formatCurrency(totalPaid);
      if (outstandingEl) outstandingEl.textContent = formatCurrency(outstanding);

      // Render invoices list
      if (container) {
        renderClientInvoices(invoices, container);
      }
    } else {
      if (container) {
        container.innerHTML = '<p class="empty-state">No invoices found for this client.</p>';
      }
    }
  } catch (error) {
    console.error('[AdminClients] Failed to load client billing:', error);
    if (container) {
      container.innerHTML = '<p class="empty-state">Failed to load billing data.</p>';
    }
  }
}

function renderClientInvoices(invoices: InvoiceResponse[], container: HTMLElement): void {
  if (invoices.length === 0) {
    container.innerHTML = '<p class="empty-state">No invoices found for this client.</p>';
    return;
  }

  container.innerHTML = invoices
    .map((invoice) => {
      const invoiceNumber = SanitizationUtils.escapeHtml(invoice.invoice_number || '-');
      const amountValue = typeof invoice.amount_total === 'string' ? parseFloat(invoice.amount_total) : (invoice.amount_total || 0);
      const amount = formatCurrency(amountValue);
      const date = new Date(invoice.created_at || invoice.due_date).toLocaleDateString();
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
  if (!confirm('Send a password reset email to this client?')) return;

  try {
    const response = await apiPost(`/api/clients/${clientId}/reset-password`);

    if (response.ok) {
      storedContext?.showNotification('Password reset email sent', 'success');
    } else {
      storedContext?.showNotification('Failed to send password reset', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Error resetting password:', error);
    storedContext?.showNotification('Error sending password reset', 'error');
  }
}

async function resendClientInvite(clientId: number): Promise<void> {
  if (!confirm('Resend the portal invitation to this client?')) return;

  try {
    const response = await apiPost(`/api/clients/${clientId}/resend-invite`);

    if (response.ok) {
      storedContext?.showNotification('Invitation resent successfully', 'success');
    } else {
      storedContext?.showNotification('Failed to resend invitation', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Error resending invite:', error);
    storedContext?.showNotification('Error resending invitation', 'error');
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
  const statusSelect = getElement('edit-client-status') as HTMLSelectElement;

  if (emailInput) emailInput.value = client.email || '';
  if (nameInput) nameInput.value = client.contact_name || '';
  if (companyInput) companyInput.value = client.company_name || '';
  if (phoneInput) phoneInput.value = client.phone || '';

  // Initialize custom dropdown for status select (only once)
  if (statusSelect && !statusSelect.dataset.dropdownInit) {
    statusSelect.value = client.status || 'pending';
    initModalDropdown(statusSelect, { placeholder: 'Select status...' });
  } else if (statusSelect) {
    // Update existing dropdown value
    const statusWrapper = statusSelect.previousElementSibling as HTMLElement;
    if (statusWrapper?.classList.contains('modal-dropdown')) {
      setModalDropdownValue(statusWrapper, client.status || 'pending');
    }
  }

  // Show modal and lock body scroll
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  // Close handlers
  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

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

    const newEmail = emailInput?.value.trim();
    const newName = nameInput?.value.trim();
    const newCompany = companyInput?.value.trim();
    const newPhone = phoneInput?.value.trim();
    const newStatus = statusSelect?.value;

    try {
      const response = await apiPut(`/api/clients/${clientId}`, {
        email: newEmail || null,
        contact_name: newName || null,
        company_name: newCompany || null,
        phone: newPhone || null,
        status: newStatus
      });

      if (response.ok) {
        ctx.showNotification('Client info updated successfully', 'success');
        closeModal();
        await loadClients(ctx);
        showClientDetails(clientId, ctx);
      } else {
        ctx.showNotification('Failed to update client info', 'error');
      }
    } catch (error) {
      console.error('[AdminClients] Error updating client info:', error);
      ctx.showNotification('Error updating client info', 'error');
    }
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
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  // Close handlers
  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

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

    const newBillingName = nameInput?.value.trim();
    const newBillingEmail = emailInput?.value.trim();
    const newBillingAddress = addressInput?.value.trim();
    const newBillingCity = cityInput?.value.trim();
    const newBillingState = stateInput?.value.trim();
    const newBillingZip = zipInput?.value.trim();
    const newBillingCountry = countryInput?.value.trim();

    try {
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
        ctx.showNotification('Billing details updated successfully', 'success');
        closeModal();
        await loadClients(ctx);
        showClientDetails(clientId, ctx);
      } else {
        ctx.showNotification('Failed to update billing details', 'error');
      }
    } catch (error) {
      console.error('[AdminClients] Error updating billing details:', error);
      ctx.showNotification('Error updating billing details', 'error');
    }
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

async function deleteClient(clientId: number): Promise<void> {
  const client = clientsData.find(c => c.id === clientId);
  if (!client) {
    console.error('[AdminClients] Client not found:', clientId);
    return;
  }

  if (!confirm(`Are you sure you want to delete client "${client.contact_name || client.email}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await apiDelete(`/api/clients/${clientId}`);

    if (response.ok) {
      storedContext?.showNotification('Client deleted successfully', 'success');
      if (storedContext) loadClients(storedContext);
    } else {
      storedContext?.showNotification('Failed to delete client', 'error');
    }
  } catch (error) {
    console.error('[AdminClients] Error deleting client:', error);
    storedContext?.showNotification('Error deleting client', 'error');
  }
}

function addClient(ctx: AdminDashboardContext): void {
  const modal = domCache.get('addClientModal');
  const form = domCache.getAs<HTMLFormElement>('addClientForm');
  const closeBtn = domCache.get('addClientClose');
  const cancelBtn = domCache.get('addClientCancel');

  if (!modal || !form) return;

  // Reset form
  form.reset();

  // Show modal and lock body scroll
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  // Close handlers
  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    form.reset();
  };

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });

  // Form submit handler
  const handleSubmit = async (e: Event) => {
    e.preventDefault();

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
      ctx.showNotification('Email is required', 'error');
      return;
    }

    try {
      const response = await apiPost('/api/clients', {
        email,
        contact_name: contactName || null,
        company_name: companyName || null,
        phone: phone || null,
        status: 'pending'
      });

      if (response.ok) {
        ctx.showNotification('Client added successfully', 'success');
        closeModal();
        await loadClients(ctx);
      } else {
        const error = await response.json();
        ctx.showNotification(error.message || 'Failed to add client', 'error');
      }
    } catch (error) {
      console.error('[AdminClients] Error adding client:', error);
      ctx.showNotification('Error adding client', 'error');
    }
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}
