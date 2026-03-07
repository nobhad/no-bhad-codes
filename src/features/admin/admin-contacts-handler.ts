/**
 * ===============================================
 * ADMIN CONTACTS HANDLER
 * ===============================================
 * @file src/features/admin/admin-contacts-handler.ts
 *
 * Handles contact form submission loading, display,
 * status updates, and detail modal rendering.
 */

import type { ContactSubmission, ContactStats } from './admin-types';
import { APP_CONSTANTS } from '../../config/constants';
import { apiFetch, apiPut, unwrapApiData } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { formatDate, formatDateTime } from '../../utils/format-utils';
import { SanitizationUtils } from '../../utils/sanitization-utils';
import { manageFocusTrap } from '../../utils/focus-trap';
import { getCopyEmailButtonHtml, getEmailWithCopyHtml } from '../../utils/copy-email';
import { getStatusDotHTML } from '../../components/status-badge';
import { createTableDropdown } from '../../utils/table-dropdown';
import { showTableEmpty } from '../../utils/loading-utils';
import type { createDOMCache } from '../../utils/dom-cache';

const logger = createLogger('AdminContacts');

type DOMCacheInstance = ReturnType<typeof createDOMCache>;

/** Dashboard contact status options */
const DASHBOARD_CONTACT_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'archived', label: 'Archived' }
];

/**
 * Load contact submissions from the API.
 */
export async function loadContactSubmissions(
  domCache: DOMCacheInstance,
  contactsData: ContactSubmission[],
  onShowDetails: (contactId: number) => void
): Promise<ContactSubmission[]> {
  try {
    const response = await apiFetch('/api/admin/contact-submissions');

    if (response.ok) {
      const raw = await response.json();
      const data = unwrapApiData<{ submissions: ContactSubmission[]; stats: ContactStats }>(raw);
      return updateContactsDisplay(data, domCache, contactsData, onShowDetails);
    }
  } catch (error) {
    logger.error(' Failed to load contact submissions:', error);
  }
  return contactsData;
}

/**
 * Update the contacts table display with loaded data.
 */
function updateContactsDisplay(
  data: { submissions: ContactSubmission[]; stats: ContactStats },
  domCache: DOMCacheInstance,
  _contactsData: ContactSubmission[],
  onShowDetails: (contactId: number) => void
): ContactSubmission[] {
  const contacts = data.submissions || [];

  // Update new count badge
  const newCountBadge = domCache.get('contactNewCount');
  if (newCountBadge) {
    const newCount = data.stats?.new || 0;
    if (newCount > 0) {
      newCountBadge.textContent = `${newCount} new`;
      newCountBadge.classList.add('has-new');
    } else {
      newCountBadge.classList.remove('has-new');
    }
  }

  // Update contacts table
  const tableBody = domCache.get('contactsTableBody');
  if (tableBody && data.submissions) {
    if (data.submissions.length === 0) {
      showTableEmpty(tableBody, 6, 'No contact form submissions yet');
    } else {
      tableBody.innerHTML = data.submissions
        .map((submission: ContactSubmission) => {
          const date = formatDate(submission.created_at);
          const decodedName = SanitizationUtils.decodeHtmlEntities(submission.name || '');
          const decodedMessage = SanitizationUtils.decodeHtmlEntities(submission.message || '');
          const safeName = SanitizationUtils.escapeHtml(decodedName);
          const safeEmail = SanitizationUtils.escapeHtml(
            SanitizationUtils.decodeHtmlEntities(submission.email || '')
          );
          const safeSubject = SanitizationUtils.escapeHtml(
            SanitizationUtils.decodeHtmlEntities(submission.subject || '')
          );
          const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
          const truncateLen = APP_CONSTANTS.TEXT.TRUNCATE_LENGTH;
          const truncatedMessage =
            safeMessage.length > truncateLen
              ? `${safeMessage.substring(0, truncateLen)}...`
              : safeMessage;
          const safeTitleMessage = SanitizationUtils.escapeHtml(decodedMessage);
          return `
            <tr data-contact-id="${submission.id}">
              <td class="date-cell" data-label="Date">${date}</td>
              <td class="name-cell" data-label="Name">${safeName}</td>
              <td class="email-cell meta-value-with-copy" data-label="Email">${safeEmail} ${getCopyEmailButtonHtml(submission.email || '')}</td>
              <td class="name-cell" data-label="Subject">${safeSubject}</td>
              <td class="message-cell" data-label="Message" title="${safeTitleMessage}">${truncatedMessage}</td>
              <td class="status-cell" data-label="Status">
                <div class="contact-status-dropdown-container" data-contact-id="${submission.id}"></div>
              </td>
            </tr>
          `;
        })
        .join('');

      // Add click handlers to rows
      const rows = tableBody.querySelectorAll('tr[data-contact-id]');
      rows.forEach((row) => {
        row.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.table-dropdown')) return;
          const contactId = parseInt((row as HTMLElement).dataset.contactId || '0');
          onShowDetails(contactId);
        });
      });

      // Attach status dropdowns
      const dropdownContainers = tableBody.querySelectorAll('.contact-status-dropdown-container');
      dropdownContainers.forEach((container) => {
        const contactId = (container as HTMLElement).dataset.contactId;
        const submission = data.submissions.find(
          (s: ContactSubmission) => String(s.id) === contactId
        );
        if (!submission || !contactId) return;
        const dropdown = createTableDropdown({
          options: DASHBOARD_CONTACT_STATUS_OPTIONS,
          currentValue: submission.status || 'new',
          showStatusDot: true,
          onChange: (value: string) => {
            updateContactStatus(parseInt(contactId, 10), value, domCache, () =>
              loadContactSubmissions(domCache, contacts, onShowDetails)
            );
          }
        });
        container.appendChild(dropdown);
      });
    }
  }

  return contacts;
}

/**
 * Update a contact submission's status.
 */
export async function updateContactStatus(
  id: number,
  status: string,
  domCache: DOMCacheInstance,
  refreshFn: () => void
): Promise<void> {
  try {
    const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });

    if (response.ok) {
      logger.log('Contact status updated');
      refreshFn();
    } else {
      logger.error(' Failed to update contact status');
    }
  } catch (error) {
    logger.error(' Error updating contact status:', error);
  }
}

/**
 * Show a contact submission in the detail modal.
 */
export function showContactDetails(
  contactId: number,
  contactsData: ContactSubmission[],
  domCache: DOMCacheInstance,
  focusTrapCleanup: { current: (() => void) | null },
  refreshFn: () => void
): void {
  const contact = contactsData.find((c) => c.id === contactId);
  if (!contact) return;

  const modal = domCache.get('detailModal');
  const modalTitle = domCache.get('modalTitle');
  const modalBody = domCache.get('modalBody');

  if (!modal || !modalTitle || !modalBody) return;

  modalTitle.textContent = 'Contact Form Submission';

  const date = formatDateTime(contact.created_at);

  const safeName = SanitizationUtils.escapeHtml(
    SanitizationUtils.decodeHtmlEntities(contact.name || '')
  );
  const safeEmail = SanitizationUtils.escapeHtml(
    SanitizationUtils.decodeHtmlEntities(contact.email || '')
  );
  const safeSubject = SanitizationUtils.escapeHtml(
    SanitizationUtils.decodeHtmlEntities(contact.subject || '')
  );
  const safeMessage = SanitizationUtils.escapeHtml(
    SanitizationUtils.decodeHtmlEntities(contact.message || '')
  );

  modalBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Name</span>
        <span class="detail-value">${safeName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${getEmailWithCopyHtml(contact.email || '', safeEmail)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Subject</span>
        <span class="detail-value">${safeSubject}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">${getStatusDotHTML(contact.status || 'new')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Message</span>
        <span class="detail-value message-full">${safeMessage}</span>
      </div>
      ${
  contact.read_at
    ? `
      <div class="detail-row">
        <span class="detail-label">Read At</span>
        <span class="detail-value">${formatDateTime(contact.read_at)}</span>
      </div>
      `
    : ''
}
      ${
  contact.replied_at
    ? `
      <div class="detail-row">
        <span class="detail-label">Replied At</span>
        <span class="detail-value">${formatDateTime(contact.replied_at)}</span>
      </div>
      `
    : ''
}
    </div>
  `;

  modal.style.display = 'flex';

  // Set up focus trap for accessibility
  const closeModal = () => {
    modal.style.display = 'none';
    if (focusTrapCleanup.current) {
      focusTrapCleanup.current();
      focusTrapCleanup.current = null;
    }
  };
  focusTrapCleanup.current = manageFocusTrap(modal, {
    initialFocus: '#modal-close-btn',
    onClose: closeModal
  });

  // Mark as read if status is 'new'
  if (contact.status === 'new') {
    updateContactStatus(contactId, 'read', domCache, refreshFn);
  }
}
