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
import { formatCurrency } from '../../../utils/format-utils';
import { initModalDropdown, setModalDropdownValue } from '../../../utils/modal-dropdown';

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

  console.log('[AdminClients] Loading clients...');

  try {
    const response = await fetch('/api/clients', {
      credentials: 'include'
    });

    console.log('[AdminClients] Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('[AdminClients] Received data:', {
        clientsCount: data.clients?.length || 0
      });
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
      const tableBody = document.getElementById('clients-table-body');
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-row">Error loading clients: ${response.status}</td></tr>`;
      }
    }
  } catch (error) {
    console.error('[AdminClients] Failed to load clients:', error);
    const tableBody = document.getElementById('clients-table-body');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">Network error loading clients</td></tr>';
    }
  }
}

function updateClientsDisplay(data: ClientsData, ctx: AdminDashboardContext): void {
  // Update stats
  const clientsTotal = document.getElementById('clients-total');
  const clientsActive = document.getElementById('clients-active');
  const clientsPending = document.getElementById('clients-pending');
  const clientsInactive = document.getElementById('clients-inactive');

  if (clientsTotal) clientsTotal.textContent = data.stats.total.toString();
  if (clientsActive) clientsActive.textContent = data.stats.active.toString();
  if (clientsPending) clientsPending.textContent = data.stats.pending.toString();
  if (clientsInactive) clientsInactive.textContent = data.stats.inactive.toString();

  // Update table
  renderClientsTable(data.clients, ctx);

  // Setup refresh button
  const refreshBtn = document.getElementById('refresh-clients-btn');
  if (refreshBtn && !refreshBtn.dataset.listenerAdded) {
    refreshBtn.dataset.listenerAdded = 'true';
    refreshBtn.addEventListener('click', () => loadClients(ctx));
  }

  // Setup add client button
  const addBtn = document.getElementById('add-client-btn');
  if (addBtn && !addBtn.dataset.listenerAdded) {
    addBtn.dataset.listenerAdded = 'true';
    addBtn.addEventListener('click', () => addClient(ctx));
  }
}

function renderClientsTable(clients: Client[], _ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('clients-table-body');
  if (!tableBody) return;

  if (!clients || clients.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No clients found</td></tr>';
    return;
  }

  tableBody.innerHTML = clients
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

  console.log('[AdminClients] Showing details for client:', clientId, client);

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
  const safeName = SanitizationUtils.escapeHtml(
    client.contact_name ? SanitizationUtils.capitalizeName(client.contact_name) : 'Unknown Client'
  );
  const safeEmail = SanitizationUtils.escapeHtml(client.email || '-');
  const safeCompany = client.company_name
    ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(client.company_name))
    : '-';
  const safePhone = SanitizationUtils.formatPhone(client.phone || '');

  // Update header
  const titleEl = document.getElementById('client-detail-title');
  if (titleEl) titleEl.textContent = 'Client Details';

  // Update client name
  const nameEl = document.getElementById('cd-client-name');
  if (nameEl) nameEl.textContent = safeName;

  // Update meta fields
  const emailEl = document.getElementById('cd-email');
  if (emailEl) emailEl.textContent = safeEmail;

  const companyEl = document.getElementById('cd-company');
  if (companyEl) companyEl.textContent = safeCompany;

  const phoneEl = document.getElementById('cd-phone');
  if (phoneEl) phoneEl.textContent = safePhone;

  const statusEl = document.getElementById('cd-status');
  if (statusEl) {
    const status = client.status || 'pending';
    statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Client type - plain text
  const typeEl = document.getElementById('cd-client-type');
  if (typeEl) {
    const clientType = client.client_type || 'business';
    const typeLabel = clientType === 'personal' ? 'Personal' : 'Business';
    typeEl.textContent = typeLabel;
  }

  const createdEl = document.getElementById('cd-created');
  if (createdEl) createdEl.textContent = new Date(client.created_at).toLocaleDateString();

  const lastLoginEl = document.getElementById('cd-last-login');
  if (lastLoginEl) {
    const clientAny = client as any;
    lastLoginEl.textContent = clientAny.last_login_at
      ? new Date(clientAny.last_login_at).toLocaleString()
      : 'Never';
  }

  const projectCountEl = document.getElementById('cd-project-count');
  if (projectCountEl) projectCountEl.textContent = (client.project_count || 0).toString();

  // Billing details
  const billingFields: Record<string, string | null | undefined> = {
    'cd-billing-name': client.billing_name || client.contact_name,
    'cd-billing-email': client.billing_email || client.email,
    'cd-billing-address': client.billing_address,
    'cd-billing-city': client.billing_city,
    'cd-billing-state': client.billing_state,
    'cd-billing-zip': client.billing_zip,
    'cd-billing-country': client.billing_country
  };

  Object.entries(billingFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ? SanitizationUtils.escapeHtml(value) : '-';
  });
}

function setupClientDetailHandlers(client: Client, ctx: AdminDashboardContext): void {
  // Edit client info button (in overview header)
  const editInfoBtn = document.getElementById('cd-btn-edit-info');
  if (editInfoBtn) {
    const newEditInfoBtn = editInfoBtn.cloneNode(true) as HTMLElement;
    editInfoBtn.parentNode?.replaceChild(newEditInfoBtn, editInfoBtn);
    newEditInfoBtn.addEventListener('click', () => editClientInfo(client.id, ctx));
  }

  // Edit billing button
  const editBillingBtn = document.getElementById('cd-btn-edit-billing');
  if (editBillingBtn) {
    const newEditBillingBtn = editBillingBtn.cloneNode(true) as HTMLElement;
    editBillingBtn.parentNode?.replaceChild(newEditBillingBtn, editBillingBtn);
    newEditBillingBtn.addEventListener('click', () => editClientBilling(client.id, ctx));
  }

  // Reset password button
  const resetPwBtn = document.getElementById('cd-btn-reset-password');
  if (resetPwBtn) {
    const newResetBtn = resetPwBtn.cloneNode(true) as HTMLElement;
    resetPwBtn.parentNode?.replaceChild(newResetBtn, resetPwBtn);
    newResetBtn.addEventListener('click', () => resetClientPassword(client.id));
  }

  // Send/Resend invite button
  const resendBtn = document.getElementById('cd-btn-resend-invite');
  if (resendBtn) {
    // Check if invitation was already sent (has password_hash means invited)
    const clientAny = client as any;
    const hasBeenInvited = clientAny.password_hash || clientAny.invited_at;
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
    newResendBtn.addEventListener('click', () => resendClientInvite(client.id));
  }

  // Delete button
  const deleteBtn = document.getElementById('cd-btn-delete');
  if (deleteBtn) {
    const newDeleteBtn = deleteBtn.cloneNode(true) as HTMLElement;
    deleteBtn.parentNode?.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => {
      deleteClient(client.id);
      // Go back to clients list after delete
      ctx.switchTab('clients');
    });
  }
}

async function loadClientProjects(clientId: number): Promise<void> {
  const container = document.getElementById('cd-projects-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/clients/${clientId}/projects`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      renderClientProjects(data.projects || [], container);
    } else {
      container.innerHTML = '<p class="empty-state">No projects found for this client.</p>';
    }
  } catch (error) {
    console.error('[AdminClients] Failed to load client projects:', error);
    container.innerHTML = '<p class="empty-state">Failed to load projects.</p>';
  }
}

function renderClientProjects(projects: any[], container: HTMLElement): void {
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
  const container = document.getElementById('cd-invoices-list');
  const totalInvoicedEl = document.getElementById('cd-total-invoiced');
  const totalPaidEl = document.getElementById('cd-total-paid');
  const outstandingEl = document.getElementById('cd-outstanding');

  try {
    const response = await fetch(`/api/invoices/client/${clientId}`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      const invoices = data.invoices || [];

      // Calculate billing totals
      let totalInvoiced = 0;
      let totalPaid = 0;

      invoices.forEach((inv: any) => {
        totalInvoiced += inv.amount_total || 0;
        if (inv.status === 'paid') {
          totalPaid += inv.amount_total || 0;
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

function renderClientInvoices(invoices: any[], container: HTMLElement): void {
  if (invoices.length === 0) {
    container.innerHTML = '<p class="empty-state">No invoices found for this client.</p>';
    return;
  }

  container.innerHTML = invoices
    .map((invoice) => {
      const invoiceNumber = SanitizationUtils.escapeHtml(invoice.invoice_number || '-');
      const amount = formatCurrency(invoice.amount_total || 0);
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
    const response = await fetch(`/api/clients/${clientId}/reset-password`, {
      method: 'POST',
      credentials: 'include'
    });

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
    const response = await fetch(`/api/clients/${clientId}/resend-invite`, {
      method: 'POST',
      credentials: 'include'
    });

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

  const modal = document.getElementById('edit-client-info-modal');
  const form = document.getElementById('edit-client-info-form') as HTMLFormElement;
  const closeBtn = document.getElementById('edit-client-info-close');
  const cancelBtn = document.getElementById('edit-client-info-cancel');

  if (!modal || !form) return;

  // Populate form with current values
  const emailInput = document.getElementById('edit-client-email') as HTMLInputElement;
  const nameInput = document.getElementById('edit-client-name') as HTMLInputElement;
  const companyInput = document.getElementById('edit-client-company') as HTMLInputElement;
  const phoneInput = document.getElementById('edit-client-phone') as HTMLInputElement;
  const statusSelect = document.getElementById('edit-client-status') as HTMLSelectElement;

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
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: newEmail || null,
          contact_name: newName || null,
          company_name: newCompany || null,
          phone: newPhone || null,
          status: newStatus
        })
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

  const modal = document.getElementById('edit-billing-modal');
  const form = document.getElementById('edit-billing-form') as HTMLFormElement;
  const closeBtn = document.getElementById('edit-billing-close');
  const cancelBtn = document.getElementById('edit-billing-cancel');

  if (!modal || !form) return;

  // Populate form with current values
  const nameInput = document.getElementById('edit-billing-name') as HTMLInputElement;
  const emailInput = document.getElementById('edit-billing-email') as HTMLInputElement;
  const addressInput = document.getElementById('edit-billing-address') as HTMLInputElement;
  const cityInput = document.getElementById('edit-billing-city') as HTMLInputElement;
  const stateInput = document.getElementById('edit-billing-state') as HTMLInputElement;
  const zipInput = document.getElementById('edit-billing-zip') as HTMLInputElement;
  const countryInput = document.getElementById('edit-billing-country') as HTMLInputElement;

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
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billing_name: newBillingName || null,
          billing_email: newBillingEmail || null,
          billing_address: newBillingAddress || null,
          billing_city: newBillingCity || null,
          billing_state: newBillingState || null,
          billing_zip: newBillingZip || null,
          billing_country: newBillingCountry || null
        })
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
    const response = await fetch(`/api/clients/${clientId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

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
  const modal = document.getElementById('add-client-modal');
  const form = document.getElementById('add-client-form') as HTMLFormElement;
  const closeBtn = document.getElementById('add-client-modal-close');
  const cancelBtn = document.getElementById('add-client-cancel');

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

    const emailInput = document.getElementById('new-client-email') as HTMLInputElement;
    const nameInput = document.getElementById('new-client-name') as HTMLInputElement;
    const companyInput = document.getElementById('new-client-company') as HTMLInputElement;
    const phoneInput = document.getElementById('new-client-phone') as HTMLInputElement;

    const email = emailInput?.value.trim();
    const contactName = nameInput?.value.trim();
    const companyName = companyInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!email) {
      ctx.showNotification('Email is required', 'error');
      return;
    }

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          contact_name: contactName || null,
          company_name: companyName || null,
          phone: phone || null,
          status: 'pending'
        })
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
