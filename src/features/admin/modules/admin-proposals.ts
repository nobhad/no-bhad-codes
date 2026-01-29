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
import { formatDate } from '../../../utils/format-utils';
import { apiFetch, apiPut, apiPost } from '../../../utils/api-client';
import { createTableDropdown } from '../../../utils/table-dropdown';
import type { AdminDashboardContext } from '../admin-types';
import { confirmDialog } from '../../../utils/confirm-dialog';

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
    <div class="proposals-panel">
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

function showProposalDetails(proposal: Proposal, ctx: AdminDashboardContext): void {
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

function formatProjectType(type: string): string {
  const typeLabels: Record<string, string> = {
    'simple-site': 'Simple Site',
    'business-site': 'Business Website',
    'portfolio': 'Portfolio',
    'e-commerce': 'E-Commerce',
    'ecommerce': 'E-Commerce', // Legacy support
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    'other': 'Custom Project'
  };
  return typeLabels[type] || type;
}

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
