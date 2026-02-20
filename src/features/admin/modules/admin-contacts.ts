/**
 * ===============================================
 * ADMIN CONTACTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-contacts.ts
 *
 * Contact submission management for admin dashboard.
 * Dynamically imported for code splitting.
 *
 * REFACTORED: Uses createTableModule factory to eliminate
 * ~200 lines of boilerplate initialization code.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { apiFetch, apiPut, apiPost } from '../../../utils/api-client';
import { createTableDropdown, CONTACT_STATUS_OPTIONS } from '../../../utils/table-dropdown';
import { ICONS } from '../../../constants/icons';
import { APP_CONSTANTS } from '../../../config/constants';
import { CONTACTS_FILTER_CONFIG } from '../../../utils/table-filter';
import { CONTACTS_EXPORT_CONFIG } from '../../../utils/table-export';
import { confirmDialog } from '../../../utils/confirm-dialog';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import type { ContactSubmission, AdminDashboardContext } from '../admin-types';
import { createRowCheckbox, type BulkActionConfig } from '../../../utils/table-bulk-actions';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { showToast } from '../../../utils/toast-notifications';
import { getStatusDotHTML } from '../../../components/status-badge';
import {
  createTableModule,
  createPaginationConfig,
  type TableModuleHelpers
} from '../../../utils/table-module-factory';

// ============================================================================
// TYPES
// ============================================================================

interface ContactsStats {
  total: number;
  new: number;
  read: number;
  responded: number;
}

// ============================================================================
// BULK ACTION FUNCTIONS
// ============================================================================

/**
 * Bulk update status for multiple contacts
 */
async function bulkUpdateStatus(ids: number[], status: string): Promise<void> {
  try {
    const promises = ids.map(id =>
      apiPut(`/api/admin/contact-submissions/${id}/status`, { status })
    );
    await Promise.all(promises);

    // Update local data via module
    ids.forEach(id => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      contactsModule.updateItem(id, { status: status as ContactSubmission['status'] });
    });

    showToast(`Updated ${ids.length} contacts to ${status}`, 'success');
  } catch (error) {
    console.error('[AdminContacts] Bulk status update failed:', error);
    showToast('Failed to update some contacts', 'error');
  }
}

/**
 * Bulk delete contacts
 */
async function bulkDeleteContacts(ids: number[]): Promise<void> {
  try {
    const promises = ids.map(id =>
      apiFetch(`/api/admin/contact-submissions/${id}`, { method: 'DELETE' })
    );
    await Promise.all(promises);

    showToast(`Deleted ${ids.length} contacts`, 'success');

    // Reload data to reflect deletions
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const ctx = contactsModule.getContext();
    if (ctx) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await contactsModule.load(ctx);
    }
  } catch (error) {
    console.error('[AdminContacts] Bulk delete failed:', error);
    showToast('Failed to delete some contacts', 'error');
  }
}

// Bulk action configuration
const CONTACTS_BULK_CONFIG: BulkActionConfig = {
  tableId: 'contacts',
  actions: [
    {
      id: 'mark-read',
      label: 'Read',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      variant: 'default',
      handler: async (ids) => {
        await bulkUpdateStatus(ids, 'read');
      }
    },
    {
      id: 'mark-responded',
      label: 'Responded',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
      variant: 'default',
      handler: async (ids) => {
        await bulkUpdateStatus(ids, 'responded');
      }
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
      variant: 'warning',
      confirmMessage: 'Archive {count} selected contacts?',
      handler: async (ids) => {
        await bulkUpdateStatus(ids, 'archived');
      }
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
      variant: 'danger',
      confirmMessage: 'Permanently delete {count} selected contacts? This cannot be undone.',
      handler: async (ids) => {
        await bulkDeleteContacts(ids);
      }
    }
  ]
};

// ============================================================================
// MODULE CREATION (FACTORY PATTERN)
// ============================================================================

/**
 * Build a table row for a contact submission
 */
function buildContactRow(
  submission: ContactSubmission,
  ctx: AdminDashboardContext,
  helpers: TableModuleHelpers<ContactSubmission>
): HTMLTableRowElement {
  const date = formatDate(submission.created_at);
  const decodedName = SanitizationUtils.decodeHtmlEntities(submission.name || '');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(submission.company || '');
  const decodedMessage = SanitizationUtils.decodeHtmlEntities(submission.message || '');
  const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedName));
  const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.email || ''));
  const safeCompany = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
  const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
  const truncateLen = APP_CONSTANTS.TEXT.TRUNCATE_LENGTH;
  const truncatedMessage =
    safeMessage.length > truncateLen ? `${safeMessage.substring(0, truncateLen)}...` : safeMessage;
  const safeTitleMessage = SanitizationUtils.escapeHtml(decodedMessage);
  const status = submission.status || 'new';

  const row = document.createElement('tr');
  row.dataset.contactId = String(submission.id);

  const canConvert = !submission.client_id;
  const isArchived = status === 'archived';

  row.innerHTML = `
    ${createRowCheckbox('contacts', submission.id)}
    <td class="identity-cell contact-cell" data-label="Contact">
      <span class="identity-name">${safeName}</span>
      ${safeCompany ? `<span class="identity-contact">${safeCompany}</span>` : ''}
      <span class="email-stacked">${safeEmail}</span>
    </td>
    <td class="email-cell" data-label="Email">${safeEmail}</td>
    <td class="message-cell" data-label="Message" title="${safeTitleMessage}">${truncatedMessage}</td>
    <td class="status-cell" data-label="Status"></td>
    <td class="date-cell" data-label="Date">${date}</td>
    <td class="actions-cell" data-label="Actions">
      <div class="table-actions">
        ${canConvert ? `<button class="icon-btn btn-convert-contact" data-id="${submission.id}" data-email="${safeEmail}" data-name="${safeName}" title="Convert to Client" aria-label="Convert to Client">${ICONS.USER_PLUS}</button>` : ''}
        ${!isArchived ? `<button class="icon-btn btn-archive-contact" data-id="${submission.id}" title="Archive" aria-label="Archive">${ICONS.ARCHIVE}</button>` : ''}
        ${isArchived ? `<button class="icon-btn btn-restore-contact" data-id="${submission.id}" title="Restore" aria-label="Restore">${ICONS.ROTATE_CCW}</button>` : ''}
      </div>
    </td>
  `;

  // Create custom dropdown for status
  const statusCell = row.querySelector('.status-cell');
  if (statusCell) {
    const dropdown = createTableDropdown({
      options: CONTACT_STATUS_OPTIONS,
      currentValue: status,
      onChange: async (newStatus) => {
        await updateContactStatus(submission.id, newStatus, ctx);
        helpers.updateItem(submission.id, { status: newStatus as ContactSubmission['status'] });
      }
    });
    statusCell.appendChild(dropdown);
  }

  // Row click handler
  row.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.table-dropdown') || target.closest('.table-actions') || target.closest('button') || target.closest('.bulk-select-cell') || target.tagName === 'INPUT') return;
    showContactDetails(submission.id);
  });

  // Action button handlers
  setupRowActionHandlers(row, submission, ctx, helpers);

  return row;
}

/**
 * Setup action button handlers for a row
 */
function setupRowActionHandlers(
  row: HTMLTableRowElement,
  submission: ContactSubmission,
  ctx: AdminDashboardContext,
  helpers: TableModuleHelpers<ContactSubmission>
): void {
  const convertBtn = row.querySelector('.btn-convert-contact');
  if (convertBtn) {
    convertBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleConvertToClient(submission, row);
    });
  }

  const archiveBtn = row.querySelector('.btn-archive-contact');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await updateContactStatus(submission.id, 'archived', ctx);
      helpers.updateItem(submission.id, { status: 'archived' });
      helpers.rerender();
    });
  }

  const restoreBtn = row.querySelector('.btn-restore-contact');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await updateContactStatus(submission.id, 'new', ctx);
      helpers.updateItem(submission.id, { status: 'new' });
      helpers.rerender();
    });
  }
}

/**
 * Contacts module instance created via factory
 */
const contactsModule = createTableModule<ContactSubmission, ContactsStats>({
  moduleId: 'contacts',
  filterConfig: CONTACTS_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('contacts'),
  columnCount: 7,
  apiEndpoint: '/api/admin/contact-submissions',
  bulkConfig: CONTACTS_BULK_CONFIG,
  exportConfig: CONTACTS_EXPORT_CONFIG,
  emptyMessage: 'No contacts yet.',
  filterEmptyMessage: 'No contacts match the current filters.',
  loadingMessage: 'Loading contacts...',

  extractData: (json) => {
    const data = json as { submissions: ContactSubmission[]; stats: ContactsStats };
    return {
      data: data.submissions || [],
      stats: data.stats
    };
  },

  renderStats: (stats, _ctx) => {
    const statMessages = document.getElementById('stat-messages');
    if (statMessages) {
      statMessages.textContent = stats.total?.toString() || '0';
    }
  },

  renderRow: buildContactRow
});

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

export const loadContacts = contactsModule.load;
export const getContactsData = contactsModule.getData;

// ============================================================================
// DETAIL PANEL (MODULE-SPECIFIC)
// ============================================================================

export function showContactDetails(contactId: number): void {
  const contact = contactsModule.findById(contactId);
  if (!contact) return;

  const detailsPanel = contactsModule.getElement('contact-details-panel');
  const overlay = contactsModule.getElement('details-overlay');
  if (!detailsPanel) return;

  const storedContext = contactsModule.getContext();

  const decodedName = SanitizationUtils.decodeHtmlEntities(contact.name || '');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(contact.company || '');
  const decodedMessage = SanitizationUtils.decodeHtmlEntities(contact.message || '');
  const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedName));
  const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.email || ''));
  const safeCompany = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
  const safePhone = contact.phone ? SanitizationUtils.formatPhone(contact.phone) : '';
  const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
  const date = formatDateTime(contact.created_at);

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Contact Form Submission</h3>
      <button class="close-btn btn-close-contact-panel" aria-label="Close panel">×</button>
    </div>
    <div class="contact-details-created">Created ${date}</div>
    <div class="details-actions">
      ${contact.client_id
    ? getStatusDotHTML('converted')
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
        await updateContactStatus(contact.id, newStatus, storedContext);
        contactsModule.updateItem(contact.id, { status: newStatus as ContactSubmission['status'] });
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

  // Setup panel action button handlers
  setupPanelActionHandlers(detailsPanel, contact, statusContainer);

  // Show overlay and panel
  if (overlay) openModalOverlay(overlay);
  detailsPanel.classList.remove('hidden');
}

/**
 * Setup action button handlers for the detail panel
 */
function setupPanelActionHandlers(
  detailsPanel: HTMLElement,
  contact: ContactSubmission,
  statusContainer: Element | null
): void {
  const storedContext = contactsModule.getContext();

  // Archive button
  const archiveBtn = detailsPanel.querySelector('#archive-contact-btn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      const id = parseInt((archiveBtn as HTMLElement).dataset.id || '0');
      if (id && storedContext) {
        updateContactStatus(id, 'archived', storedContext);
        contactsModule.updateItem(id, { status: 'archived' });
        updateDropdownStatus(statusContainer, contact.id, 'archived', 'Archived');
        archiveBtn.remove();
      }
    });
  }

  // Restore button
  const restoreBtn = detailsPanel.querySelector('#restore-contact-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      const id = parseInt((restoreBtn as HTMLElement).dataset.id || '0');
      if (id && storedContext) {
        updateContactStatus(id, 'new', storedContext);
        contactsModule.updateItem(id, { status: 'new' });
        updateDropdownStatus(statusContainer, contact.id, 'new', 'New');

        // Replace restore button with archive button
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
            contactsModule.updateItem(archiveId, { status: 'archived' });
            updateDropdownStatus(statusContainer, archiveId, 'archived', 'Archived');
            newArchiveBtn.remove();
          }
        });

        showToast('Contact restored', 'success');
      }
    });
  }

  // Convert to client button
  const convertBtn = detailsPanel.querySelector('#convert-to-client-btn');
  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      const id = parseInt((convertBtn as HTMLElement).dataset.id || '0');
      const email = (convertBtn as HTMLElement).dataset.email || '';
      const name = (convertBtn as HTMLElement).dataset.name || '';

      if (!id || !storedContext) return;

      const confirmed = await confirmDialog({
        title: 'Convert to Client',
        message: `Convert "${name}" (${email}) to a client account?\n\nThis will create a client record and send an invitation email to set up their portal account.`,
        confirmText: 'Convert & Invite',
        cancelText: 'Cancel',
        icon: 'folder-plus'
      });

      if (!confirmed) return;

      try {
        const response = await apiPost(`/api/admin/contact-submissions/${id}/convert-to-client`, {
          sendInvitation: true
        });

        if (response.ok) {
          const data = await response.json();
          showToast(
            data.isExisting
              ? 'Contact linked to existing client'
              : 'Client created and invitation sent',
            'success'
          );

          // Update local data
          contactsModule.updateItem(id, {
            client_id: data.clientId,
            converted_at: new Date().toISOString()
          });

          // Replace button with badge
          const actionsDiv = convertBtn.parentElement;
          if (actionsDiv) {
            const badge = document.createElement('span');
            badge.className = 'status-badge status-active';
            badge.textContent = 'Converted to Client';
            convertBtn.replaceWith(badge);
          }

          // Update table row
          const tableRow = document.querySelector(`tr[data-contact-id="${id}"]`);
          if (tableRow) {
            const actionsCell = tableRow.querySelector('.actions-cell');
            if (actionsCell) {
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
}

/**
 * Helper to update dropdown status in both panel and table
 */
function updateDropdownStatus(
  statusContainer: Element | null,
  contactId: number,
  status: string,
  label: string
): void {
  // Update panel dropdown
  const panelDropdown = statusContainer?.querySelector('.table-dropdown');
  if (panelDropdown) {
    const textEl = panelDropdown.querySelector('.custom-dropdown-text');
    if (textEl) textEl.textContent = label;
    (panelDropdown as HTMLElement).dataset.status = status;
  }
  // Update table row dropdown
  const tableDropdown = document.querySelector(`tr[data-contact-id="${contactId}"] .table-dropdown`);
  if (tableDropdown) {
    const textEl = tableDropdown.querySelector('.custom-dropdown-text');
    if (textEl) textEl.textContent = label;
    (tableDropdown as HTMLElement).dataset.status = status;
  }
}

// ============================================================================
// STATUS UPDATE
// ============================================================================

export async function updateContactStatus(
  id: number,
  status: string,
  _ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });

    if (response.ok) {
      showToast('Status updated', 'success');
    } else if (response.status !== 401) {
      showToast('Failed to update status. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminContacts] Failed to update status:', error);
    showToast('Failed to update status. Please try again.', 'error');
  }
}

// ============================================================================
// CONVERT TO CLIENT
// ============================================================================

async function handleConvertToClient(
  contact: ContactSubmission,
  row: HTMLElement
): Promise<void> {
  const decodedName = SanitizationUtils.decodeHtmlEntities(contact.name || '');
  const safeName = SanitizationUtils.capitalizeName(decodedName);

  const confirmed = await confirmDialog({
    title: 'Convert to Client',
    message: `Convert "${safeName}" (${contact.email}) to a client account?\n\nThis will create a client record and send an invitation email.`,
    confirmText: 'Convert & Invite',
    cancelText: 'Cancel',
    icon: 'folder-plus'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/admin/contact-submissions/${contact.id}/convert-to-client`, {
      sendInvitation: true
    });

    if (response.ok) {
      const data = await response.json();
      showToast(
        data.isExisting
          ? 'Contact linked to existing client'
          : 'Client created and invitation sent',
        'success'
      );

      // Update local data
      contactsModule.updateItem(contact.id, {
        client_id: data.clientId,
        converted_at: new Date().toISOString()
      });

      // Remove convert button from row
      const convertBtn = row.querySelector('.btn-convert-contact');
      if (convertBtn) convertBtn.remove();
    } else {
      const errorData = await response.json();
      showToast(errorData.error || 'Failed to convert contact', 'error');
    }
  } catch (error) {
    console.error('Error converting contact to client:', error);
    showToast('Failed to convert contact to client', 'error');
  }
}

// ============================================================================
// GLOBAL PANEL CLOSE
// ============================================================================

declare global {
  interface Window {
    closeContactDetailsPanel?: () => void;
  }
}

// Event delegation for close contact panel button
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('.btn-close-contact-panel')) {
    window.closeContactDetailsPanel?.();
  }
});

window.closeContactDetailsPanel = function (): void {
  const detailsPanel = contactsModule.getElement('contact-details-panel');
  const overlay = contactsModule.getElement('details-overlay');
  if (detailsPanel) detailsPanel.classList.add('hidden');
  if (overlay) closeModalOverlay(overlay);
};

// ============================================================================
// TAB RENDERING
// ============================================================================

const RENDER_ICONS = {
  EXPORT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
};

/**
 * Render the contacts tab HTML structure dynamically.
 * Call this before loadContacts to create the DOM elements.
 */
export function renderContactsTab(container: HTMLElement): void {
  // Reset module cache when tab re-renders
  contactsModule.resetCache();

  container.innerHTML = `
    <div class="admin-table-card" id="contact-submissions-card">
      <div class="admin-table-header">
        <h3><span class="title-full">Contact Form Submissions</span><span class="title-mobile">Contacts</span></h3>
        <div class="admin-table-actions" id="contacts-filter-container">
          <button class="icon-btn" id="export-contacts-btn" title="Export to CSV" aria-label="Export contact submissions to CSV">
            ${RENDER_ICONS.EXPORT}
          </button>
          <button class="icon-btn" id="refresh-contacts-btn" title="Refresh" aria-label="Refresh contact submissions">
            ${RENDER_ICONS.REFRESH}
          </button>
        </div>
      </div>
      <div id="contacts-bulk-toolbar" class="bulk-action-toolbar hidden"></div>
      <div class="admin-table-container contacts-table-container">
        <div class="admin-table-scroll-wrapper">
        <table class="admin-table contacts-table">
          <thead>
            <tr>
              <th scope="col" class="bulk-select-cell">
                <div class="portal-checkbox">
                  <input type="checkbox" id="contacts-select-all" class="bulk-select-all" aria-label="Select all contacts" />
                </div>
              </th>
              <th scope="col" class="contact-col">Contact</th>
              <th scope="col" class="email-col">Email</th>
              <th scope="col">Message</th>
              <th scope="col" class="status-col">Status</th>
              <th scope="col" class="date-col">Date</th>
              <th scope="col" class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="contacts-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
            <tr class="loading-row">
              <td colspan="7">
                <div class="loading-state">
                  <span class="loading-spinner" aria-hidden="true"></span>
                  <span class="loading-message">Loading contact submissions...</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <div id="contacts-pagination" class="table-pagination"></div>
    </div>
  `;
}
