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
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { apiFetch, apiPut, apiPost } from '../../../utils/api-client';
import { createTableDropdown, CONTACT_STATUS_OPTIONS } from '../../../utils/table-dropdown';
import { ICONS } from '../../../constants/icons';
import { APP_CONSTANTS } from '../../../config/constants';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  CONTACTS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import { exportToCsv, CONTACTS_EXPORT_CONFIG } from '../../../utils/table-export';
import { confirmDialog } from '../../../utils/confirm-dialog';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import type { ContactSubmission, AdminDashboardContext } from '../admin-types';
import {
  createPaginationUI,
  applyPagination,
  getDefaultPaginationState,
  loadPaginationState,
  savePaginationState,
  type PaginationState,
  type PaginationConfig
} from '../../../utils/table-pagination';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { showToast } from '../../../utils/toast-notifications';
import { getStatusBadgeHTML } from '../../../components/status-badge';

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

// Pagination configuration and state
const CONTACTS_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'contacts',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_contacts_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(CONTACTS_PAGINATION_CONFIG),
  ...loadPaginationState(CONTACTS_PAGINATION_CONFIG.storageKey!)
};

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

/** Get cached element by ID */
function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

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

  // Show loading state
  const tableBody = getElement('contacts-table-body');
  if (tableBody) showTableLoading(tableBody, 4, 'Loading contacts...');

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
  const container = getElement('contacts-filter-container');
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

  // Insert before export button (Search → Filter → Export → Refresh order)
  const exportBtnRef = container.querySelector('#export-contacts-btn');
  if (exportBtnRef) {
    container.insertBefore(filterUI, exportBtnRef);
  } else {
    container.insertBefore(filterUI, container.firstChild);
  }

  // Setup export button
  const exportBtn = getElement('export-contacts-btn');
  if (exportBtn && !exportBtn.dataset.listenerAdded) {
    exportBtn.dataset.listenerAdded = 'true';
    exportBtn.addEventListener('click', () => {
      const filtered = applyFilters(contactsData, filterState, CONTACTS_FILTER_CONFIG);
      exportToCsv(filtered as unknown as Record<string, unknown>[], CONTACTS_EXPORT_CONFIG);
      showToast(`Exported ${filtered.length} contact submissions to CSV`, 'success');
    });
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
  const statMessages = getElement('stat-messages');
  if (statMessages) {
    statMessages.textContent = data.stats?.total?.toString() || '0';
  }

  // Update contacts table
  renderContactsTable(data.submissions, ctx);
}

function renderContactsTable(
  submissions: ContactSubmission[],
  ctx: AdminDashboardContext
): void {
  const tableBody = getElement('contacts-table-body');
  if (!tableBody) return;

  if (!submissions || submissions.length === 0) {
    showTableEmpty(tableBody, 4, 'No contacts yet.');
    renderContactsPaginationUI(0, ctx);
    return;
  }

  // Apply filters
  const filteredSubmissions = applyFilters(submissions, filterState, CONTACTS_FILTER_CONFIG);

  if (filteredSubmissions.length === 0) {
    showTableEmpty(tableBody, 4, 'No contacts match the current filters.');
    renderContactsPaginationUI(0, ctx);
    return;
  }

  // Update pagination state with total items
  paginationState.totalItems = filteredSubmissions.length;

  // Apply pagination
  const paginatedSubmissions = applyPagination(filteredSubmissions, paginationState);

  // Clear and rebuild table
  tableBody.innerHTML = '';

  paginatedSubmissions.forEach((submission) => {
    const date = formatDate(submission.created_at);
    const decodedName = SanitizationUtils.decodeHtmlEntities(submission.name || '-');
    const decodedCompany = SanitizationUtils.decodeHtmlEntities(submission.company || '');
    const decodedMessage = SanitizationUtils.decodeHtmlEntities(submission.message || '-');
    const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedName));
    const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.email || '-'));
    const safeCompany = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
    const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
    const truncateLen = APP_CONSTANTS.TEXT.TRUNCATE_LENGTH;
    const truncatedMessage =
      safeMessage.length > truncateLen ? `${safeMessage.substring(0, truncateLen)}...` : safeMessage;
    const safeTitleMessage = SanitizationUtils.escapeHtml(decodedMessage);
    const status = submission.status || 'new';

    const row = document.createElement('tr');
    row.dataset.contactId = String(submission.id);

    // Match header structure: Contact | Message | Status | Date
    row.innerHTML = `
      <td class="identity-cell">
        <span class="identity-name">${safeName}</span>
        ${safeCompany ? `<span class="identity-contact">${safeCompany}</span>` : ''}
        <span class="identity-email">${safeEmail}</span>
      </td>
      <td class="message-cell" title="${safeTitleMessage}">${truncatedMessage}</td>
      <td class="status-cell"></td>
      <td>${date}</td>
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

  // Render pagination
  renderContactsPaginationUI(filteredSubmissions.length, ctx);
}

/**
 * Render pagination UI for contacts table
 */
function renderContactsPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('contacts-pagination');
  if (!container) return;

  // Update state
  paginationState.totalItems = totalItems;

  // Create pagination UI
  const paginationUI = createPaginationUI(
    CONTACTS_PAGINATION_CONFIG,
    paginationState,
    (newState) => {
      paginationState = newState;
      savePaginationState(CONTACTS_PAGINATION_CONFIG.storageKey!, paginationState);
      // Re-render table with new pagination
      if (contactsData.length > 0) {
        renderContactsTable(contactsData, ctx);
      }
    }
  );

  // Replace container content
  container.innerHTML = '';
  container.appendChild(paginationUI);
}

export function showContactDetails(contactId: number): void {
  const contact = contactsData.find((c) => c.id === contactId);
  if (!contact) return;

  const detailsPanel = getElement('contact-details-panel');
  const overlay = getElement('details-overlay');
  if (!detailsPanel) return;

  const decodedName = SanitizationUtils.decodeHtmlEntities(contact.name || '-');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(contact.company || '');
  const decodedMessage = SanitizationUtils.decodeHtmlEntities(contact.message || '-');
  const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedName));
  const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.email || '-'));
  const safeCompany = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
  const safePhone = contact.phone ? SanitizationUtils.formatPhone(contact.phone) : '';
  const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
  const date = formatDateTime(contact.created_at);

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Contact Form Submission</h3>
      <button class="close-btn" onclick="window.closeContactDetailsPanel && window.closeContactDetailsPanel()" aria-label="Close panel">×</button>
    </div>
    <div class="contact-details-created">Created ${date}</div>
    <div class="details-actions">
      ${contact.client_id
    ? getStatusBadgeHTML('Converted to Client', 'active')
    : `<button type="button" class="icon-btn" id="convert-to-client-btn" data-id="${contact.id}" data-email="${safeEmail}" data-name="${safeName}" title="Convert to Client" aria-label="Convert to Client">${ICONS.USER_PLUS}</button>`
}
      ${contact.status !== 'archived' ? `<button type="button" class="icon-btn" id="archive-contact-btn" data-id="${contact.id}" title="Archive" aria-label="Archive contact">${ICONS.ARCHIVE}</button>` : ''}
      ${contact.status === 'archived' ? `<button type="button" class="icon-btn" id="restore-contact-btn" data-id="${contact.id}" title="Restore" aria-label="Restore contact">${ICONS.ROTATE_CCW}</button>` : ''}
    </div>
    <div class="details-content">
      <div class="project-detail-meta">
        <div class="meta-item">
          <span class="field-label">Status</span>
          <span class="meta-value" id="panel-contact-status-container"></span>
        </div>
        <div class="meta-item">
          <span class="field-label">Name</span>
          <span class="meta-value">${safeName}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Email</span>
          <span class="meta-value">${getEmailWithCopyHtml(contact.email || '', safeEmail)}</span>
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
      </div>
      <div class="project-description-row">
        <div class="meta-item description-item">
          <span class="field-label">Message</span>
          <span class="meta-value">${safeMessage}</span>
        </div>
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

  // Add event listener for restore button
  const restoreBtn = detailsPanel.querySelector('#restore-contact-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      const id = parseInt((restoreBtn as HTMLElement).dataset.id || '0');
      if (id && storedContext) {
        updateContactStatus(id, 'new', storedContext);
        contact.status = 'new';
        // Update panel dropdown
        const panelDropdown = statusContainer?.querySelector('.table-dropdown');
        if (panelDropdown) {
          const textEl = panelDropdown.querySelector('.custom-dropdown-text');
          if (textEl) textEl.textContent = 'New';
          (panelDropdown as HTMLElement).dataset.status = 'new';
        }
        // Update table row dropdown
        const tableDropdown = document.querySelector(`tr[data-contact-id="${id}"] .table-dropdown`);
        if (tableDropdown) {
          const textEl = tableDropdown.querySelector('.custom-dropdown-text');
          if (textEl) textEl.textContent = 'New';
          (tableDropdown as HTMLElement).dataset.status = 'new';
        }
        // Replace restore button with archive icon button
        const newArchiveBtn = document.createElement('button');
        newArchiveBtn.type = 'button';
        newArchiveBtn.className = 'icon-btn';
        newArchiveBtn.id = 'archive-contact-btn';
        newArchiveBtn.dataset.id = String(id);
        newArchiveBtn.title = 'Archive';
        newArchiveBtn.setAttribute('aria-label', 'Archive contact');
        newArchiveBtn.innerHTML = ICONS.ARCHIVE;
        restoreBtn.replaceWith(newArchiveBtn);
        // Re-attach archive handler
        newArchiveBtn.addEventListener('click', () => {
          const archiveId = parseInt((newArchiveBtn as HTMLElement).dataset.id || '0');
          if (archiveId && storedContext) {
            updateContactStatus(archiveId, 'archived', storedContext);
            contact.status = 'archived';
            const innerPanelDropdown = statusContainer?.querySelector('.table-dropdown');
            if (innerPanelDropdown) {
              const textEl = innerPanelDropdown.querySelector('.custom-dropdown-text');
              if (textEl) textEl.textContent = 'Archived';
              (innerPanelDropdown as HTMLElement).dataset.status = 'archived';
            }
            const innerTableDropdown = document.querySelector(`tr[data-contact-id="${archiveId}"] .table-dropdown`);
            if (innerTableDropdown) {
              const textEl = innerTableDropdown.querySelector('.custom-dropdown-text');
              if (textEl) textEl.textContent = 'Archived';
              (innerTableDropdown as HTMLElement).dataset.status = 'archived';
            }
            newArchiveBtn.remove();
          }
        });
        showToast('Contact restored', 'success');
      }
    });
  }

  // Add event listener for convert to client button
  const convertBtn = detailsPanel.querySelector('#convert-to-client-btn');
  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      const id = parseInt((convertBtn as HTMLElement).dataset.id || '0');
      const email = (convertBtn as HTMLElement).dataset.email || '';
      const name = (convertBtn as HTMLElement).dataset.name || '';

      if (!id || !storedContext) return;

      // Confirm conversion with option to send invitation
      const confirmed = await confirmDialog({
        title: 'Convert to Client',
        message: `Convert "${name}" (${email}) to a client account?\n\nThis will create a client record and send an invitation email to set up their portal account.`,
        confirmText: 'Convert & Invite',
        cancelText: 'Cancel',
        icon: 'folder-plus'
      });

      if (!confirmed) {
        return; // User cancelled
      }

      // Always send invitation when converting
      const sendInvitation = true;

      try {
        const response = await apiPost(`/api/admin/contact-submissions/${id}/convert-to-client`, {
          sendInvitation
        });

        if (response.ok) {
          const data = await response.json();
          showToast(
            data.isExisting
              ? 'Contact linked to existing client'
              : sendInvitation
                ? 'Client created and invitation sent'
                : 'Client created successfully',
            'success'
          );

          // Update local data
          contact.client_id = data.clientId;
          contact.converted_at = new Date().toISOString();

          // Replace button with badge
          const actionsDiv = convertBtn.parentElement;
          if (actionsDiv) {
            const badge = document.createElement('span');
            badge.className = 'status-badge status-active';
            badge.textContent = 'Converted to Client';
            convertBtn.replaceWith(badge);
          }

          // Update table row to show converted status
          const tableRow = document.querySelector(`tr[data-contact-id="${id}"]`);
          if (tableRow) {
            const actionsCell = tableRow.querySelector('.actions-cell');
            if (actionsCell) {
              // Add a small indicator that this contact is converted
              const existingBadge = actionsCell.querySelector('.converted-badge');
              if (!existingBadge) {
                const badge = document.createElement('span');
                badge.className = 'status-badge status-active converted-badge';
                badge.style.fontSize = '0.7rem';
                badge.style.padding = '2px 6px';
                badge.textContent = 'Client';
                actionsCell.prepend(badge);
              }
            }
          }
        } else {
          const errorData = await response.json();
          showToast(errorData.error || 'Failed to convert contact', 'error');
        }
      } catch (error) {
        console.error('Error converting contact to client:', error);
        showToast('Failed to convert contact to client', 'error');
      }
    });
  }

  // Show overlay and panel
  if (overlay) openModalOverlay(overlay);
  detailsPanel.classList.remove('hidden');
}

// Global function to close contact details panel
declare global {
  interface Window {
    closeContactDetailsPanel?: () => void;
  }
}

window.closeContactDetailsPanel = function (): void {
  const detailsPanel = getElement('contact-details-panel');
  const overlay = getElement('details-overlay');
  if (detailsPanel) detailsPanel.classList.add('hidden');
  if (overlay) closeModalOverlay(overlay);
};

export async function updateContactStatus(
  id: number,
  status: string,
  _ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });

    if (response.ok) {
      showToast('Status updated', 'success');
      // Update local data
      const contact = contactsData.find((c) => c.id === id);
      if (contact) {
        contact.status = status as ContactSubmission['status'];
      }
    } else if (response.status !== 401) {
      showToast('Failed to update status. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminContacts] Failed to update status:', error);
    showToast('Failed to update status. Please try again.', 'error');
  }
}
