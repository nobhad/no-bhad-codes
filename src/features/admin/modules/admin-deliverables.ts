/**
 * ============================================
 * DELIVERABLES MODULE (ADMIN)
 * ============================================
 * Main admin interface for deliverable management,
 * design review, and client collaboration
 */

import { createPortalModal, type PortalModalInstance } from '../../../components/portal-modal';
import { createModalDropdown } from '../../../components/modal-dropdown';
import { openDesignReview } from './admin-design-review';
import { showToast } from '../../../utils/toast-notifications';

// Simple DOM helper
function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

interface Deliverable {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: 'pending' | 'reviewing' | 'approved' | 'revisions_requested';
  roundNumber: number;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '/api/v1/deliverables';
let deliverablesModal: PortalModalInstance | null = null;
let currentProjectId: number | null = null;
let deliverables: Deliverable[] = [];

/**
 * Initialize deliverables module
 */
export function initializeDeliverablesModule(): void {
  // Add event listeners for deliverables actions if modal exists
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-action="open-deliverables"]')) {
      const projectId = parseInt(target.dataset.projectId || '0');
      if (projectId) {
        openDeliverablesManager(projectId);
      }
    }
  });
}

/**
 * Open deliverables manager for a project
 */
export async function openDeliverablesManager(projectId: number): Promise<void> {
  currentProjectId = projectId;

  if (!deliverablesModal) {
    createDeliverablesModal();
  }

  // Load deliverables
  await loadDeliverables(projectId);
  deliverablesModal?.show();
}

/**
 * Create deliverables modal shell
 */
function createDeliverablesModal(): void {
  deliverablesModal = createPortalModal({
    id: 'deliverables-manager-modal',
    titleId: 'deliverables-modal-title',
    title: 'Deliverables & Design Review',
    contentClassName: 'deliverables-modal-content modal-content-wide',
    onClose: () => deliverablesModal?.hide()
  });

  // Setup modal content
  deliverablesModal.body.innerHTML = `
    <div class="deliverables-container">
      <!-- Toolbar -->
      <div class="deliverables-toolbar">
        <div class="toolbar-left">
          <input
            type="search"
            id="deliverables-search"
            placeholder="Search deliverables..."
            class="portal-input"
            style="width: 250px;"
          />
        </div>
        <div class="toolbar-right">
          <select id="deliverables-filter" class="portal-input">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="approved">Approved</option>
            <option value="revisions_requested">Revisions Requested</option>
          </select>
          <button id="deliverables-upload-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload
          </button>
        </div>
      </div>

      <!-- Deliverables list -->
      <div class="deliverables-list-wrapper">
        <div id="deliverables-list" class="deliverables-list">
          <div class="loading-message">Loading deliverables...</div>
        </div>
      </div>

      <!-- Empty state -->
      <div id="deliverables-empty" class="empty-message" style="display: none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        <p>No deliverables yet</p>
        <button id="deliverables-empty-upload" class="btn btn-primary btn-sm">
          Upload First Deliverable
        </button>
      </div>
    </div>
  `;

  // Setup event listeners
  setupDeliverablesEvents();

  // Setup footer
  deliverablesModal.footer.innerHTML = `
    <button type="button" class="btn btn-secondary" id="deliverables-close-btn">Close</button>
  `;

  el('deliverables-close-btn')?.addEventListener('click', () => deliverablesModal?.hide());
}

/**
 * Setup deliverables event listeners
 */
function setupDeliverablesEvents(): void {
  // Search
  el('deliverables-search')?.addEventListener('input', (e: Event) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    filterDeliverables(query, undefined);
  });

  // Filter
  el('deliverables-filter')?.addEventListener('change', (e: Event) => {
    const status = (e.target as HTMLSelectElement).value;
    filterDeliverables('', status || undefined);
  });

  // Upload button
  el('deliverables-upload-btn')?.addEventListener('click', () => openUploadModal());
  el('deliverables-empty-upload')?.addEventListener('click', () => openUploadModal());
}

/**
 * Load deliverables from API
 */
async function loadDeliverables(projectId: number): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/projects/${projectId}/list`);
    if (!res.ok) throw new Error('Failed to load deliverables');

    const { deliverables: data } = await res.json();
    deliverables = data || [];

    renderDeliverables(deliverables);
  } catch (error) {
    showToast('Failed to load deliverables', 'error');
    console.error(error);
  }
}

/**
 * Render deliverables list
 */
function renderDeliverables(items: Deliverable[]): void {
  const listEl = el('deliverables-list');
  const emptyEl = el('deliverables-empty');

  if (!items.length) {
    if (listEl) listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }

  if (listEl) listEl.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  if (!listEl) return;

  listEl.innerHTML = items
    .map(
      (d) =>
        `
    <div class="deliverable-item" data-id="${d.id}">
      <div class="deliverable-header">
        <div class="deliverable-info">
          <h4 class="deliverable-title">${d.title}</h4>
          <p class="deliverable-description">${d.description || ''}</p>
        </div>
        <div class="deliverable-meta">
          <span class="round-badge">Round ${d.roundNumber}</span>
          <span class="status-badge status-${d.status}">${getStatusLabel(d.status)}</span>
        </div>
      </div>
      <div class="deliverable-actions">
        <button class="icon-btn deliverable-review" data-id="${d.id}" title="Open Design Review">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="icon-btn deliverable-versions" data-id="${d.id}" title="View Versions">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/><polyline points="12 12 20 7.5"/><polyline points="12 12 12 21"/><polyline points="12 12 4 7.5"/></svg>
        </button>
        <button class="icon-btn deliverable-comments" data-id="${d.id}" title="Comments">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>
    </div>
  `
    )
    .join('');

  // Setup action listeners
  document.querySelectorAll('.deliverable-review').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.id || '0');
      if (id) openDesignReview(id);
    });
  });

  document.querySelectorAll('.deliverable-versions').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.id || '0');
      if (id) showVersionHistory(id);
    });
  });

  document.querySelectorAll('.deliverable-comments').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.id || '0');
      if (id) showComments(id);
    });
  });
}

/**
 * Filter deliverables
 */
function filterDeliverables(searchQuery: string, status?: string): void {
  let filtered = deliverables;

  if (searchQuery) {
    filtered = filtered.filter(
      (d) =>
        d.title.toLowerCase().includes(searchQuery) ||
        d.description.toLowerCase().includes(searchQuery)
    );
  }

  if (status) {
    filtered = filtered.filter((d) => d.status === status);
  }

  renderDeliverables(filtered);
}

/**
 * Open upload modal
 */
function openUploadModal(): void {
  if (!currentProjectId) return;

  const modal = createPortalModal({
    id: 'deliverable-upload-modal',
    titleId: 'deliverable-upload-modal-title',
    title: 'Upload Deliverable',
    contentClassName: 'deliverable-upload-modal-content',
    onClose: () => modal.hide()
  });

  modal.body.innerHTML = `
    <form id="deliverable-upload-form" class="modal-form">
      <div class="form-group">
        <label for="upload-title">Title *</label>
        <input type="text" id="upload-title" class="form-input" required placeholder="e.g., Homepage Design" />
      </div>

      <div class="form-group">
        <label for="upload-description">Description</label>
        <textarea id="upload-description" class="form-input" placeholder="Add notes about this deliverable..."></textarea>
      </div>

      <div class="form-group">
        <label for="upload-round">Design Round</label>
        <div id="upload-round-mount"></div>
      </div>

      <div class="form-group">
        <label for="upload-file">File *</label>
        <div class="file-upload-area">
          <input type="file" id="upload-file" accept="image/*,application/pdf" required />
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Click to upload or drag and drop</p>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Upload Deliverable</button>
        <button type="button" class="btn btn-secondary" id="upload-cancel-btn">Cancel</button>
      </div>
    </form>
  `;

  // Create design round dropdown
  const roundMount = el('upload-round-mount');
  if (roundMount) {
    const roundDropdown = createModalDropdown({
      options: [
        { value: '1', label: 'Round 1' },
        { value: '2', label: 'Round 2' },
        { value: '3', label: 'Final Round' }
      ],
      currentValue: '1',
      ariaLabelPrefix: 'Design round'
    });
    roundDropdown.id = 'upload-round';
    roundMount.appendChild(roundDropdown);
  }

  el('upload-cancel-btn')?.addEventListener('click', () => modal.hide());

  el('deliverable-upload-form')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    // Handle file upload
    showToast('Upload functionality requires file handling integration', 'info');
    modal.hide();
  });

  modal.footer.innerHTML = '';
  modal.show();
}

/**
 * Show version history for a deliverable
 */
function showVersionHistory(_deliverableId: number): void {
  showToast('Version history view coming soon', 'info');
}

/**
 * Show comments for a deliverable
 */
function showComments(_deliverableId: number): void {
  showToast('Comments view coming soon', 'info');
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    reviewing: 'Under Review',
    approved: 'Approved',
    revisions_requested: 'Revisions Needed'
  };
  return labels[status] || status;
}
