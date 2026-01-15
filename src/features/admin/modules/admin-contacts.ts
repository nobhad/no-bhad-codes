/**
 * ===============================================
 * ADMIN CONTACTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-contacts.ts
 *
 * Contact submission management for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { apiFetch, apiPut } from '../../../utils/api-client';
import { createTableDropdown, CONTACT_STATUS_OPTIONS } from '../../../utils/table-dropdown';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  CONTACTS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import type { ContactSubmission, AdminDashboardContext } from '../admin-types';

interface ContactsData {
  submissions: ContactSubmission[];
  stats: {
    total: number;
    new: number;
    read: number;
    responded: number;
  };
}

let contactsData: ContactSubmission[] = [];
let storedContext: AdminDashboardContext | null = null;
let filterState: FilterState = loadFilterState(CONTACTS_FILTER_CONFIG.storageKey);
let filterUIInitialized = false;

export function getContactsData(): ContactSubmission[] {
  return contactsData;
}

export async function loadContacts(ctx: AdminDashboardContext): Promise<void> {
  storedContext = ctx;

  // Initialize filter UI once
  if (!filterUIInitialized) {
    initializeFilterUI(ctx);
    filterUIInitialized = true;
  }

  try {
    const response = await apiFetch('/api/admin/contact-submissions');

    if (response.ok) {
      const data: ContactsData = await response.json();
      contactsData = data.submissions || [];
      updateContactsDisplay(data, ctx);
    }
    // 401 errors are handled by apiFetch
  } catch (error) {
    console.error('[AdminContacts] Failed to load contact submissions:', error);
  }
}

/**
 * Initialize filter UI for contacts table
 */
function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = document.getElementById('contacts-filter-container');
  if (!container) return;

  // Create filter UI
  const filterUI = createFilterUI(
    CONTACTS_FILTER_CONFIG,
    filterState,
    (newState) => {
      filterState = newState;
      // Re-render table with new filters
      if (contactsData.length > 0) {
        renderContactsTable(contactsData, ctx);
      }
    }
  );

  // Insert before the new count badge
  const newCountBadge = container.querySelector('#contact-new-count');
  if (newCountBadge) {
    container.insertBefore(filterUI, newCountBadge);
  } else {
    const refreshBtn = container.querySelector('#refresh-contacts-btn');
    if (refreshBtn) {
      container.insertBefore(filterUI, refreshBtn);
    } else {
      container.appendChild(filterUI);
    }
  }

  // Setup sortable headers after table is rendered
  setTimeout(() => {
    createSortableHeaders(CONTACTS_FILTER_CONFIG, filterState, (column, direction) => {
      filterState = { ...filterState, sortColumn: column, sortDirection: direction };
      saveFilterState(CONTACTS_FILTER_CONFIG.storageKey, filterState);
      if (contactsData.length > 0) {
        renderContactsTable(contactsData, ctx);
      }
    });
  }, 100);
}

function updateContactsDisplay(data: ContactsData, ctx: AdminDashboardContext): void {
  // Update overview stat for messages
  const statMessages = document.getElementById('stat-messages');
  if (statMessages) {
    statMessages.textContent = data.stats?.total?.toString() || '0';
  }

  // Update new count badge
  const newCountBadge = document.getElementById('contact-new-count');
  if (newCountBadge) {
    const newCount = data.stats?.new || 0;
    if (newCount > 0) {
      newCountBadge.textContent = `${newCount} new`;
      newCountBadge.classList.add('has-new');
    } else {
      newCountBadge.textContent = '';
      newCountBadge.classList.remove('has-new');
    }
  }

  // Update contacts table
  renderContactsTable(data.submissions, ctx);
}

function renderContactsTable(
  submissions: ContactSubmission[],
  ctx: AdminDashboardContext
): void {
  const tableBody = document.getElementById('contacts-table-body');
  if (!tableBody) return;

  if (!submissions || submissions.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="loading-row">No contact form submissions yet</td></tr>';
    return;
  }

  // Apply filters
  const filteredSubmissions = applyFilters(submissions, filterState, CONTACTS_FILTER_CONFIG);

  if (filteredSubmissions.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No submissions match the current filters</td></tr>';
    return;
  }

  // Clear and rebuild table
  tableBody.innerHTML = '';

  filteredSubmissions.forEach((submission) => {
    const date = new Date(submission.created_at).toLocaleDateString();
    const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(submission.name || '-'));
    const safeEmail = SanitizationUtils.escapeHtml(submission.email || '-');
    const safeCompany = submission.company ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(submission.company)) : '';
    const safeMessage = SanitizationUtils.escapeHtml(submission.message || '-');
    const truncatedMessage =
      safeMessage.length > 50 ? `${safeMessage.substring(0, 50)}...` : safeMessage;
    const safeTitleMessage = SanitizationUtils.escapeHtml(submission.message || '');
    const status = submission.status || 'new';

    const row = document.createElement('tr');
    row.dataset.contactId = String(submission.id);

    row.innerHTML = `
      <td>${date}</td>
      <td>${safeName}</td>
      <td>${safeEmail}</td>
      <td>${safeCompany}</td>
      <td class="message-cell" data-tooltip="${safeTitleMessage}">${truncatedMessage}</td>
      <td class="status-cell"></td>
    `;

    // Create custom dropdown for status
    const statusCell = row.querySelector('.status-cell');
    if (statusCell) {
      const dropdown = createTableDropdown({
        options: CONTACT_STATUS_OPTIONS,
        currentValue: status,
        onChange: async (newStatus) => {
          await updateContactStatus(submission.id, newStatus, ctx);
          submission.status = newStatus as ContactSubmission['status'];
        }
      });
      statusCell.appendChild(dropdown);
    }

    // Add click handler for row (excluding status cell)
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.table-dropdown')) return;
      showContactDetails(submission.id);
    });

    tableBody.appendChild(row);
  });
}

export function showContactDetails(contactId: number): void {
  const contact = contactsData.find((c) => c.id === contactId);
  if (!contact) return;

  const detailsPanel = document.getElementById('contact-details-panel');
  const overlay = document.getElementById('details-overlay');
  if (!detailsPanel) return;

  const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(contact.name || '-'));
  const safeEmail = SanitizationUtils.escapeHtml(contact.email || '-');
  const safeCompany = contact.company ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(contact.company)) : '';
  const safePhone = contact.phone ? SanitizationUtils.formatPhone(contact.phone) : '';
  const safeMessage = SanitizationUtils.escapeHtml(contact.message || '-');
  const date = new Date(contact.created_at).toLocaleString();

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Contact Form Submission</h3>
      <button class="close-btn" onclick="window.closeContactDetailsPanel && window.closeContactDetailsPanel()">×</button>
    </div>
    <div class="details-content">
      <div class="project-detail-meta">
        <div class="meta-item">
          <span class="field-label">Name</span>
          <span class="meta-value">${safeName}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Email</span>
          <span class="meta-value">${safeEmail}</span>
        </div>
        ${safeCompany ? `
        <div class="meta-item">
          <span class="field-label">Company</span>
          <span class="meta-value">${safeCompany}</span>
        </div>
        ` : ''}
        ${safePhone ? `
        <div class="meta-item">
          <span class="field-label">Phone</span>
          <span class="meta-value">${safePhone}</span>
        </div>
        ` : ''}
        <div class="meta-item">
          <span class="field-label">Status</span>
          <span class="meta-value" id="panel-contact-status-container"></span>
        </div>
        <div class="meta-item">
          <span class="field-label">Created</span>
          <span class="meta-value">${date}</span>
        </div>
      </div>
      <div class="project-description-row">
        <div class="meta-item description-item">
          <span class="field-label">Message</span>
          <span class="meta-value">${safeMessage}</span>
        </div>
      </div>
      <div class="details-actions">
        <a href="mailto:${safeEmail}" class="btn">Reply via Email</a>
        ${contact.status !== 'archived' ? `<button class="btn btn-secondary" id="archive-contact-btn" data-id="${contact.id}">Archive</button>` : ''}
      </div>
    </div>
  `;

  // Add custom dropdown for status in panel
  const statusContainer = detailsPanel.querySelector('#panel-contact-status-container');
  if (statusContainer && storedContext) {
    const dropdown = createTableDropdown({
      options: CONTACT_STATUS_OPTIONS,
      currentValue: contact.status || 'new',
      onChange: async (newStatus) => {
        await updateContactStatus(contact.id, newStatus, storedContext!);
        contact.status = newStatus as ContactSubmission['status'];
        // Update table row dropdown if visible
        const tableDropdown = document.querySelector(`tr[data-contact-id="${contact.id}"] .table-dropdown`);
        if (tableDropdown) {
          const textEl = tableDropdown.querySelector('.custom-dropdown-text');
          if (textEl) {
            const option = CONTACT_STATUS_OPTIONS.find(o => o.value === newStatus);
            textEl.textContent = option?.label || newStatus;
          }
          (tableDropdown as HTMLElement).dataset.status = newStatus;
        }
        // Hide archive button if archived
        if (newStatus === 'archived') {
          const archiveBtn = detailsPanel.querySelector('#archive-contact-btn');
          if (archiveBtn) archiveBtn.remove();
        }
      }
    });
    statusContainer.appendChild(dropdown);
  }

  // Add event listener for archive button
  const archiveBtn = detailsPanel.querySelector('#archive-contact-btn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      const id = parseInt((archiveBtn as HTMLElement).dataset.id || '0');
      if (id && storedContext) {
        updateContactStatus(id, 'archived', storedContext);
        contact.status = 'archived';
        // Update panel dropdown
        const panelDropdown = statusContainer?.querySelector('.table-dropdown');
        if (panelDropdown) {
          const textEl = panelDropdown.querySelector('.custom-dropdown-text');
          if (textEl) textEl.textContent = 'Archived';
          (panelDropdown as HTMLElement).dataset.status = 'archived';
        }
        // Update table row dropdown
        const tableDropdown = document.querySelector(`tr[data-contact-id="${id}"] .table-dropdown`);
        if (tableDropdown) {
          const textEl = tableDropdown.querySelector('.custom-dropdown-text');
          if (textEl) textEl.textContent = 'Archived';
          (tableDropdown as HTMLElement).dataset.status = 'archived';
        }
        // Remove archive button
        archiveBtn.remove();
      }
    });
  }

  // Show overlay and panel
  if (overlay) overlay.classList.remove('hidden');
  detailsPanel.classList.remove('hidden');
}

// Global function to close contact details panel
declare global {
  interface Window {
    closeContactDetailsPanel?: () => void;
  }
}

window.closeContactDetailsPanel = function (): void {
  const detailsPanel = document.getElementById('contact-details-panel');
  const overlay = document.getElementById('details-overlay');
  if (detailsPanel) detailsPanel.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
};

export async function updateContactStatus(
  id: number,
  status: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });

    if (response.ok) {
      ctx.showNotification('Status updated', 'success');
      // Update local data
      const contact = contactsData.find((c) => c.id === id);
      if (contact) {
        contact.status = status as ContactSubmission['status'];
      }
    } else if (response.status !== 401) {
      const error = await response.json();
      ctx.showNotification(error.message || 'Failed to update status', 'error');
    }
  } catch (error) {
    console.error('[AdminContacts] Failed to update status:', error);
    ctx.showNotification('Failed to update status', 'error');
  }
}
