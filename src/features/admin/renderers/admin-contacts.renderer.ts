/**
 * ===============================================
 * ADMIN CONTACTS RENDERER
 * ===============================================
 * @file src/features/admin/renderers/admin-contacts.renderer.ts
 *
 * Renders contact form submissions in the admin dashboard.
 * Handles table display and detail modals.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { createLogger } from '../../../utils/logging';
import { adminDataService, type Contact, type ContactStats } from '../services/admin-data.service';
import { APP_CONSTANTS } from '../../../config/constants';

const logger = createLogger('AdminContactsRenderer');

// ============================================
// Types
// ============================================

interface ContactDisplayData {
  submissions: Contact[];
  stats: ContactStats;
}

type StatusUpdateCallback = (id: number, status: string) => Promise<void>;

// ============================================
// Admin Contacts Renderer
// ============================================

class AdminContactsRenderer {
  private onStatusUpdate: StatusUpdateCallback | null = null;

  /**
   * Set the callback for status updates
   */
  setStatusUpdateCallback(callback: StatusUpdateCallback): void {
    this.onStatusUpdate = callback;
  }

  /**
   * Render the contacts table
   */
  renderContactsTable(data: ContactDisplayData): void {
    this.updateNewCountBadge(data.stats);
    this.renderTable(data.submissions);
  }

  /**
   * Update the new contacts count badge
   */
  private updateNewCountBadge(stats: ContactStats): void {
    const newCountBadge = document.getElementById('contact-new-count');
    if (newCountBadge) {
      const newCount = stats?.new || 0;
      if (newCount > 0) {
        newCountBadge.textContent = `${newCount} new`;
        newCountBadge.classList.add('has-new');
      } else {
        newCountBadge.classList.remove('has-new');
      }
    }
  }

  /**
   * Render the contacts table body
   */
  private renderTable(submissions: Contact[]): void {
    const tableBody = document.getElementById('contacts-table-body');
    if (!tableBody) return;

    if (submissions.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="loading-row">No contact form submissions yet</td></tr>';
      return;
    }

    tableBody.innerHTML = submissions
      .map((submission) => this.renderContactRow(submission))
      .join('');

    this.attachRowClickHandlers(tableBody);
    this.attachStatusSelectHandlers(tableBody);
  }

  /**
   * Render a single contact row
   */
  private renderContactRow(submission: Contact): string {
    const date = formatDate(submission.created_at);
    const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.name || '-'));
    const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.email || '-'));
    const safeSubject = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.subject || '-'));
    const safeMessage = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.message || '-'));
    const truncateLen = APP_CONSTANTS.TEXT.TRUNCATE_LENGTH;
    const truncatedMessage =
      safeMessage.length > truncateLen ? `${safeMessage.substring(0, truncateLen)}...` : safeMessage;
    const safeTitleMessage = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(submission.message || ''));

    return `
      <tr data-contact-id="${submission.id}">
        <td>${date}</td>
        <td>${safeName}</td>
        <td>${safeEmail}</td>
        <td>${safeSubject}</td>
        <td class="message-cell" title="${safeTitleMessage}">${truncatedMessage}</td>
        <td>
          <select class="contact-status-select status-select" data-id="${submission.id}" onclick="event.stopPropagation()">
            <option value="new" ${submission.status === 'new' ? 'selected' : ''}>New</option>
            <option value="read" ${submission.status === 'read' ? 'selected' : ''}>Read</option>
            <option value="replied" ${submission.status === 'replied' ? 'selected' : ''}>Replied</option>
            <option value="archived" ${submission.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </td>
      </tr>
    `;
  }

  /**
   * Attach click handlers to contact rows
   */
  private attachRowClickHandlers(tableBody: HTMLElement): void {
    const rows = tableBody.querySelectorAll('tr[data-contact-id]');
    rows.forEach((row) => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'SELECT') return;
        const contactId = parseInt((row as HTMLElement).dataset.contactId || '0');
        this.showContactDetails(contactId);
      });
    });
  }

  /**
   * Attach change handlers to status selects
   */
  private attachStatusSelectHandlers(tableBody: HTMLElement): void {
    const statusSelects = tableBody.querySelectorAll('.contact-status-select');
    statusSelects.forEach((select) => {
      select.addEventListener('change', async (e) => {
        e.stopPropagation();
        const target = e.target as HTMLSelectElement;
        const id = target.dataset.id;
        const newStatus = target.value;
        if (id && this.onStatusUpdate) {
          await this.onStatusUpdate(parseInt(id), newStatus);
        }
      });
    });
  }

  /**
   * Show contact details in modal
   */
  showContactDetails(contactId: number): void {
    const contact = adminDataService.getContactById(contactId);
    if (!contact) {
      logger.warn('Contact not found', { contactId });
      return;
    }

    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalTitle || !modalBody) {
      logger.warn('Modal elements not found');
      return;
    }

    modalTitle.textContent = 'Contact Form Submission';
    modalBody.innerHTML = this.renderContactModal(contact);
    modal.style.display = 'flex';

    // Mark as read if status is 'new'
    if (contact.status === 'new' && this.onStatusUpdate) {
      this.onStatusUpdate(contactId, 'read');
    }
  }

  /**
   * Render contact modal content
   */
  private renderContactModal(contact: Contact): string {
    const date = formatDateTime(contact.created_at);
    const statusClass = `status-${contact.status || 'new'}`;

    const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.name || '-'));
    const safeEmail = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.email || '-'));
    const safeSubject = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.subject || '-'));
    const safeStatus = SanitizationUtils.escapeHtml(contact.status || 'new');
    const safeMessage = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.message || '-'));

    let html = `
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
          <span class="detail-value"><a href="mailto:${safeEmail}">${safeEmail}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Subject</span>
          <span class="detail-value">${safeSubject}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value"><span class="status-badge ${statusClass}">${safeStatus}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Message</span>
          <span class="detail-value message-full">${safeMessage}</span>
        </div>
    `;

    if (contact.read_at) {
      html += `
        <div class="detail-row">
          <span class="detail-label">Read At</span>
          <span class="detail-value">${formatDateTime(contact.read_at)}</span>
        </div>
      `;
    }

    if (contact.replied_at) {
      html += `
        <div class="detail-row">
          <span class="detail-label">Replied At</span>
          <span class="detail-value">${formatDateTime(contact.replied_at)}</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render contact stats cards
   */
  renderContactStats(stats: ContactStats): void {
    const updateStat = (id: string, value: number): void => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    updateStat('contacts-total', stats.total);
    updateStat('contacts-new', stats.new);
    updateStat('contacts-read', stats.read);
    updateStat('contacts-replied', stats.replied);
    updateStat('contacts-archived', stats.archived);
  }
}

// Singleton instance
export const adminContactsRenderer = new AdminContactsRenderer();
export default adminContactsRenderer;
