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

export function getContactsData(): ContactSubmission[] {
  return contactsData;
}

export async function loadContacts(ctx: AdminDashboardContext): Promise<void> {
  if (ctx.isDemo()) return;

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
      const safeName = SanitizationUtils.escapeHtml(submission.name || '-');
      const safeEmail = SanitizationUtils.escapeHtml(submission.email || '-');
      const safeCompany = SanitizationUtils.escapeHtml(submission.company || '-');
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
  if (!detailsPanel) return;

  const safeName = SanitizationUtils.escapeHtml(contact.name || '-');
  const safeEmail = SanitizationUtils.escapeHtml(contact.email || '-');
  const safeCompany = SanitizationUtils.escapeHtml(contact.company || '-');
  const safePhone = SanitizationUtils.escapeHtml(contact.phone || '-');
  const safeMessage = SanitizationUtils.escapeHtml(contact.message || '-');

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Contact from ${safeName}</h3>
      <button class="close-btn" onclick="document.getElementById('contact-details-panel').classList.add('hidden')">×</button>
    </div>
    <div class="details-content">
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
      <p><strong>Company:</strong> ${safeCompany}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Status:</strong> ${contact.status}</p>
      <p><strong>Received:</strong> ${new Date(contact.created_at).toLocaleString()}</p>
      <div class="message-box">
        <strong>Message:</strong>
        <p>${safeMessage}</p>
      </div>
      <div class="actions">
        <a href="mailto:${safeEmail}" class="action-btn">Reply via Email</a>
      </div>
    </div>
  `;

  detailsPanel.classList.remove('hidden');
}

export async function updateContactStatus(
  id: number,
  status: string,
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

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
