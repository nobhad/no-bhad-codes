/**
 * ===============================================
 * ADMIN EMAIL TEMPLATES MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-email-templates.ts
 *
 * Email template management for admin dashboard.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut, apiDelete, parseApiResponse } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { confirmDanger } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { createPortalModal, type PortalModalInstance } from '../../../components/portal-modal';
import { createModalDropdown } from '../../../components/modal-dropdown';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { getStatusDotHTML } from '../../../components/status-badge';

// ============================================
// TYPES
// ============================================

interface EmailTemplate {
  id: number;
  name: string;
  description: string | null;
  category: EmailTemplateCategory;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: TemplateVariable[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateVariable {
  name: string;
  description: string;
}

interface TemplateVersion {
  id: number;
  template_id: number;
  version: number;
  subject: string;
  body_html: string;
  body_text: string | null;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

type EmailTemplateCategory =
  | 'notification'
  | 'invoice'
  | 'contract'
  | 'project'
  | 'reminder'
  | 'general';

// ============================================
// CONSTANTS
// ============================================

const API_BASE = '/api/email-templates';

const CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  notification: 'Notification',
  invoice: 'Invoice',
  contract: 'Contract',
  project: 'Project',
  reminder: 'Reminder',
  general: 'General'
};

// ============================================
// STATE
// ============================================

let _storedContext: AdminDashboardContext | null = null;
let cachedTemplates: EmailTemplate[] = [];
let currentCategoryFilter: string = 'all';

// Modal instances
let templateModal: PortalModalInstance | null = null;
let previewModal: PortalModalInstance | null = null;
let versionsModal: PortalModalInstance | null = null;

// ============================================
// DOM HELPERS
// ============================================

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeHtml(text: string): string {
  return SanitizationUtils.escapeHtml(text);
}

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function loadEmailTemplatesData(ctx: AdminDashboardContext): Promise<void> {
  _storedContext = ctx;

  // Initial load
  await loadTemplates();

  // Set up handlers
  setupEmailTemplatesHandlers();
}

export async function loadTemplates(): Promise<void> {
  const tbody = el('email-templates-table-body');
  if (!tbody) return;

  showTableLoading(tbody, 6, 'Loading email templates...');

  try {
    const res = await apiFetch(API_BASE);
    if (!res.ok) throw new Error('Failed to load email templates');

    const data = await parseApiResponse<{ templates: EmailTemplate[] }>(res);
    cachedTemplates = data.templates || [];

    renderTemplatesTable();
  } catch (error) {
    console.error('[AdminEmailTemplates] Error loading templates:', error);
    if (tbody) {
      showTableError(tbody, 6, 'Error loading templates', loadTemplates);
    }
  }
}

function renderTemplatesTable(): void {
  const tbody = el('email-templates-table-body');
  if (!tbody) return;

  // Filter by category
  const filtered = currentCategoryFilter === 'all'
    ? cachedTemplates
    : cachedTemplates.filter(t => t.category === currentCategoryFilter);

  if (filtered.length === 0) {
    const message = currentCategoryFilter === 'all'
      ? 'No email templates found.'
      : `No ${CATEGORY_LABELS[currentCategoryFilter as EmailTemplateCategory] || currentCategoryFilter} templates found.`;
    showTableEmpty(tbody, 6, message);
    return;
  }

  tbody.innerHTML = filtered.map(template => `
    <tr data-template-id="${template.id}">
      <td>
        <div class="template-name-cell">
          <strong>${escapeHtml(template.name)}</strong>
          ${template.is_system ? '<span class="system-badge">System</span>' : ''}
          ${template.description ? `<div class="template-description">${escapeHtml(template.description)}</div>` : ''}
        </div>
      </td>
      <td>
        <span class="category-badge category-${template.category}">
          ${CATEGORY_LABELS[template.category] || template.category}
        </span>
      </td>
      <td>
        <span class="template-subject">${escapeHtml(template.subject)}</span>
      </td>
      <td>
        ${getStatusDotHTML(template.is_active ? 'active' : 'inactive')}
      </td>
      <td>
        <span class="date-cell">${formatDate(template.updated_at, 'short')}</span>
      </td>
      <td>
        <div class="table-actions">
          <button class="icon-btn template-preview" data-id="${template.id}" title="Preview" aria-label="Preview template">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="icon-btn template-edit" data-id="${template.id}" title="Edit" aria-label="Edit template">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn template-versions" data-id="${template.id}" title="Version History" aria-label="View version history">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="icon-btn template-test" data-id="${template.id}" title="Send Test" aria-label="Send test email">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          ${!template.is_system ? `
            <button class="icon-btn icon-btn-danger template-delete" data-id="${template.id}" data-name="${escapeHtml(template.name)}" title="Delete" aria-label="Delete template">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function setupEmailTemplatesHandlers(): void {
  // Category filter tabs
  const categoryTabs = document.querySelectorAll('.template-category-tab');
  categoryTabs.forEach(tab => {
    if (tab.getAttribute('data-bound')) return;
    tab.setAttribute('data-bound', 'true');
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategoryFilter = (tab as HTMLElement).dataset.category || 'all';
      renderTemplatesTable();
    });
  });

  // Create button
  const createBtn = el('create-email-template-btn');
  if (createBtn && !createBtn.dataset.bound) {
    createBtn.dataset.bound = 'true';
    createBtn.addEventListener('click', () => openTemplateModal());
  }

  // Refresh button
  const refreshBtn = el('email-templates-refresh');
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', () => loadTemplates());
  }

  // Table actions (delegated)
  const tbody = el('email-templates-table-body');
  if (tbody && !tbody.dataset.bound) {
    tbody.dataset.bound = 'true';
    tbody.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;

      const id = parseInt(btn.dataset.id || '0');
      if (!id) return;

      if (btn.classList.contains('template-preview')) {
        await openPreviewModal(id);
      } else if (btn.classList.contains('template-edit')) {
        await openTemplateModal(id);
      } else if (btn.classList.contains('template-versions')) {
        await openVersionsModal(id);
      } else if (btn.classList.contains('template-test')) {
        await sendTestEmail(id);
      } else if (btn.classList.contains('template-delete')) {
        const name = btn.dataset.name || 'this template';
        await deleteTemplate(id, name);
      }
    });
  }
}

// ============================================
// TEMPLATE MODAL (CREATE/EDIT)
// ============================================

async function openTemplateModal(id?: number): Promise<void> {
  const isEdit = !!id;
  let template: EmailTemplate | null = null;

  if (isEdit) {
    template = cachedTemplates.find(t => t.id === id) || null;
    if (!template) return;
  }

  // Create modal if not exists
  if (!templateModal) {
    templateModal = createPortalModal({
      id: 'email-template-modal',
      titleId: 'email-template-modal-title',
      title: 'Create Email Template',
      contentClassName: 'email-template-modal-content modal-content-wide',
      onClose: () => templateModal?.hide()
    });

    templateModal.body.innerHTML = `
      <form id="email-template-form" class="modal-form">
        <input type="hidden" id="template-id" />
        <div class="form-row">
          <div class="form-group">
            <label for="template-name">Template Name *</label>
            <input type="text" id="template-name" class="form-input" required maxlength="50" placeholder="e.g., welcome, invoice_reminder" />
          </div>
          <div class="form-group">
            <label for="template-category">Category *</label>
            <div id="template-category-mount"></div>
          </div>
        </div>
        <div class="form-group">
          <label for="template-description">Description</label>
          <input type="text" id="template-description" class="form-input" maxlength="200" placeholder="Brief description of when this template is used" />
        </div>
        <div class="form-group">
          <label for="template-subject">Subject Line *</label>
          <input type="text" id="template-subject" class="form-input" required maxlength="200" placeholder="Use {{variables}} for dynamic content" />
        </div>
        <div class="form-group">
          <label for="template-body-html">HTML Body *</label>
          <textarea id="template-body-html" class="form-input code-input" rows="10" required placeholder="<h1>Hello {{client.name}}</h1>..."></textarea>
        </div>
        <div class="form-group">
          <label for="template-body-text">Plain Text Body (optional)</label>
          <textarea id="template-body-text" class="form-input code-input" rows="4" placeholder="Hello {{client.name}}..."></textarea>
        </div>
        <div class="form-group">
          <label for="template-variables">Variables (JSON array)</label>
          <textarea id="template-variables" class="form-input code-input" rows="3" placeholder='[{"name": "client.name", "description": "Client name"}]'></textarea>
        </div>
        <div class="form-group form-group-inline">
          <label>
            <input type="checkbox" id="template-active" checked />
            Active
          </label>
        </div>
      </form>
    `;

    templateModal.footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="template-cancel-btn">CANCEL</button>
      <button type="button" class="btn btn-outline" id="template-preview-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        PREVIEW
      </button>
      <button type="submit" form="email-template-form" class="btn btn-primary">SAVE</button>
    `;

    // Cancel button
    el('template-cancel-btn')?.addEventListener('click', () => templateModal?.hide());

    // Preview button
    el('template-preview-btn')?.addEventListener('click', async () => {
      await previewFromForm();
    });

    // Form submit
    el('email-template-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveTemplate();
    });

    // Create category dropdown
    const categoryMount = el('template-category-mount');
    if (categoryMount) {
      const categoryDropdown = createModalDropdown({
        options: [
          { value: 'notification', label: 'Notification' },
          { value: 'invoice', label: 'Invoice' },
          { value: 'contract', label: 'Contract' },
          { value: 'project', label: 'Project' },
          { value: 'reminder', label: 'Reminder' },
          { value: 'general', label: 'General' }
        ],
        currentValue: 'notification',
        ariaLabelPrefix: 'Category'
      });
      categoryDropdown.id = 'template-category';
      categoryMount.appendChild(categoryDropdown);
    }
  }

  // Set title and populate form
  templateModal.setTitle(isEdit ? 'Edit Email Template' : 'Create Email Template');

  (el('template-id') as HTMLInputElement).value = template?.id?.toString() || '';
  (el('template-name') as HTMLInputElement).value = template?.name || '';
  (el('template-name') as HTMLInputElement).disabled = !!template?.is_system;
  (el('template-description') as HTMLInputElement).value = template?.description || '';

  // Set category dropdown value
  const categoryDropdown = el('template-category');
  if (categoryDropdown) {
    const categoryValue = template?.category || 'notification';
    categoryDropdown.setAttribute('data-value', categoryValue);
    const categoryLabels: Record<string, string> = {
      notification: 'Notification',
      invoice: 'Invoice',
      contract: 'Contract',
      project: 'Project',
      reminder: 'Reminder',
      general: 'General'
    };
    const trigger = categoryDropdown.querySelector('.modal-dropdown-trigger span');
    if (trigger) trigger.textContent = categoryLabels[categoryValue] || categoryValue;
  }

  (el('template-subject') as HTMLInputElement).value = template?.subject || '';
  (el('template-body-html') as HTMLTextAreaElement).value = template?.body_html || '';
  (el('template-body-text') as HTMLTextAreaElement).value = template?.body_text || '';
  (el('template-variables') as HTMLTextAreaElement).value = template?.variables ? JSON.stringify(template.variables, null, 2) : '';
  (el('template-active') as HTMLInputElement).checked = template?.is_active ?? true;

  templateModal.show();
  manageFocusTrap(templateModal.overlay);
}

async function saveTemplate(): Promise<void> {
  const id = (el('template-id') as HTMLInputElement).value;
  const isEdit = !!id;

  // Parse variables JSON
  let variables: TemplateVariable[] = [];
  try {
    const varsStr = (el('template-variables') as HTMLTextAreaElement).value.trim();
    if (varsStr) {
      variables = JSON.parse(varsStr);
    }
  } catch {
    showToast('Invalid JSON in variables field', 'error');
    return;
  }

  const categoryEl = el('template-category');
  const categoryValue = categoryEl?.getAttribute('data-value') || 'notification';

  const payload = {
    name: (el('template-name') as HTMLInputElement).value.trim(),
    description: (el('template-description') as HTMLInputElement).value.trim() || null,
    category: categoryValue,
    subject: (el('template-subject') as HTMLInputElement).value.trim(),
    body_html: (el('template-body-html') as HTMLTextAreaElement).value,
    body_text: (el('template-body-text') as HTMLTextAreaElement).value || null,
    variables,
    is_active: (el('template-active') as HTMLInputElement).checked
  };

  try {
    const res = isEdit
      ? await apiPut(`${API_BASE}/${id}`, payload)
      : await apiPost(API_BASE, payload);

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save template');
    }

    showToast(isEdit ? 'Template updated' : 'Template created', 'success');
    templateModal?.hide();
    await loadTemplates();
  } catch (error) {
    console.error('[AdminEmailTemplates] Save error:', error);
    showToast(error instanceof Error ? error.message : 'Error saving template', 'error');
  }
}

async function deleteTemplate(id: number, name: string): Promise<void> {
  const confirmed = await confirmDanger(
    `Are you sure you want to delete "${name}"? This cannot be undone.`,
    'Delete',
    'Delete Template'
  );

  if (!confirmed) return;

  try {
    const res = await apiDelete(`${API_BASE}/${id}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete template');
    }

    showToast('Template deleted', 'success');
    await loadTemplates();
  } catch (error) {
    console.error('[AdminEmailTemplates] Delete error:', error);
    showToast(error instanceof Error ? error.message : 'Error deleting template', 'error');
  }
}

// ============================================
// PREVIEW MODAL
// ============================================

async function openPreviewModal(id: number): Promise<void> {
  const template = cachedTemplates.find(t => t.id === id);
  if (!template) return;

  // Create modal if not exists
  if (!previewModal) {
    previewModal = createPortalModal({
      id: 'email-preview-modal',
      titleId: 'email-preview-modal-title',
      title: 'Email Preview',
      contentClassName: 'email-preview-modal-content modal-content-wide',
      onClose: () => previewModal?.hide()
    });

    previewModal.footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="preview-close-btn">CLOSE</button>
    `;

    el('preview-close-btn')?.addEventListener('click', () => previewModal?.hide());
  }

  previewModal.body.innerHTML = '<div class="loading-message">Generating preview...</div>';
  previewModal.setTitle(`Preview: ${escapeHtml(template.name)}`);
  previewModal.show();
  manageFocusTrap(previewModal.overlay);

  try {
    const res = await apiPost(`${API_BASE}/${id}/preview`, {});
    if (!res.ok) throw new Error('Failed to generate preview');

    const data = await parseApiResponse<{
      preview: { subject: string; body_html: string; body_text: string | null };
      sample_data: Record<string, unknown>;
    }>(res);

    previewModal.body.innerHTML = `
      <div class="email-preview">
        <div class="preview-section">
          <h4>Subject</h4>
          <div class="preview-subject">${escapeHtml(data.preview.subject)}</div>
        </div>
        <div class="preview-section">
          <h4>HTML Preview</h4>
          <div class="preview-html-container">
            <iframe id="preview-html-iframe" sandbox="allow-same-origin" title="Email HTML preview"></iframe>
          </div>
        </div>
        ${data.preview.body_text ? `
          <div class="preview-section">
            <h4>Plain Text</h4>
            <pre class="preview-text">${escapeHtml(data.preview.body_text)}</pre>
          </div>
        ` : ''}
        <div class="preview-section">
          <h4>Sample Data Used</h4>
          <pre class="preview-data">${escapeHtml(JSON.stringify(data.sample_data, null, 2))}</pre>
        </div>
      </div>
    `;

    // Set iframe content
    const iframe = el('preview-html-iframe') as HTMLIFrameElement;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(data.preview.body_html);
        doc.close();
        // Adjust iframe height
        setTimeout(() => {
          iframe.style.height = `${doc.body.scrollHeight + 20  }px`;
        }, 100);
      }
    }
  } catch (error) {
    console.error('[AdminEmailTemplates] Preview error:', error);
    previewModal.body.innerHTML = '<div class="error-message">Error generating preview</div>';
  }
}

async function previewFromForm(): Promise<void> {
  // Parse variables
  let variables: TemplateVariable[] = [];
  try {
    const varsStr = (el('template-variables') as HTMLTextAreaElement).value.trim();
    if (varsStr) {
      variables = JSON.parse(varsStr);
    }
  } catch {
    showToast('Invalid JSON in variables field', 'error');
    return;
  }

  const payload = {
    subject: (el('template-subject') as HTMLInputElement).value.trim(),
    body_html: (el('template-body-html') as HTMLTextAreaElement).value,
    body_text: (el('template-body-text') as HTMLTextAreaElement).value || null,
    variables
  };

  // Create preview modal if not exists
  if (!previewModal) {
    previewModal = createPortalModal({
      id: 'email-preview-modal',
      titleId: 'email-preview-modal-title',
      title: 'Email Preview',
      contentClassName: 'email-preview-modal-content modal-content-wide',
      onClose: () => previewModal?.hide()
    });

    previewModal.footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="preview-close-btn">CLOSE</button>
    `;

    el('preview-close-btn')?.addEventListener('click', () => previewModal?.hide());
  }

  previewModal.body.innerHTML = '<div class="loading-message">Generating preview...</div>';
  previewModal.setTitle('Preview (Unsaved)');
  previewModal.show();

  try {
    const res = await apiPost(`${API_BASE}/preview`, payload);
    if (!res.ok) throw new Error('Failed to generate preview');

    const data = await parseApiResponse<{
      preview: { subject: string; body_html: string; body_text: string | null };
      sample_data: Record<string, unknown>;
    }>(res);

    previewModal.body.innerHTML = `
      <div class="email-preview">
        <div class="preview-section">
          <h4>Subject</h4>
          <div class="preview-subject">${escapeHtml(data.preview.subject)}</div>
        </div>
        <div class="preview-section">
          <h4>HTML Preview</h4>
          <div class="preview-html-container">
            <iframe id="preview-html-iframe" sandbox="allow-same-origin" title="Email HTML preview"></iframe>
          </div>
        </div>
        ${data.preview.body_text ? `
          <div class="preview-section">
            <h4>Plain Text</h4>
            <pre class="preview-text">${escapeHtml(data.preview.body_text)}</pre>
          </div>
        ` : ''}
      </div>
    `;

    // Set iframe content
    const iframe = el('preview-html-iframe') as HTMLIFrameElement;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(data.preview.body_html);
        doc.close();
        setTimeout(() => {
          iframe.style.height = `${doc.body.scrollHeight + 20  }px`;
        }, 100);
      }
    }
  } catch (error) {
    console.error('[AdminEmailTemplates] Preview error:', error);
    previewModal.body.innerHTML = '<div class="error-message">Error generating preview</div>';
  }
}

// ============================================
// VERSIONS MODAL
// ============================================

async function openVersionsModal(id: number): Promise<void> {
  const template = cachedTemplates.find(t => t.id === id);
  if (!template) return;

  // Create modal if not exists
  if (!versionsModal) {
    versionsModal = createPortalModal({
      id: 'email-versions-modal',
      titleId: 'email-versions-modal-title',
      title: 'Version History',
      contentClassName: 'email-versions-modal-content modal-content-wide',
      onClose: () => versionsModal?.hide()
    });
  }

  versionsModal.body.innerHTML = '<div class="loading-message">Loading versions...</div>';
  versionsModal.setTitle(`Versions: ${escapeHtml(template.name)}`);
  versionsModal.show();
  manageFocusTrap(versionsModal.overlay);

  try {
    const res = await apiFetch(`${API_BASE}/${id}/versions`);
    if (!res.ok) throw new Error('Failed to load versions');

    const data = await parseApiResponse<{ versions: TemplateVersion[] }>(res);
    const versions = data.versions || [];

    if (versions.length === 0) {
      versionsModal.body.innerHTML = '<div class="empty-message">No version history available</div>';
      return;
    }

    versionsModal.body.innerHTML = `
      <div class="versions-list">
        ${versions.map(v => `
          <div class="version-item">
            <div class="version-header">
              <div class="version-number">Version ${v.version}</div>
              <div class="version-date">${formatDate(v.created_at, 'datetime')}</div>
            </div>
            <div class="version-details">
              <div class="version-subject"><strong>Subject:</strong> ${escapeHtml(v.subject)}</div>
              ${v.changed_by ? `<div class="version-author">Changed by: ${escapeHtml(v.changed_by)}</div>` : ''}
              ${v.change_reason ? `<div class="version-reason">Reason: ${escapeHtml(v.change_reason)}</div>` : ''}
            </div>
            <div class="version-actions">
              <button class="btn btn-sm btn-secondary version-view" data-template-id="${id}" data-version="${v.version}">View</button>
              <button class="btn btn-sm btn-primary version-restore" data-template-id="${id}" data-version="${v.version}">Restore</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind version action handlers
    versionsModal.body.querySelectorAll('.version-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0');
        const version = parseInt((btn as HTMLElement).dataset.version || '0');
        await restoreVersion(templateId, version);
      });
    });
  } catch (error) {
    console.error('[AdminEmailTemplates] Versions error:', error);
    versionsModal.body.innerHTML = '<div class="error-message">Error loading versions</div>';
  }
}

async function restoreVersion(templateId: number, version: number): Promise<void> {
  try {
    const res = await apiPost(`${API_BASE}/${templateId}/versions/${version}/restore`, {});
    if (!res.ok) throw new Error('Failed to restore version');

    showToast(`Template restored to version ${version}`, 'success');
    versionsModal?.hide();
    await loadTemplates();
  } catch (error) {
    console.error('[AdminEmailTemplates] Restore error:', error);
    showToast('Error restoring version', 'error');
  }
}

// ============================================
// SEND TEST EMAIL
// ============================================

async function sendTestEmail(id: number): Promise<void> {
  const template = cachedTemplates.find(t => t.id === id);
  if (!template) return;

  const email = prompt('Enter email address to send test to:');
  if (!email) return;

  // Basic email validation
  if (!email.includes('@')) {
    showToast('Invalid email address', 'error');
    return;
  }

  try {
    const res = await apiPost(`${API_BASE}/${id}/test`, {
      to_email: email
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to send test email');
    }

    showToast(`Test email sent to ${email}`, 'success');
  } catch (error) {
    console.error('[AdminEmailTemplates] Test email error:', error);
    showToast(error instanceof Error ? error.message : 'Error sending test email', 'error');
  }
}
