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

export function getContactsData(): ContactSubmission[] {
  return contactsData;
}

export async function loadContacts(ctx: AdminDashboardContext): Promise<void> {
  storedContext = ctx;
  try {
    const response = await fetch('/api/admin/contact-submissions', {
      credentials: 'include'
    });

    if (response.ok) {
      const data: ContactsData = await response.json();
      contactsData = data.submissions || [];
      updateContactsDisplay(data, ctx);
    }
  } catch (error) {
    console.error('[AdminContacts] Failed to load contact submissions:', error);
  }
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

  tableBody.innerHTML = submissions
    .map((submission) => {
      const date = new Date(submission.created_at).toLocaleDateString();
      const safeName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(submission.name || '-'));
      const safeEmail = SanitizationUtils.escapeHtml(submission.email || '-');
      const safeCompany = submission.company ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(submission.company)) : '';
      const safeMessage = SanitizationUtils.escapeHtml(submission.message || '-');
      const truncatedMessage =
        safeMessage.length > 50 ? `${safeMessage.substring(0, 50)}...` : safeMessage;
      const safeTitleMessage = SanitizationUtils.escapeHtml(submission.message || '');

      return `
        <tr data-contact-id="${submission.id}">
          <td>${date}</td>
          <td>${safeName}</td>
          <td>${safeEmail}</td>
          <td>${safeCompany}</td>
          <td class="message-cell" title="${safeTitleMessage}">${truncatedMessage}</td>
          <td>
            <select class="contact-status-select status-select" data-id="${submission.id}" onclick="event.stopPropagation()">
              <option value="new" ${submission.status === 'new' ? 'selected' : ''}>New</option>
              <option value="read" ${submission.status === 'read' ? 'selected' : ''}>Read</option>
              <option value="responded" ${submission.status === 'responded' ? 'selected' : ''}>Responded</option>
              <option value="archived" ${submission.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>
          </td>
        </tr>
      `;
    })
    .join('');

  // Add click handlers to rows
  const rows = tableBody.querySelectorAll('tr[data-contact-id]');
  rows.forEach((row) => {
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') return;
      const contactId = parseInt((row as HTMLElement).dataset.contactId || '0');
      showContactDetails(contactId);
    });
  });

  // Add change handlers for status selects
  const statusSelects = tableBody.querySelectorAll('.contact-status-select');
  statusSelects.forEach((select) => {
    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const id = target.dataset.id;
      if (id) {
        updateContactStatus(parseInt(id), target.value, ctx);
      }
    });
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
          <span class="meta-label">Name</span>
          <span class="meta-value">${safeName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Email</span>
          <span class="meta-value">${safeEmail}</span>
        </div>
        ${safeCompany ? `
        <div class="meta-item">
          <span class="meta-label">Company</span>
          <span class="meta-value">${safeCompany}</span>
        </div>
        ` : ''}
        ${safePhone ? `
        <div class="meta-item">
          <span class="meta-label">Phone</span>
          <span class="meta-value">${safePhone}</span>
        </div>
        ` : ''}
        <div class="meta-item">
          <span class="meta-label">Status</span>
          <span class="meta-value">
            <select class="contact-status-select status-select" id="panel-status-select" data-id="${contact.id}">
              <option value="new" ${contact.status === 'new' ? 'selected' : ''}>New</option>
              <option value="read" ${contact.status === 'read' ? 'selected' : ''}>Read</option>
              <option value="responded" ${contact.status === 'responded' ? 'selected' : ''}>Responded</option>
              <option value="archived" ${contact.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>
          </span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Created</span>
          <span class="meta-value">${date}</span>
        </div>
      </div>
      <div class="project-description-row">
        <div class="meta-item description-item">
          <span class="meta-label">Message</span>
          <span class="meta-value">${safeMessage}</span>
        </div>
      </div>
      <div class="details-actions">
        <a href="mailto:${safeEmail}" class="btn">Reply via Email</a>
        ${contact.status !== 'archived' ? `<button class="btn btn-secondary" id="archive-contact-btn" data-id="${contact.id}">Archive</button>` : ''}
      </div>
    </div>
  `;

  // Add event listener for status change
  const statusSelect = detailsPanel.querySelector('#panel-status-select') as HTMLSelectElement;
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const id = parseInt(target.dataset.id || '0');
      if (id && storedContext) {
        updateContactStatus(id, target.value, storedContext);
        // Update table row status select
        const tableSelect = document.querySelector(`.contact-status-select[data-id="${id}"]`) as HTMLSelectElement;
        if (tableSelect && tableSelect !== statusSelect) {
          tableSelect.value = target.value;
        }
      }
    });
  }

  // Add event listener for archive button
  const archiveBtn = detailsPanel.querySelector('#archive-contact-btn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      const id = parseInt((archiveBtn as HTMLElement).dataset.id || '0');
      if (id && storedContext) {
        updateContactStatus(id, 'archived', storedContext);
        // Update status select in panel
        if (statusSelect) statusSelect.value = 'archived';
        // Update table row status select
        const tableSelect = document.querySelector(`.contact-status-select[data-id="${id}"]`) as HTMLSelectElement;
        if (tableSelect) tableSelect.value = 'archived';
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
    const response = await fetch(`/api/admin/contact-submissions/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      ctx.showNotification('Status updated', 'success');
      // Update local data
      const contact = contactsData.find((c) => c.id === id);
      if (contact) {
        contact.status = status as ContactSubmission['status'];
      }
    } else {
      const error = await response.json();
      ctx.showNotification(error.message || 'Failed to update status', 'error');
    }
  } catch (error) {
    console.error('[AdminContacts] Failed to update status:', error);
    ctx.showNotification('Failed to update status', 'error');
  }
}
