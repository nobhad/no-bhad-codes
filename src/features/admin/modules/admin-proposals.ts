/**
 * ===============================================
 * ADMIN PROPOSALS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-proposals.ts
 *
 * Proposal management functionality for admin dashboard.
 * View, review, and manage client proposal submissions.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatDateTime, formatProjectType } from '../../../utils/format-utils';
import { apiFetch, apiPut, apiPost, apiDelete } from '../../../utils/api-client';
import { createTableDropdown } from '../../../utils/table-dropdown';
import type { AdminDashboardContext } from '../admin-types';
import { confirmDialog, alertSuccess, alertError, multiPromptDialog } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';

// ============================================================================
// TYPES
// ============================================================================

interface Proposal {
  id: number;
  projectId: number;
  clientId: number;
  projectType: string;
  selectedTier: 'good' | 'better' | 'best';
  basePrice: number;
  finalPrice: number;
  maintenanceOption: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected' | 'converted';
  clientNotes: string | null;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  project: {
    name: string;
  };
  client: {
    name: string;
    email: string;
    company: string | null;
  };
  features?: Array<{
    featureId: string;
    featureName: string;
    featurePrice: number;
    isIncludedInTier: boolean;
    isAddon: boolean;
  }>;
}

interface ProposalsData {
  proposals: Proposal[];
  total: number;
}

interface ProposalTemplate {
  id: number;
  name: string;
  description: string | null;
  content: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ProposalVersion {
  id: number;
  proposal_id: number;
  version_number: number;
  content: Record<string, unknown>;
  created_by: string;
  created_at: string;
  change_summary: string | null;
}

interface ProposalComment {
  id: number;
  proposal_id: number;
  author_type: 'admin' | 'client';
  author_name: string;
  author_email?: string;
  content: string;
  is_internal: boolean;
  parent_comment_id?: number;
  created_at: string;
}

interface ProposalCustomItem {
  id: number;
  proposal_id: number;
  item_type: 'service' | 'product' | 'discount' | 'fee' | 'hourly';
  description: string;
  quantity: number;
  unit_price: number;
  unit_label?: string;
  is_taxable: boolean;
  is_optional: boolean;
  sort_order: number;
}

interface ProposalActivity {
  id: number;
  proposal_id: number;
  activity_type: string;
  actor?: string;
  actor_type?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// STATUS OPTIONS
// ============================================================================

const PROPOSAL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'var(--color-warning, #f59e0b)' },
  { value: 'reviewed', label: 'Reviewed', color: 'var(--color-info, #3b82f6)' },
  { value: 'accepted', label: 'Accepted', color: 'var(--color-success, #22c55e)' },
  { value: 'rejected', label: 'Rejected', color: 'var(--color-danger, #ef4444)' },
  { value: 'converted', label: 'Converted', color: 'var(--color-primary, #00aff0)' }
];

// ============================================================================
// STATE
// ============================================================================

let proposalsData: Proposal[] = [];
let _storedContext: AdminDashboardContext | null = null;
let currentFilter: string = 'all';
let templatesData: ProposalTemplate[] = [];
let currentProposalVersions: ProposalVersion[] = [];
let _currentView: 'proposals' | 'templates' = 'proposals';

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

function clearElementCache(): void {
  cachedElements.clear();
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getProposalsData(): Proposal[] {
  return proposalsData;
}

export function setProposalsContext(ctx: AdminDashboardContext): void {
  _storedContext = ctx;
}

/**
 * Load and display proposals
 */
export async function loadProposals(ctx: AdminDashboardContext): Promise<void> {
  _storedContext = ctx;
  clearElementCache();

  const container = getElement('proposals-content');
  if (!container) {
    console.error('[AdminProposals] Container not found');
    return;
  }

  // Show loading state
  container.innerHTML = renderProposalsLayout();

  // Setup view toggle
  setupViewToggle(ctx);

  // Setup filter buttons
  setupFilterButtons(ctx);

  // Load data
  await refreshProposals(ctx);
}

/**
 * Refresh proposals data from API
 */
async function refreshProposals(ctx: AdminDashboardContext): Promise<void> {
  const tableBody = document.getElementById('proposals-table-body');
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading proposals...</td></tr>';
  }

  try {
    const statusParam = currentFilter !== 'all' ? `?status=${currentFilter}` : '';
    const response = await apiFetch(`/api/proposals/admin/list${statusParam}`);

    if (response.ok) {
      const data: { success: boolean; data: ProposalsData } = await response.json();
      proposalsData = data.data.proposals || [];
      renderProposalsTable(proposalsData, ctx);
      updateStats(proposalsData);
    } else if (response.status !== 401) {
      console.error('[AdminProposals] API error:', response.status);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-row">Error loading proposals: ${response.status}</td></tr>`;
      }
    }
  } catch (error) {
    console.error('[AdminProposals] Failed to load proposals:', error);
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">Network error loading proposals</td></tr>';
    }
  }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderProposalsLayout(): string {
  return `
    <div class="proposals-view-toggle">
      <button class="view-toggle-btn active" data-view="proposals">Proposals</button>
      <button class="view-toggle-btn" data-view="templates">Templates</button>
    </div>

    <div class="proposals-panel" id="proposals-list-panel">
      <div class="proposals-header">
        <h2>Proposal Requests</h2>
        <div class="proposals-actions">
          <div class="filter-buttons" id="proposal-filters">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="pending">Pending</button>
            <button class="filter-btn" data-filter="reviewed">Reviewed</button>
            <button class="filter-btn" data-filter="accepted">Accepted</button>
          </div>
          <button class="btn btn-secondary" id="refresh-proposals-btn">
            Refresh
          </button>
        </div>
      </div>

      <div class="proposals-stats" id="proposals-stats">
        <div class="stat-card">
          <span class="stat-value" id="stat-pending">0</span>
          <span class="stat-label">Pending</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-reviewed">0</span>
          <span class="stat-label">Reviewed</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-accepted">0</span>
          <span class="stat-label">Accepted</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-total-value">$0</span>
          <span class="stat-label">Total Value</span>
        </div>
      </div>

      <div class="table-responsive">
        <table class="admin-table proposals-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Project</th>
              <th>Tier</th>
              <th>Price</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="proposals-table-body">
            <tr><td colspan="7" class="loading-row">Loading proposals...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="proposal-details-panel" id="proposal-details-panel" style="display: none;">
      <div class="panel-header">
        <button class="btn-back" id="proposal-back-btn">Back to List</button>
        <h3>Proposal Details</h3>
      </div>
      <div class="panel-content" id="proposal-details-content"></div>
    </div>

    <div class="templates-panel" id="templates-panel" style="display: none;">
      <div class="templates-header">
        <h2>Proposal Templates</h2>
        <button class="btn btn-primary" id="create-template-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          New Template
        </button>
      </div>
      <div class="templates-list" id="templates-list">
        <div class="loading-row">Loading templates...</div>
      </div>
    </div>

    <div class="template-editor-modal" id="template-editor-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="template-modal-title">New Template</h3>
          <button class="btn-close" id="close-template-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="template-name">Template Name</label>
            <input type="text" id="template-name" class="form-input" placeholder="e.g., Standard Website Package">
          </div>
          <div class="form-group">
            <label for="template-description">Description</label>
            <textarea id="template-description" class="form-input" rows="2" placeholder="Brief description of this template"></textarea>
          </div>
          <div class="form-group">
            <label for="template-project-type">Project Type</label>
            <select id="template-project-type" class="form-input">
              <option value="business-website">Business Website</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="web-app">Web Application</option>
              <option value="branding">Branding</option>
            </select>
          </div>
          <div class="form-group">
            <label for="template-tier">Default Tier</label>
            <select id="template-tier" class="form-input">
              <option value="good">Good</option>
              <option value="better">Better</option>
              <option value="best">Best</option>
            </select>
          </div>
          <div class="form-group">
            <label for="template-base-price">Base Price ($)</label>
            <input type="number" id="template-base-price" class="form-input" placeholder="0" min="0">
          </div>
          <div class="form-group form-checkbox">
            <input type="checkbox" id="template-is-default">
            <label for="template-is-default">Set as default template</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancel-template-btn">Cancel</button>
          <button class="btn btn-primary" id="save-template-btn">Save Template</button>
        </div>
      </div>
    </div>
  `;
}

function renderProposalsTable(proposals: Proposal[], ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('proposals-table-body');
  if (!tableBody) return;

  if (proposals.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="empty-row">No proposals found</td></tr>';
    return;
  }

  tableBody.innerHTML = proposals.map(proposal => renderProposalRow(proposal, ctx)).join('');

  // Setup event listeners
  setupRowEventListeners(proposals, ctx);
}

function renderProposalRow(proposal: Proposal, _ctx: AdminDashboardContext): string {
  const _statusOption = PROPOSAL_STATUS_OPTIONS.find(s => s.value === proposal.status);
  const tierLabel = proposal.selectedTier.charAt(0).toUpperCase() + proposal.selectedTier.slice(1);
  const formattedDate = formatDate(proposal.createdAt);

  return `
    <tr data-proposal-id="${proposal.id}">
      <td>
        <div class="client-info">
          <span class="client-name">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.name))}</span>
          ${proposal.client.company ? `<span class="client-company">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.company))}</span>` : ''}
        </div>
      </td>
      <td>
        <span class="project-name">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.project.name))}</span>
        <span class="project-type">${formatProjectType(proposal.projectType)}</span>
      </td>
      <td>
        <span class="tier-badge tier-${proposal.selectedTier}">${tierLabel}</span>
      </td>
      <td class="price-cell">
        <span class="price-value">${formatPrice(proposal.finalPrice)}</span>
        ${proposal.maintenanceOption && proposal.maintenanceOption !== 'diy'
    ? `<span class="maintenance-badge">+${proposal.maintenanceOption}</span>`
    : ''}
      </td>
      <td>
        <div class="status-dropdown-container" data-proposal-id="${proposal.id}"></div>
      </td>
      <td class="date-cell">${formattedDate}</td>
      <td class="actions-cell">
        <button class="btn-icon btn-view" data-proposal-id="${proposal.id}" title="View Details" aria-label="View proposal details">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${proposal.status === 'accepted' ? `
          <button class="btn-icon btn-convert" data-proposal-id="${proposal.id}" title="Convert to Invoice" aria-label="Convert to invoice">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

function setupRowEventListeners(proposals: Proposal[], ctx: AdminDashboardContext): void {
  // Setup status dropdowns
  proposals.forEach(proposal => {
    const container = document.querySelector(`.status-dropdown-container[data-proposal-id="${proposal.id}"]`);
    if (container) {
      const dropdown = createTableDropdown({
        options: PROPOSAL_STATUS_OPTIONS,
        currentValue: proposal.status,
        onChange: async (newValue) => {
          await updateProposalStatus(proposal.id, newValue, ctx);
        }
      });
      container.innerHTML = '';
      container.appendChild(dropdown);
    }
  });

  // View buttons
  document.querySelectorAll('.btn-view[data-proposal-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.proposalId || '0', 10);
      const proposal = proposals.find(p => p.id === id);
      if (proposal) {
        showProposalDetails(proposal, ctx);
      }
    });
  });

  // Convert buttons
  document.querySelectorAll('.btn-convert[data-proposal-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.proposalId || '0', 10);
      await convertToInvoice(id, ctx);
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refresh-proposals-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => refreshProposals(ctx);
  }

  // Back button
  const backBtn = document.getElementById('proposal-back-btn');
  if (backBtn) {
    backBtn.onclick = () => hideProposalDetails();
  }
}

function setupFilterButtons(ctx: AdminDashboardContext): void {
  const filterContainer = document.getElementById('proposal-filters');
  if (!filterContainer) return;

  filterContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.filter-btn');
    if (!btn) return;

    const filter = (btn as HTMLElement).dataset.filter || 'all';

    // Update active state
    filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update filter and refresh
    currentFilter = filter;
    refreshProposals(ctx);
  });
}

function setupViewToggle(ctx: AdminDashboardContext): void {
  const toggleBtns = document.querySelectorAll('.view-toggle-btn');
  const proposalsPanel = document.getElementById('proposals-list-panel');
  const templatesPanel = document.getElementById('templates-panel');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const view = (btn as HTMLElement).dataset.view as 'proposals' | 'templates';
      _currentView = view;

      // Update active states
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide panels
      if (view === 'proposals') {
        if (proposalsPanel) proposalsPanel.style.display = 'block';
        if (templatesPanel) templatesPanel.style.display = 'none';
      } else {
        if (proposalsPanel) proposalsPanel.style.display = 'none';
        if (templatesPanel) templatesPanel.style.display = 'block';
        await loadTemplates(ctx);
      }
    });
  });
}

// ============================================================================
// TEMPLATES MANAGEMENT
// ============================================================================

async function loadTemplates(ctx: AdminDashboardContext): Promise<void> {
  const templatesList = document.getElementById('templates-list');
  if (!templatesList) return;

  templatesList.innerHTML = '<div class="loading-row">Loading templates...</div>';

  try {
    const response = await apiFetch('/api/proposals/templates');
    if (response.ok) {
      const data = await response.json();
      templatesData = data.data || [];
      renderTemplatesList(ctx);
    } else {
      templatesList.innerHTML = '<div class="empty-row">Error loading templates</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading templates:', error);
    templatesList.innerHTML = '<div class="empty-row">Network error loading templates</div>';
  }
}

function renderTemplatesList(ctx: AdminDashboardContext): void {
  const templatesList = document.getElementById('templates-list');
  if (!templatesList) return;

  if (templatesData.length === 0) {
    templatesList.innerHTML = `
      <div class="empty-state">
        <p>No templates found</p>
        <p class="empty-hint">Create a template to save proposal configurations for reuse</p>
      </div>
    `;
    setupTemplateListeners(ctx);
    return;
  }

  templatesList.innerHTML = `
    <div class="templates-grid">
      ${templatesData.map(template => `
        <div class="template-card" data-template-id="${template.id}">
          <div class="template-card-header">
            <h4>${SanitizationUtils.escapeHtml(template.name)}</h4>
            ${template.is_default ? '<span class="default-badge">Default</span>' : ''}
          </div>
          <div class="template-card-body">
            ${template.description ? `<p class="template-description">${SanitizationUtils.escapeHtml(template.description)}</p>` : ''}
            <div class="template-meta">
              <span class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${formatDate(template.created_at)}
              </span>
            </div>
          </div>
          <div class="template-card-actions">
            <button class="btn btn-secondary btn-sm use-template-btn" data-template-id="${template.id}">
              Use Template
            </button>
            <button class="btn-icon edit-template-btn" data-template-id="${template.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete-template-btn" data-template-id="${template.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  setupTemplateListeners(ctx);
}

function setupTemplateListeners(ctx: AdminDashboardContext): void {
  // Create template button
  const createBtn = document.getElementById('create-template-btn');
  if (createBtn) {
    createBtn.onclick = () => openTemplateEditor(null, ctx);
  }

  // Use template buttons
  document.querySelectorAll('.use-template-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0', 10);
      await useTemplate(templateId, ctx);
    });
  });

  // Edit template buttons
  document.querySelectorAll('.edit-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0', 10);
      const template = templatesData.find(t => t.id === templateId);
      if (template) {
        openTemplateEditor(template, ctx);
      }
    });
  });

  // Delete template buttons
  document.querySelectorAll('.delete-template-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0', 10);
      await deleteTemplate(templateId, ctx);
    });
  });
}

function openTemplateEditor(template: ProposalTemplate | null, ctx: AdminDashboardContext): void {
  const modal = document.getElementById('template-editor-modal');
  const modalTitle = document.getElementById('template-modal-title');
  const nameInput = document.getElementById('template-name') as HTMLInputElement;
  const descInput = document.getElementById('template-description') as HTMLTextAreaElement;
  const typeSelect = document.getElementById('template-project-type') as HTMLSelectElement;
  const tierSelect = document.getElementById('template-tier') as HTMLSelectElement;
  const priceInput = document.getElementById('template-base-price') as HTMLInputElement;
  const defaultCheckbox = document.getElementById('template-is-default') as HTMLInputElement;

  if (!modal || !modalTitle) return;

  // Set modal title
  modalTitle.textContent = template ? 'Edit Template' : 'New Template';

  // Populate fields if editing
  if (template) {
    if (nameInput) nameInput.value = template.name;
    if (descInput) descInput.value = template.description || '';
    const content = template.content as { projectType?: string; tier?: string; basePrice?: number };
    if (typeSelect) typeSelect.value = content.projectType || 'business-website';
    if (tierSelect) tierSelect.value = content.tier || 'good';
    if (priceInput) priceInput.value = (content.basePrice || 0).toString();
    if (defaultCheckbox) defaultCheckbox.checked = template.is_default;
  } else {
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (typeSelect) typeSelect.value = 'business-website';
    if (tierSelect) tierSelect.value = 'good';
    if (priceInput) priceInput.value = '';
    if (defaultCheckbox) defaultCheckbox.checked = false;
  }

  // Show modal
  modal.style.display = 'flex';

  // Setup close handlers
  const closeBtn = document.getElementById('close-template-modal');
  const cancelBtn = document.getElementById('cancel-template-btn');
  const saveBtn = document.getElementById('save-template-btn');
  const overlay = modal.querySelector('.modal-overlay');

  const closeModal = () => {
    modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (overlay) (overlay as HTMLElement).onclick = closeModal;

  if (saveBtn) {
    saveBtn.onclick = async () => {
      await saveTemplate(template?.id || null, ctx);
    };
  }
}

async function saveTemplate(templateId: number | null, ctx: AdminDashboardContext): Promise<void> {
  const nameInput = document.getElementById('template-name') as HTMLInputElement;
  const descInput = document.getElementById('template-description') as HTMLTextAreaElement;
  const typeSelect = document.getElementById('template-project-type') as HTMLSelectElement;
  const tierSelect = document.getElementById('template-tier') as HTMLSelectElement;
  const priceInput = document.getElementById('template-base-price') as HTMLInputElement;
  const defaultCheckbox = document.getElementById('template-is-default') as HTMLInputElement;

  const name = nameInput?.value.trim();
  if (!name) {
    alertError('Please enter a template name');
    return;
  }

  const templateData = {
    name,
    description: descInput?.value.trim() || null,
    content: {
      projectType: typeSelect?.value || 'business-website',
      tier: tierSelect?.value || 'good',
      basePrice: parseInt(priceInput?.value || '0', 10)
    },
    is_default: defaultCheckbox?.checked || false
  };

  try {
    let response;
    if (templateId) {
      response = await apiPut(`/api/proposals/templates/${templateId}`, templateData);
    } else {
      response = await apiPost('/api/proposals/templates', templateData);
    }

    if (response.ok) {
      alertSuccess(templateId ? 'Template updated' : 'Template created');
      const modal = document.getElementById('template-editor-modal');
      if (modal) modal.style.display = 'none';
      await loadTemplates(ctx);
    } else {
      const error = await response.text();
      alertError(`Failed to save template: ${error}`);
    }
  } catch (error) {
    console.error('[AdminProposals] Error saving template:', error);
    alertError('Network error saving template');
  }
}

async function deleteTemplate(templateId: number, ctx: AdminDashboardContext): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Template',
    message: 'Are you sure you want to delete this template? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/proposals/templates/${templateId}`);
    if (response.ok) {
      alertSuccess('Template deleted');
      await loadTemplates(ctx);
    } else {
      alertError('Failed to delete template');
    }
  } catch (error) {
    console.error('[AdminProposals] Error deleting template:', error);
    alertError('Network error deleting template');
  }
}

async function useTemplate(templateId: number, ctx: AdminDashboardContext): Promise<void> {
  const template = templatesData.find(t => t.id === templateId);
  if (!template) return;

  // For now, show a notification - in a full implementation this would
  // pre-fill a proposal creation form with the template data
  ctx.showNotification?.(`Template "${template.name}" selected. Create a new proposal to use it.`, 'info');
}

// ============================================================================
// VERSION HISTORY
// ============================================================================

async function loadProposalVersions(proposalId: number): Promise<void> {
  const versionContainer = document.getElementById('version-history');
  if (!versionContainer) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/versions`);
    if (response.ok) {
      const data = await response.json();
      currentProposalVersions = data.data || [];
      renderVersionHistory(proposalId);
    } else {
      versionContainer.innerHTML = '<div class="empty-row">No versions available</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading versions:', error);
    versionContainer.innerHTML = '<div class="empty-row">Error loading versions</div>';
  }
}

function renderVersionHistory(proposalId: number): void {
  const versionContainer = document.getElementById('version-history');
  if (!versionContainer) return;

  if (currentProposalVersions.length === 0) {
    versionContainer.innerHTML = `
      <div class="version-empty">
        <p>No previous versions</p>
        <button class="btn btn-secondary btn-sm" id="create-version-btn">
          Save Current as Version
        </button>
      </div>
    `;
    const createBtn = document.getElementById('create-version-btn');
    if (createBtn) {
      createBtn.onclick = () => createVersion(proposalId);
    }
    return;
  }

  versionContainer.innerHTML = `
    <div class="version-actions">
      <button class="btn btn-secondary btn-sm" id="create-version-btn">
        Save Current as Version
      </button>
    </div>
    <div class="version-list">
      ${currentProposalVersions.map(version => `
        <div class="version-item" data-version-id="${version.id}">
          <div class="version-info">
            <span class="version-number">v${version.version_number}</span>
            <span class="version-date">${formatDateTime(version.created_at)}</span>
            <span class="version-author">${SanitizationUtils.escapeHtml(version.created_by)}</span>
          </div>
          ${version.change_summary ? `
            <div class="version-summary">${SanitizationUtils.escapeHtml(version.change_summary)}</div>
          ` : ''}
          <div class="version-actions">
            <button class="btn-link restore-version-btn" data-version-id="${version.id}">
              Restore
            </button>
            <button class="btn-link compare-version-btn" data-version-id="${version.id}">
              Compare
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Setup version listeners
  const createBtn = document.getElementById('create-version-btn');
  if (createBtn) {
    createBtn.onclick = () => createVersion(proposalId);
  }

  document.querySelectorAll('.restore-version-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const versionId = parseInt((btn as HTMLElement).dataset.versionId || '0', 10);
      await restoreVersion(proposalId, versionId);
    });
  });

  document.querySelectorAll('.compare-version-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const versionId = parseInt((btn as HTMLElement).dataset.versionId || '0', 10);
      await showVersionComparison(proposalId, versionId);
    });
  });
}

async function createVersion(proposalId: number): Promise<void> {
  const summary = prompt('Enter a summary of changes (optional):');

  try {
    const response = await apiPost(`/api/proposals/${proposalId}/versions`, {
      change_summary: summary || null
    });

    if (response.ok) {
      alertSuccess('Version saved');
      await loadProposalVersions(proposalId);
    } else {
      alertError('Failed to create version');
    }
  } catch (error) {
    console.error('[AdminProposals] Error creating version:', error);
    alertError('Network error creating version');
  }
}

async function restoreVersion(proposalId: number, versionId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Restore Version',
    message: 'This will restore the proposal to this version. A backup of the current state will be saved. Continue?',
    confirmText: 'Restore',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/proposals/${proposalId}/versions/${versionId}/restore`, {});

    if (response.ok) {
      alertSuccess('Version restored');
      // Refresh the proposal details
      if (_storedContext) {
        await refreshProposals(_storedContext);
      }
    } else {
      alertError('Failed to restore version');
    }
  } catch (error) {
    console.error('[AdminProposals] Error restoring version:', error);
    alertError('Network error restoring version');
  }
}

async function showVersionComparison(proposalId: number, versionId: number): Promise<void> {
  try {
    const response = await apiPost('/api/proposals/versions/compare', {
      proposalId,
      versionId
    });

    if (response.ok) {
      const data = await response.json();
      const comparison = data.data;

      // Show comparison in a simple alert for now
      // In a full implementation, this would be a modal with side-by-side diff
      const changes = comparison.changes || [];
      if (changes.length === 0) {
        alertSuccess('No differences found between versions');
      } else {
        alert(`Changes:\n${changes.map((c: { field: string; from: string; to: string }) => `- ${c.field}: ${c.from} → ${c.to}`).join('\n')}`);
      }
    } else {
      alertError('Failed to compare versions');
    }
  } catch (error) {
    console.error('[AdminProposals] Error comparing versions:', error);
    alertError('Network error comparing versions');
  }
}

// ============================================================================
// SIGNATURE STATUS
// ============================================================================

async function loadSignatureStatus(proposalId: number): Promise<void> {
  const signatureContainer = document.getElementById('signature-status');
  if (!signatureContainer) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/signature-status`);
    if (response.ok) {
      const data = await response.json();
      renderSignatureStatus(proposalId, data.data);
    } else if (response.status === 404) {
      // No signature requested yet
      renderSignatureStatus(proposalId, null);
    } else {
      signatureContainer.innerHTML = '<div class="empty-row">Error loading signature status</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading signature status:', error);
    signatureContainer.innerHTML = '<div class="empty-row">Error loading signature status</div>';
  }
}

interface SignatureData {
  status: 'pending' | 'signed' | 'declined' | 'expired';
  requested_at: string;
  signed_at?: string;
  signer_name?: string;
  signer_email?: string;
  expires_at?: string;
}

function renderSignatureStatus(proposalId: number, signature: SignatureData | null): void {
  const signatureContainer = document.getElementById('signature-status');
  if (!signatureContainer) return;

  if (!signature) {
    signatureContainer.innerHTML = `
      <div class="signature-empty">
        <p>No signature requested</p>
        <button class="btn btn-primary btn-sm" id="request-signature-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          Request E-Signature
        </button>
      </div>
    `;
    const requestBtn = document.getElementById('request-signature-btn');
    if (requestBtn) {
      requestBtn.onclick = () => requestSignature(proposalId);
    }
    return;
  }

  const statusClass = {
    pending: 'status-pending',
    signed: 'status-success',
    declined: 'status-danger',
    expired: 'status-warning'
  }[signature.status] || 'status-pending';

  const statusLabel = {
    pending: 'Awaiting Signature',
    signed: 'Signed',
    declined: 'Declined',
    expired: 'Expired'
  }[signature.status] || signature.status;

  signatureContainer.innerHTML = `
    <div class="signature-info">
      <div class="signature-badge ${statusClass}">
        ${statusLabel}
      </div>
      <div class="signature-details">
        <p><strong>Requested:</strong> ${formatDateTime(signature.requested_at)}</p>
        ${signature.signed_at ? `<p><strong>Signed:</strong> ${formatDateTime(signature.signed_at)}</p>` : ''}
        ${signature.signer_name ? `<p><strong>Signer:</strong> ${SanitizationUtils.escapeHtml(signature.signer_name)}</p>` : ''}
        ${signature.expires_at ? `<p><strong>Expires:</strong> ${formatDateTime(signature.expires_at)}</p>` : ''}
      </div>
      ${signature.status === 'pending' ? `
        <div class="signature-actions">
          <button class="btn btn-secondary btn-sm" id="resend-signature-btn">Resend Request</button>
          <button class="btn btn-danger btn-sm" id="cancel-signature-btn">Cancel Request</button>
        </div>
      ` : ''}
      ${signature.status === 'expired' ? `
        <div class="signature-actions">
          <button class="btn btn-primary btn-sm" id="request-signature-btn">Request New Signature</button>
        </div>
      ` : ''}
    </div>
  `;

  // Setup signature action listeners
  const requestBtn = document.getElementById('request-signature-btn');
  if (requestBtn) {
    requestBtn.onclick = () => requestSignature(proposalId);
  }

  const resendBtn = document.getElementById('resend-signature-btn');
  if (resendBtn) {
    resendBtn.onclick = () => resendSignatureRequest(proposalId);
  }

  const cancelBtn = document.getElementById('cancel-signature-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => cancelSignatureRequest(proposalId);
  }
}

async function requestSignature(proposalId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/proposals/${proposalId}/request-signature`, {});

    if (response.ok) {
      alertSuccess('Signature request sent to client');
      await loadSignatureStatus(proposalId);
    } else {
      const error = await response.text();
      alertError(`Failed to request signature: ${error}`);
    }
  } catch (error) {
    console.error('[AdminProposals] Error requesting signature:', error);
    alertError('Network error requesting signature');
  }
}

async function resendSignatureRequest(proposalId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/proposals/${proposalId}/resend-signature`, {});

    if (response.ok) {
      alertSuccess('Signature request resent');
    } else {
      alertError('Failed to resend signature request');
    }
  } catch (error) {
    console.error('[AdminProposals] Error resending signature:', error);
    alertError('Network error resending signature');
  }
}

async function cancelSignatureRequest(proposalId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Cancel Signature Request',
    message: 'Are you sure you want to cancel the signature request?',
    confirmText: 'Cancel Request',
    cancelText: 'Keep Request',
    danger: true
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/proposals/${proposalId}/signature`);

    if (response.ok) {
      alertSuccess('Signature request cancelled');
      await loadSignatureStatus(proposalId);
    } else {
      alertError('Failed to cancel signature request');
    }
  } catch (error) {
    console.error('[AdminProposals] Error cancelling signature:', error);
    alertError('Network error cancelling signature');
  }
}

function updateStats(proposals: Proposal[]): void {
  const pending = proposals.filter(p => p.status === 'pending').length;
  const reviewed = proposals.filter(p => p.status === 'reviewed').length;
  const accepted = proposals.filter(p => p.status === 'accepted').length;
  const totalValue = proposals
    .filter(p => ['accepted', 'converted'].includes(p.status))
    .reduce((sum, p) => sum + p.finalPrice, 0);

  const statPending = document.getElementById('stat-pending');
  const statReviewed = document.getElementById('stat-reviewed');
  const statAccepted = document.getElementById('stat-accepted');
  const statTotal = document.getElementById('stat-total-value');

  if (statPending) statPending.textContent = pending.toString();
  if (statReviewed) statReviewed.textContent = reviewed.toString();
  if (statAccepted) statAccepted.textContent = accepted.toString();
  if (statTotal) statTotal.textContent = formatPrice(totalValue);
}

// ============================================================================
// PROPOSAL DETAILS
// ============================================================================

async function showProposalDetails(proposal: Proposal, ctx: AdminDashboardContext): Promise<void> {
  const detailsPanel = document.getElementById('proposal-details-panel');
  const detailsContent = document.getElementById('proposal-details-content');
  const tablePanel = document.querySelector('.proposals-panel') as HTMLElement;

  if (!detailsPanel || !detailsContent || !tablePanel) return;

  // Hide table, show details
  tablePanel.style.display = 'none';
  detailsPanel.style.display = 'block';

  // Render details
  detailsContent.innerHTML = renderProposalDetailsContent(proposal);

  // Setup event listeners for details panel
  setupDetailsEventListeners(proposal, ctx);

  // Load all proposal sections
  await Promise.all([
    loadProposalVersions(proposal.id),
    loadSignatureStatus(proposal.id),
    loadCustomItems(proposal.id),
    loadProposalComments(proposal.id),
    loadProposalActivities(proposal.id),
    loadDiscountSection(proposal)
  ]);
}

function hideProposalDetails(): void {
  const detailsPanel = document.getElementById('proposal-details-panel');
  const tablePanel = document.querySelector('.proposals-panel') as HTMLElement;

  if (detailsPanel) detailsPanel.style.display = 'none';
  if (tablePanel) tablePanel.style.display = 'block';
}

function renderProposalDetailsContent(proposal: Proposal): string {
  const tierLabel = proposal.selectedTier.charAt(0).toUpperCase() + proposal.selectedTier.slice(1);
  const formattedDate = formatDate(proposal.createdAt);

  const includedFeatures = proposal.features?.filter(f => f.isIncludedInTier) || [];
  const addonFeatures = proposal.features?.filter(f => f.isAddon) || [];

  return `
    <div class="proposal-details">
      <div class="details-section">
        <h4>Client Information</h4>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Name</span>
            <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.name))}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.email))}</span>
          </div>
          ${proposal.client.company ? `
            <div class="detail-item">
              <span class="detail-label">Company</span>
              <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.company))}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="details-section">
        <h4>Project Details</h4>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Project</span>
            <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.project.name))}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Type</span>
            <span class="detail-value">${formatProjectType(proposal.projectType)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Submitted</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
        </div>
      </div>

      <div class="details-section">
        <h4>Package Selection</h4>
        <div class="package-summary">
          <div class="package-tier">
            <span class="tier-badge tier-${proposal.selectedTier} large">${tierLabel} Package</span>
            <span class="package-price">${formatPrice(proposal.basePrice)}</span>
          </div>
          ${proposal.maintenanceOption && proposal.maintenanceOption !== 'diy' ? `
            <div class="maintenance-selection">
              <span class="maintenance-label">Maintenance Plan:</span>
              <span class="maintenance-value">${formatMaintenanceOption(proposal.maintenanceOption)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${includedFeatures.length > 0 ? `
        <div class="details-section">
          <h4>Included Features</h4>
          <ul class="features-list">
            ${includedFeatures.map(f => `
              <li class="feature-item feature-included">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
                <span>${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(f.featureName))}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      ${addonFeatures.length > 0 ? `
        <div class="details-section">
          <h4>Add-ons Selected</h4>
          <ul class="features-list">
            ${addonFeatures.map(f => `
              <li class="feature-item feature-addon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                <span>${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(f.featureName))}</span>
                <span class="addon-price">+${formatPrice(f.featurePrice)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="details-section">
        <h4>Pricing</h4>
        <div class="pricing-summary">
          <div class="price-row">
            <span>Base Package</span>
            <span>${formatPrice(proposal.basePrice)}</span>
          </div>
          ${addonFeatures.length > 0 ? `
            <div class="price-row">
              <span>Add-ons</span>
              <span>+${formatPrice(proposal.finalPrice - proposal.basePrice)}</span>
            </div>
          ` : ''}
          <div class="price-row total">
            <span>Total</span>
            <span>${formatPrice(proposal.finalPrice)}</span>
          </div>
        </div>
      </div>

      ${proposal.clientNotes ? `
        <div class="details-section">
          <h4>Client Notes</h4>
          <div class="notes-content">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.clientNotes))}</div>
        </div>
      ` : ''}

      <div class="details-section">
        <h4>Admin Notes</h4>
        <textarea class="admin-notes-input" id="admin-notes-input" placeholder="Add internal notes about this proposal...">${proposal.adminNotes || ''}</textarea>
        <button class="btn btn-secondary" id="save-notes-btn">Save Notes</button>
      </div>

      <div class="details-section">
        <h4>Custom Line Items</h4>
        <div class="custom-items-section" id="custom-items-section">
          <div class="loading-row">Loading custom items...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Discount</h4>
        <div class="discount-section" id="discount-section">
          <div class="loading-row">Loading discount info...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Comments</h4>
        <div class="comments-section" id="comments-section">
          <div class="loading-row">Loading comments...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Activity Log</h4>
        <div class="activity-section" id="activity-section">
          <div class="loading-row">Loading activity...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Version History</h4>
        <div class="version-history" id="version-history">
          <div class="loading-row">Loading versions...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Signature Status</h4>
        <div class="signature-status" id="signature-status">
          <div class="loading-row">Loading signature status...</div>
        </div>
      </div>

      <div class="details-actions">
        ${proposal.status === 'pending' ? `
          <button class="btn btn-success" id="accept-proposal-btn">Accept Proposal</button>
          <button class="btn btn-danger" id="reject-proposal-btn">Reject Proposal</button>
        ` : ''}
        ${proposal.status === 'accepted' ? `
          <button class="btn btn-primary" id="convert-proposal-btn">Convert to Invoice</button>
        ` : ''}
      </div>
    </div>
  `;
}

function setupDetailsEventListeners(proposal: Proposal, ctx: AdminDashboardContext): void {
  // Save notes button
  const saveNotesBtn = document.getElementById('save-notes-btn');
  if (saveNotesBtn) {
    saveNotesBtn.onclick = async () => {
      const notesInput = document.getElementById('admin-notes-input') as HTMLTextAreaElement;
      if (notesInput) {
        await updateProposalNotes(proposal.id, notesInput.value, ctx);
      }
    };
  }

  // Accept button
  const acceptBtn = document.getElementById('accept-proposal-btn');
  if (acceptBtn) {
    acceptBtn.onclick = async () => {
      await updateProposalStatus(proposal.id, 'accepted', ctx);
      hideProposalDetails();
    };
  }

  // Reject button
  const rejectBtn = document.getElementById('reject-proposal-btn');
  if (rejectBtn) {
    rejectBtn.onclick = async () => {
      const confirmed = await confirmDialog({
        title: 'Reject Proposal',
        message: 'Are you sure you want to reject this proposal?',
        confirmText: 'Reject',
        cancelText: 'Cancel',
        danger: true
      });
      if (confirmed) {
        await updateProposalStatus(proposal.id, 'rejected', ctx);
        hideProposalDetails();
      }
    };
  }

  // Convert button
  const convertBtn = document.getElementById('convert-proposal-btn');
  if (convertBtn) {
    convertBtn.onclick = async () => {
      await convertToInvoice(proposal.id, ctx);
    };
  }
}

// ============================================================================
// API ACTIONS
// ============================================================================

async function updateProposalStatus(
  proposalId: number,
  status: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/proposals/admin/${proposalId}`, { status });

    if (response.ok) {
      await refreshProposals(ctx);
      ctx.showNotification?.(`Proposal status updated to ${status}`, 'success');
    } else {
      const error = await response.text();
      console.error('[AdminProposals] Failed to update status:', error);
      ctx.showNotification?.('Failed to update proposal status', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error updating status:', error);
    ctx.showNotification?.('Network error updating proposal', 'error');
  }
}

async function updateProposalNotes(
  proposalId: number,
  notes: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/proposals/admin/${proposalId}`, { adminNotes: notes });

    if (response.ok) {
      ctx.showNotification?.('Notes saved successfully', 'success');
      // Refresh proposals to show updated notes in the details panel
      await refreshProposals(ctx);
    } else {
      ctx.showNotification?.('Failed to save notes', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error saving notes:', error);
    ctx.showNotification?.('Network error saving notes', 'error');
  }
}

async function convertToInvoice(proposalId: number, ctx: AdminDashboardContext): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Convert to Invoice',
    message: 'This will create a draft invoice based on this proposal. Continue?',
    confirmText: 'Create Invoice',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/proposals/admin/${proposalId}/convert`, {});

    if (response.ok) {
      const data = await response.json();
      await refreshProposals(ctx);
      hideProposalDetails();
      ctx.showNotification?.(`Invoice ${data.data.invoiceNumber} created`, 'success');
    } else {
      const error = await response.text();
      console.error('[AdminProposals] Failed to convert:', error);
      ctx.showNotification?.('Failed to create invoice', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error converting:', error);
    ctx.showNotification?.('Network error creating invoice', 'error');
  }
}

// ============================================================================
// CUSTOM LINE ITEMS
// ============================================================================

async function loadCustomItems(proposalId: number): Promise<void> {
  const container = document.getElementById('custom-items-section');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/custom-items`);
    if (response.ok) {
      const data = await response.json();
      renderCustomItems(proposalId, data.data || []);
    } else {
      container.innerHTML = '<div class="empty-state-small">No custom items</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading custom items:', error);
    container.innerHTML = '<div class="empty-state-small">Error loading items</div>';
  }
}

function renderCustomItems(proposalId: number, items: ProposalCustomItem[]): void {
  const container = document.getElementById('custom-items-section');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">No custom line items</div>
      <button class="btn btn-secondary btn-sm" id="add-custom-item-btn">Add Line Item</button>
    `;
    const addBtn = document.getElementById('add-custom-item-btn');
    if (addBtn) addBtn.onclick = () => showAddCustomItemDialog(proposalId);
    return;
  }

  const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  container.innerHTML = `
    <div class="custom-items-list">
      ${items.map(item => `
        <div class="custom-item-row" data-item-id="${item.id}">
          <div class="item-info">
            <span class="item-type-badge">${item.item_type}</span>
            <span class="item-description">${SanitizationUtils.escapeHtml(item.description)}</span>
          </div>
          <div class="item-pricing">
            <span>${item.quantity} × ${formatPrice(item.unit_price)}</span>
            <span class="item-total">${formatPrice(item.quantity * item.unit_price)}</span>
          </div>
          <button class="icon-btn icon-btn-danger delete-item-btn" data-item-id="${item.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `).join('')}
    </div>
    <div class="custom-items-footer">
      <span class="items-total">Custom Items Total: ${formatPrice(total)}</span>
      <button class="btn btn-secondary btn-sm" id="add-custom-item-btn">Add Item</button>
    </div>
  `;

  // Setup event listeners
  const addBtn = document.getElementById('add-custom-item-btn');
  if (addBtn) addBtn.onclick = () => showAddCustomItemDialog(proposalId);

  container.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = parseInt((btn as HTMLElement).dataset.itemId || '0');
      await deleteCustomItem(itemId, proposalId);
    });
  });
}

async function showAddCustomItemDialog(proposalId: number): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Add Custom Line Item',
    fields: [
      { name: 'description', label: 'Description', type: 'text', required: true },
      { name: 'item_type', label: 'Type', type: 'select', options: [
        { value: 'service', label: 'Service' },
        { value: 'product', label: 'Product' },
        { value: 'fee', label: 'Fee' },
        { value: 'discount', label: 'Discount' },
        { value: 'hourly', label: 'Hourly Rate' }
      ], required: true },
      { name: 'quantity', label: 'Quantity', type: 'text', required: true },
      { name: 'unit_price', label: 'Unit Price ($)', type: 'text', required: true }
    ],
    confirmText: 'Add Item',
    cancelText: 'Cancel'
  });

  if (result) {
    try {
      const response = await apiPost(`/api/proposals/${proposalId}/custom-items`, {
        description: result.description,
        itemType: result.item_type,
        quantity: parseFloat(result.quantity) || 1,
        unitPrice: parseFloat(result.unit_price) || 0
      });

      if (response.ok) {
        showToast('Item added', 'success');
        await loadCustomItems(proposalId);
      } else {
        showToast('Failed to add item', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error adding custom item:', error);
      showToast('Error adding item', 'error');
    }
  }
}

async function deleteCustomItem(itemId: number, proposalId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Item',
    message: 'Are you sure you want to delete this line item?',
    confirmText: 'Delete',
    danger: true
  });

  if (confirmed) {
    try {
      const response = await apiDelete(`/api/proposals/custom-items/${itemId}`);
      if (response.ok) {
        showToast('Item deleted', 'success');
        await loadCustomItems(proposalId);
      } else {
        showToast('Failed to delete item', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error deleting custom item:', error);
      showToast('Error deleting item', 'error');
    }
  }
}

// ============================================================================
// DISCOUNTS
// ============================================================================

function loadDiscountSection(proposal: Proposal): void {
  const container = document.getElementById('discount-section');
  if (!container) return;

  // Check if proposal has discount info (would need to be added to Proposal interface)
  const hasDiscount = false; // placeholder - check proposal.discount_type

  if (!hasDiscount) {
    container.innerHTML = `
      <div class="discount-empty">
        <span>No discount applied</span>
        <button class="btn btn-secondary btn-sm" id="apply-discount-btn">Apply Discount</button>
      </div>
    `;
    const applyBtn = document.getElementById('apply-discount-btn');
    if (applyBtn) applyBtn.onclick = () => showApplyDiscountDialog(proposal.id);
    return;
  }

  // If discount exists, show it with remove option
  container.innerHTML = `
    <div class="discount-info">
      <span class="discount-badge">Discount Applied</span>
      <button class="btn btn-danger btn-sm" id="remove-discount-btn">Remove</button>
    </div>
  `;

  const removeBtn = document.getElementById('remove-discount-btn');
  if (removeBtn) removeBtn.onclick = () => removeDiscount(proposal.id);
}

async function showApplyDiscountDialog(proposalId: number): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Apply Discount',
    fields: [
      { name: 'type', label: 'Discount Type', type: 'select', options: [
        { value: 'percentage', label: 'Percentage' },
        { value: 'fixed', label: 'Fixed Amount' }
      ], required: true },
      { name: 'value', label: 'Value (% or $)', type: 'text', required: true },
      { name: 'reason', label: 'Reason', type: 'text' }
    ],
    confirmText: 'Apply',
    cancelText: 'Cancel'
  });

  if (result) {
    try {
      const response = await apiPost(`/api/proposals/${proposalId}/discount`, {
        type: result.type,
        value: parseFloat(result.value) || 0,
        reason: result.reason || null
      });

      if (response.ok) {
        showToast('Discount applied', 'success');
        if (_storedContext) await refreshProposals(_storedContext);
      } else {
        showToast('Failed to apply discount', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error applying discount:', error);
      showToast('Error applying discount', 'error');
    }
  }
}

async function removeDiscount(proposalId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Remove Discount',
    message: 'Are you sure you want to remove the discount?',
    confirmText: 'Remove',
    danger: true
  });

  if (confirmed) {
    try {
      const response = await apiDelete(`/api/proposals/${proposalId}/discount`);
      if (response.ok) {
        showToast('Discount removed', 'success');
        if (_storedContext) await refreshProposals(_storedContext);
      } else {
        showToast('Failed to remove discount', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error removing discount:', error);
      showToast('Error removing discount', 'error');
    }
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

async function loadProposalComments(proposalId: number): Promise<void> {
  const container = document.getElementById('comments-section');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/comments`);
    if (response.ok) {
      const data = await response.json();
      renderComments(proposalId, data.data || []);
    } else {
      container.innerHTML = '<div class="empty-state-small">No comments</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading comments:', error);
    container.innerHTML = '<div class="empty-state-small">Error loading comments</div>';
  }
}

function renderComments(proposalId: number, comments: ProposalComment[]): void {
  const container = document.getElementById('comments-section');
  if (!container) return;

  container.innerHTML = `
    ${comments.length > 0 ? `
      <div class="comments-list">
        ${comments.map(comment => `
          <div class="comment-item ${comment.is_internal ? 'comment-internal' : ''}">
            <div class="comment-header">
              <span class="comment-author">${SanitizationUtils.escapeHtml(comment.author_name)}</span>
              <span class="comment-type">${comment.author_type}</span>
              ${comment.is_internal ? '<span class="comment-internal-badge">Internal</span>' : ''}
              <span class="comment-date">${formatDateTime(comment.created_at)}</span>
            </div>
            <div class="comment-content">${SanitizationUtils.escapeHtml(comment.content)}</div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-state-small">No comments yet</div>'}
    <div class="add-comment-form">
      <textarea id="new-comment-input" placeholder="Add a comment..." rows="2"></textarea>
      <div class="comment-actions">
        <label class="checkbox-label">
          <input type="checkbox" id="comment-internal-checkbox">
          <span>Internal only</span>
        </label>
        <button class="btn btn-secondary btn-sm" id="add-comment-btn">Add Comment</button>
      </div>
    </div>
  `;

  const addBtn = document.getElementById('add-comment-btn');
  if (addBtn) {
    addBtn.onclick = () => addComment(proposalId);
  }
}

async function addComment(proposalId: number): Promise<void> {
  const input = document.getElementById('new-comment-input') as HTMLTextAreaElement;
  const internalCheckbox = document.getElementById('comment-internal-checkbox') as HTMLInputElement;

  const content = input?.value.trim();
  if (!content) {
    showToast('Please enter a comment', 'error');
    return;
  }

  try {
    const response = await apiPost(`/api/proposals/${proposalId}/comments`, {
      content,
      authorType: 'admin',
      authorName: 'Admin',
      isInternal: internalCheckbox?.checked || false
    });

    if (response.ok) {
      showToast('Comment added', 'success');
      await loadProposalComments(proposalId);
    } else {
      showToast('Failed to add comment', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error adding comment:', error);
    showToast('Error adding comment', 'error');
  }
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

async function loadProposalActivities(proposalId: number): Promise<void> {
  const container = document.getElementById('activity-section');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/activities`);
    if (response.ok) {
      const data = await response.json();
      renderActivities(data.data || []);
    } else {
      container.innerHTML = '<div class="empty-state-small">No activity</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading activities:', error);
    container.innerHTML = '<div class="empty-state-small">Error loading activity</div>';
  }
}

function renderActivities(activities: ProposalActivity[]): void {
  const container = document.getElementById('activity-section');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = '<div class="empty-state-small">No activity recorded</div>';
    return;
  }

  const activityLabels: Record<string, string> = {
    viewed: 'Viewed',
    downloaded: 'PDF Downloaded',
    commented: 'Comment Added',
    signed: 'Signed',
    status_changed: 'Status Changed',
    version_created: 'Version Created',
    version_restored: 'Version Restored',
    sent: 'Sent to Client',
    reminder_sent: 'Reminder Sent',
    signature_requested: 'Signature Requested',
    signature_declined: 'Signature Declined',
    discount_applied: 'Discount Applied',
    discount_removed: 'Discount Removed'
  };

  container.innerHTML = `
    <div class="activity-list">
      ${activities.slice(0, 10).map(activity => `
        <div class="activity-item">
          <span class="activity-type">${activityLabels[activity.activity_type] || activity.activity_type}</span>
          ${activity.actor ? `<span class="activity-actor">by ${SanitizationUtils.escapeHtml(activity.actor)}</span>` : ''}
          <span class="activity-date">${formatDateTime(activity.created_at)}</span>
        </div>
      `).join('')}
    </div>
    ${activities.length > 10 ? `<div class="activity-more">${activities.length - 10} more activities...</div>` : ''}
  `;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// NOTE: formatProjectType moved to shared format-utils.ts

function formatMaintenanceOption(option: string | null): string {
  if (!option) return 'None';
  const labels: Record<string, string> = {
    'diy': 'DIY (Self-managed)',
    'essential': 'Essential Care ($99/mo)',
    'standard': 'Standard Care ($249/mo)',
    'premium': 'Premium Care ($499/mo)'
  };
  return labels[option] || option;
}

export default {
  loadProposals,
  getProposalsData,
  setProposalsContext
};
