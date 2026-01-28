/**
 * ===============================================
 * ADMIN PROJECTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-projects.ts
 *
 * Project management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatFileSize, formatDisplayValue, formatTextWithLineBreaks } from '../../../utils/format-utils';
import { initModalDropdown, setModalDropdownValue } from '../../../utils/modal-dropdown';
import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  PROJECTS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import type { ProjectMilestone, ProjectFile, ProjectInvoice, AdminDashboardContext, Message } from '../admin-types';
import { showTableLoading } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { createDOMCache, batchUpdateText } from '../../../utils/dom-cache';
import { alertWarning, multiPromptDialog } from '../../../utils/confirm-dialog';

// ============================================
// DOM CACHE - Cached element references
// ============================================

/** DOM element selector keys for the projects module */
type ProjectsDOMKeys = {
  // Table elements
  tableBody: string;
  filterContainer: string;
  // Stats
  projectsTotal: string;
  projectsActive: string;
  projectsCompleted: string;
  projectsOnHold: string;
  // Project detail elements
  detailTitle: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  company: string;
  status: string;
  projectType: string;
  budget: string;
  price: string;
  timeline: string;
  startDate: string;
  previewUrlLink: string;
  description: string;
  notes: string;
  progressPercent: string;
  progressBar: string;
  // Buttons
  backBtn: string;
  editProjectBtn: string;
  createInvoiceBtn: string;
  addMilestoneBtn: string;
  sendMsgBtn: string;
  addProjectBtn: string;
  // Containers
  messagesThread: string;
  messageInput: string;
  filesList: string;
  milestonesList: string;
  invoicesList: string;
  uploadDropzone: string;
  fileInput: string;
  browseFilesBtn: string;
  // Edit modal
  editModal: string;
  editForm: string;
  editClose: string;
  editCancel: string;
  // Add project modal
  addProjectModal: string;
  addProjectForm: string;
  addProjectClose: string;
  addProjectCancel: string;
};

/** Cached DOM element references for performance */
const domCache = createDOMCache<ProjectsDOMKeys>();

// Register all element selectors (called once when module loads)
domCache.register({
  // Table elements
  tableBody: '#projects-table-body',
  filterContainer: '#projects-filter-container',
  // Stats
  projectsTotal: '#projects-total',
  projectsActive: '#projects-active',
  projectsCompleted: '#projects-completed',
  projectsOnHold: '#projects-on-hold',
  // Project detail elements
  detailTitle: '#project-detail-title',
  projectName: '#pd-project-name',
  clientName: '#pd-client-name',
  clientEmail: '#pd-client-email',
  company: '#pd-company',
  status: '#pd-status',
  projectType: '#pd-type',
  budget: '#pd-budget',
  price: '#pd-price',
  timeline: '#pd-timeline',
  startDate: '#pd-start-date',
  previewUrlLink: '#pd-preview-url-link',
  description: '#pd-description',
  notes: '#pd-notes',
  progressPercent: '#pd-progress-percent',
  progressBar: '#pd-progress-bar',
  // Buttons
  backBtn: '#btn-back-to-projects',
  editProjectBtn: '#btn-edit-project',
  createInvoiceBtn: '#btn-create-invoice',
  addMilestoneBtn: '#btn-add-milestone',
  sendMsgBtn: '#btn-pd-send-message',
  addProjectBtn: '#add-project-btn',
  // Containers
  messagesThread: '#pd-messages-thread',
  messageInput: '#pd-message-input',
  filesList: '#pd-files-list',
  milestonesList: '#pd-milestones-list',
  invoicesList: '#pd-invoices-list',
  uploadDropzone: '#pd-upload-dropzone',
  fileInput: '#pd-file-input',
  browseFilesBtn: '#btn-pd-browse-files',
  // Edit modal
  editModal: '#edit-project-modal',
  editForm: '#edit-project-form',
  editClose: '#edit-project-close',
  editCancel: '#edit-project-cancel',
  // Add project modal
  addProjectModal: '#add-project-modal',
  addProjectForm: '#add-project-form',
  addProjectClose: '#add-project-modal-close',
  addProjectCancel: '#add-project-cancel'
});

/** Lead/Project data from admin leads API */
interface LeadProject {
  id: number;
  project_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  project_type?: string;
  budget_range?: string;
  timeline?: string;
  status: 'pending' | 'active' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  description?: string;
  features?: string;
  progress?: number;
  created_at?: string;
  start_date?: string;
  end_date?: string;
  // Computed fields from API stats
  file_count?: number;
  message_count?: number;
  unread_count?: number;
}

interface ProjectsData {
  leads: LeadProject[];
  stats: {
    total: number;
    active: number;
    completed: number;
    on_hold: number;
  };
}

let projectsData: LeadProject[] = [];
let currentProjectId: number | null = null;
let storedContext: AdminDashboardContext | null = null;
let filterState: FilterState = loadFilterState(PROJECTS_FILTER_CONFIG.storageKey);
let filterUIInitialized = false;

/**
 * Format date string for display (YYYY-MM-DD -> MM/DD/YYYY)
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';

  // Parse date string without timezone issues
  // Handle ISO date strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
    }
  }

  // Fallback: try standard parsing (may have timezone issues)
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export function getProjectsData(): LeadProject[] {
  return projectsData;
}

export function getCurrentProjectId(): number | null {
  return currentProjectId;
}

export function setCurrentProjectId(id: number | null): void {
  currentProjectId = id;
}

export async function loadProjects(ctx: AdminDashboardContext): Promise<void> {
  storedContext = ctx;

  // Initialize filter UI once
  if (!filterUIInitialized) {
    initializeFilterUI(ctx);
    filterUIInitialized = true;
  }

  // Show loading state (use cached ref)
  const tableBody = domCache.get('tableBody');
  if (tableBody) {
    showTableLoading(tableBody, 6, 'Loading projects...');
  }

  try {
    const response = await apiFetch('/api/admin/leads');

    if (response.ok) {
      const data: ProjectsData = await response.json();
      projectsData = data.leads || [];
      updateProjectsDisplay(data, ctx);
    } else {
      console.error('[AdminProjects] API error:', response.status);
      if (tableBody) {
        showTableError(
          tableBody,
          6,
          `Error loading projects (${response.status})`,
          () => loadProjects(ctx)
        );
      }
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load projects:', error);
    if (tableBody) {
      showTableError(
        tableBody,
        6,
        'Network error loading projects',
        () => loadProjects(ctx)
      );
    }
  }
}

/**
 * Initialize filter UI for projects table
 */
function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = domCache.get('filterContainer');
  if (!container) return;

  // Create filter UI
  const filterUI = createFilterUI(
    PROJECTS_FILTER_CONFIG,
    filterState,
    (newState) => {
      filterState = newState;
      // Re-render table with new filters
      if (projectsData.length > 0) {
        const projects = projectsData.filter(
          (p) => normalizeStatus(p.status) !== 'pending' || p.project_name
        );
        renderProjectsTable(projects, ctx);
      }
    }
  );

  // Insert before the refresh button
  const refreshBtn = container.querySelector('#refresh-projects-btn');
  if (refreshBtn) {
    container.insertBefore(filterUI, refreshBtn);
  } else {
    container.appendChild(filterUI);
  }

  // Setup sortable headers after table is rendered
  setTimeout(() => {
    createSortableHeaders(PROJECTS_FILTER_CONFIG, filterState, (column, direction) => {
      filterState = { ...filterState, sortColumn: column, sortDirection: direction };
      saveFilterState(PROJECTS_FILTER_CONFIG.storageKey, filterState);
      if (projectsData.length > 0) {
        const projects = projectsData.filter(
          (p) => normalizeStatus(p.status) !== 'pending' || p.project_name
        );
        renderProjectsTable(projects, ctx);
      }
    });
  }, 100);
}

function updateProjectsDisplay(data: ProjectsData, ctx: AdminDashboardContext): void {
  const projects = (data.leads || []).filter(
    (p) => normalizeStatus(p.status) !== 'pending' || p.project_name
  );

  // Calculate stats
  const activeCount = projects.filter(
    (p) => normalizeStatus(p.status) === 'active' || normalizeStatus(p.status) === 'in_progress'
  ).length;
  const completedCount = projects.filter((p) => normalizeStatus(p.status) === 'completed').length;
  const onHoldCount = projects.filter((p) => normalizeStatus(p.status) === 'on_hold').length;

  // Update stats using batch update
  batchUpdateText({
    'projects-total': projects.length.toString(),
    'projects-active': activeCount.toString(),
    'projects-completed': completedCount.toString(),
    'projects-on-hold': onHoldCount.toString()
  });

  renderProjectsTable(projects, ctx);

  // Setup add project button handler
  setupAddProjectButton(ctx);
}

function renderProjectsTable(projects: LeadProject[], ctx: AdminDashboardContext): void {
  const tableBody = domCache.get('tableBody');
  if (!tableBody) return;

  if (projects.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="8" class="loading-row">No projects yet. Convert leads to start projects.</td></tr>';
    return;
  }

  // Apply filters
  const filteredProjects = applyFilters(projects, filterState, PROJECTS_FILTER_CONFIG);

  if (filteredProjects.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="loading-row">No projects match the current filters</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredProjects
    .map((project) => {
      // Decode HTML entities first (data may have &amp; stored), then escape for safe HTML output
      const safeName = SanitizationUtils.escapeHtml(
        SanitizationUtils.decodeHtmlEntities(project.project_name || project.description?.substring(0, 30) || 'Untitled Project')
      );
      const safeContact = SanitizationUtils.escapeHtml(
        SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(project.contact_name || '-'))
      );
      const safeCompany = project.company_name
        ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(project.company_name)))
        : '';
      // Normalize status to underscore format for CSS class consistency
      const status = normalizeStatus(project.status);

      const statusLabels: Record<string, string> = {
        pending: 'Pending',
        active: 'Active',
        in_progress: 'In Progress',
        on_hold: 'On Hold',
        completed: 'Completed',
        cancelled: 'Cancelled'
      };

      return `
        <tr data-project-id="${project.id}" class="clickable-row">
          <td>${safeName}</td>
          <td>${safeContact}<br><small>${safeCompany}</small></td>
          <td>${formatProjectType(project.project_type)}</td>
          <td>${formatDisplayValue(project.budget_range)}</td>
          <td>${formatDisplayValue(project.timeline)}</td>
          <td>${formatDate(project.start_date)}</td>
          <td>${formatDate(project.end_date)}</td>
          <td>${statusLabels[status] || 'Pending'}</td>
        </tr>
      `;
    })
    .join('');

  setupProjectTableHandlers(ctx);
}

function setupProjectTableHandlers(ctx: AdminDashboardContext): void {
  const tableBody = domCache.get('tableBody');
  if (!tableBody) return;

  // Row click handlers - clicking row opens project details
  const rows = tableBody.querySelectorAll('tr[data-project-id]');
  rows.forEach((row) => {
    row.addEventListener('click', () => {
      const projectId = parseInt((row as HTMLElement).dataset.projectId || '0');
      showProjectDetails(projectId, ctx);
    });
  });
}

export async function updateProjectStatus(
  id: number,
  status: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/projects/${id}`, { status });

    if (response.ok) {
      ctx.showNotification('Project status updated', 'success');
      await loadProjects(ctx);
    } else {
      ctx.showNotification('Failed to update project status', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error updating project status:', error);
    ctx.showNotification('Failed to update project status', 'error');
  }
}

export function showProjectDetails(
  projectId: number,
  ctx: AdminDashboardContext
): void {
  const project = projectsData.find((p) => p.id === projectId);
  if (!project) return;

  currentProjectId = projectId;
  storedContext = ctx;

  // Switch to project-detail tab
  ctx.switchTab('project-detail');

  populateProjectDetailView(project);
  setupProjectDetailTabs(ctx);

  // Load project-specific data
  loadProjectMessages(projectId, ctx);
  loadProjectFiles(projectId, ctx);
  loadProjectMilestones(projectId, ctx);
  loadProjectInvoices(projectId, ctx);
}

function populateProjectDetailView(project: LeadProject): void {
  const titleEl = domCache.get('detailTitle');
  if (titleEl) titleEl.textContent = 'Project Details';

  const projectData = project as any;

  // Overview fields - use batch update for text content
  // Note: textContent doesn't interpret HTML, so we decode entities but don't need to escape
  // Empty string for missing values (no dashes)
  batchUpdateText({
    'pd-project-name': SanitizationUtils.decodeHtmlEntities(project.project_name || 'Untitled Project'),
    'pd-client-name': SanitizationUtils.decodeHtmlEntities(project.contact_name || ''),
    'pd-client-email': project.email || '',
    'pd-company': SanitizationUtils.decodeHtmlEntities(project.company_name || ''),
    'pd-type': formatProjectType(project.project_type),
    'pd-budget': formatDisplayValue(project.budget_range),
    'pd-price': projectData.price ? `$${Number(projectData.price).toLocaleString()}` : '',
    'pd-timeline': formatDisplayValue(project.timeline),
    'pd-start-date': formatDateForDisplay(projectData.start_date) || formatDateForDisplay(project.created_at),
    'pd-end-date': formatDateForDisplay(projectData.end_date),
    'pd-deposit': projectData.deposit_amount ? `$${Number(projectData.deposit_amount).toLocaleString()}` : '',
    'pd-contract-date': formatDateForDisplay(projectData.contract_signed_date)
  });

  // Update URL links (preview, repo, production)
  const updateUrlLink = (linkId: string, url: string | null): void => {
    const link = document.getElementById(linkId) as HTMLAnchorElement;
    if (link) {
      // Decode HTML entities in URL (e.g., &#x2F; -> /)
      const decodedUrl = url ? SanitizationUtils.decodeHtmlEntities(url) : null;
      if (decodedUrl) {
        link.href = decodedUrl;
        link.textContent = decodedUrl;
        link.onclick = null;
      } else {
        link.href = '#';
        link.textContent = '';
        link.onclick = (e) => e.preventDefault();
      }
    }
  };

  updateUrlLink('pd-preview-url-link', projectData.preview_url);
  updateUrlLink('pd-repo-url-link', projectData.repo_url);
  updateUrlLink('pd-production-url-link', projectData.production_url);

  // Admin notes section - show only if notes exist
  const adminNotesSection = document.getElementById('pd-admin-notes-section');
  const adminNotesEl = document.getElementById('pd-admin-notes');
  if (adminNotesSection && adminNotesEl) {
    if (projectData.notes) {
      adminNotesEl.innerHTML = formatTextWithLineBreaks(SanitizationUtils.decodeHtmlEntities(projectData.notes));
      adminNotesSection.style.display = '';
    } else {
      adminNotesSection.style.display = 'none';
    }
  }

  // Make client name, company, and email clickable to navigate to client details
  const projectEmail = project.email;
  const clickableClients = ['pd-client-link', 'pd-company-link', 'pd-email-link'];

  clickableClients.forEach((id) => {
    const el = document.getElementById(id);
    if (el && projectEmail) {
      el.style.cursor = 'pointer';
      // Clone to remove old listeners
      const newEl = el.cloneNode(true) as HTMLElement;
      el.parentNode?.replaceChild(newEl, el);
      newEl.addEventListener('click', () => navigateToClientByEmail(projectEmail));
    }
  });

  // Setup edit button
  setupEditProjectButton(project);

  // Status badge - normalize to underscore format (use cached ref)
  const statusEl = domCache.get('status');
  if (statusEl) {
    const normalizedStatus = normalizeStatus(project.status);
    statusEl.textContent = normalizedStatus.replace(/_/g, ' ');
    statusEl.className = `status-badge status-${normalizedStatus}`;
  }

  // Progress (use cached refs)
  const progress = project.progress || 0;
  const progressPercent = domCache.get('progressPercent');
  const progressBar = domCache.get('progressBar');
  if (progressPercent) progressPercent.textContent = `${progress}%`;
  if (progressBar) progressBar.style.width = `${progress}%`;

  // Description (use cached ref) - use innerHTML with sanitized line breaks
  const descriptionEl = domCache.get('description');
  if (descriptionEl) {
    descriptionEl.innerHTML = formatTextWithLineBreaks(
      project.description ? SanitizationUtils.decodeHtmlEntities(project.description) : null
    );
  }

  // Features - append below the description row if present (use cached ref)
  const notes = domCache.get('notes');
  if (notes && project.features) {
    // Parse features - handles both comma-separated and concatenated formats
    const parsedFeatures = parseFeatures(project.features);

    // Filter out plan tiers that aren't actual features
    const excludedValues = ['basic-only', 'standard', 'premium', 'enterprise'];
    const featuresList = parsedFeatures
      .filter((f) => f && !excludedValues.includes(f.toLowerCase()))
      .map((f) => `<span class="feature-tag">${SanitizationUtils.escapeHtml(f.replace(/-/g, ' '))}</span>`)
      .join('');

    // Check if features container already exists, otherwise append
    let featuresContainer = notes.querySelector('.features-container');
    if (!featuresContainer && featuresList) {
      featuresContainer = document.createElement('div');
      featuresContainer.className = 'meta-item features-container';
      featuresContainer.innerHTML = `<span class="field-label">Features Requested</span><div class="features-list">${featuresList}</div>`;
      notes.appendChild(featuresContainer);
    } else if (featuresContainer && featuresList) {
      featuresContainer.innerHTML = `<span class="field-label">Features Requested</span><div class="features-list">${featuresList}</div>`;
    }
  }
}

/**
 * Parse features string - handles both comma-separated and concatenated formats
 */
function parseFeatures(featuresStr: string): string[] {
  if (!featuresStr) return [];

  // If comma-separated, split normally
  if (featuresStr.includes(',')) {
    return featuresStr.split(',').map((f) => f.trim()).filter((f) => f);
  }

  // Known feature values from all project types
  const knownFeatures = [
    'contact-form', 'social-links', 'analytics', 'mobile-optimized',
    'age-verification', 'basic-only', 'blog', 'gallery', 'testimonials',
    'booking', 'cms', 'portfolio-gallery', 'case-studies', 'resume-download',
    'shopping-cart', 'payment-processing', 'inventory-management',
    'user-accounts', 'admin-dashboard', 'product-search', 'reviews',
    'real-time-updates', 'api-integration', 'database', 'authentication',
    'dashboard', 'notifications', 'file-upload', 'offline-support',
    'tab-management', 'bookmarks', 'sync', 'dark-mode', 'keyboard-shortcuts'
  ];

  // Sort by length (longest first) to match longer patterns before shorter ones
  const sortedFeatures = [...knownFeatures].sort((a, b) => b.length - a.length);

  const found: string[] = [];
  let remaining = featuresStr;

  // Iteratively find and extract known features
  while (remaining.length > 0) {
    let matched = false;
    for (const feature of sortedFeatures) {
      const index = remaining.indexOf(feature);
      if (index !== -1) {
        found.push(feature);
        remaining = remaining.slice(0, index) + remaining.slice(index + feature.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (remaining.trim()) {
        found.push(remaining.trim());
      }
      break;
    }
  }

  return found;
}

/**
 * Setup edit project button and modal
 */
function setupEditProjectButton(project: LeadProject): void {
  const editBtn = domCache.get('editProjectBtn', true); // Force refresh since we clone
  if (!editBtn) return;

  // Clone to remove old listeners
  const newEditBtn = editBtn.cloneNode(true) as HTMLElement;
  editBtn.parentNode?.replaceChild(newEditBtn, editBtn);

  newEditBtn.addEventListener('click', () => openEditProjectModal(project));
}

// Store current project ID for form submission
let editingProjectId: number | null = null;

/**
 * Open the edit project modal with current project data
 */
function openEditProjectModal(project: LeadProject): void {
  const modal = domCache.get('editModal');
  if (!modal) return;

  // Store project ID for form submission
  editingProjectId = project.id;
  const projectData = project as any;

  // Populate form fields
  const nameInput = document.getElementById('edit-project-name') as HTMLInputElement;
  const descriptionInput = document.getElementById('edit-project-description') as HTMLTextAreaElement;
  const budgetInput = document.getElementById('edit-project-budget') as HTMLInputElement;
  const priceInput = document.getElementById('edit-project-price') as HTMLInputElement;
  const timelineInput = document.getElementById('edit-project-timeline') as HTMLInputElement;
  const startDateInput = document.getElementById('edit-project-start-date') as HTMLInputElement;
  const endDateInput = document.getElementById('edit-project-end-date') as HTMLInputElement;
  const depositInput = document.getElementById('edit-project-deposit') as HTMLInputElement;
  const contractDateInput = document.getElementById('edit-project-contract-date') as HTMLInputElement;
  const previewUrlInput = document.getElementById('edit-project-preview-url') as HTMLInputElement;
  const repoUrlInput = document.getElementById('edit-project-repo-url') as HTMLInputElement;
  const productionUrlInput = document.getElementById('edit-project-production-url') as HTMLInputElement;
  const notesInput = document.getElementById('edit-project-notes') as HTMLTextAreaElement;

  // Decode HTML entities for text fields that may contain encoded characters
  if (nameInput) nameInput.value = SanitizationUtils.decodeHtmlEntities(project.project_name || '');
  if (descriptionInput) descriptionInput.value = SanitizationUtils.decodeHtmlEntities(project.description || '');
  if (budgetInput) budgetInput.value = project.budget_range || '';
  if (priceInput) priceInput.value = projectData.price || '';
  if (timelineInput) timelineInput.value = project.timeline || '';
  // Date inputs need YYYY-MM-DD format
  if (startDateInput) startDateInput.value = projectData.start_date ? projectData.start_date.split('T')[0] : '';
  if (endDateInput) endDateInput.value = projectData.end_date ? projectData.end_date.split('T')[0] : '';
  if (depositInput) depositInput.value = projectData.deposit_amount || '';
  if (contractDateInput) contractDateInput.value = projectData.contract_signed_date ? projectData.contract_signed_date.split('T')[0] : '';
  // URL fields
  if (previewUrlInput) previewUrlInput.value = projectData.preview_url || '';
  if (repoUrlInput) repoUrlInput.value = projectData.repo_url || '';
  if (productionUrlInput) productionUrlInput.value = projectData.production_url || '';
  // Admin notes field - decode entities
  if (notesInput) notesInput.value = SanitizationUtils.decodeHtmlEntities(projectData.notes || '');

  // Initialize custom dropdowns for selects (only once)
  initProjectModalDropdowns(project);

  // Show modal and lock body scroll
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  // Setup close handlers (only once per modal lifecycle)
  setupEditProjectModalHandlers(modal);
}

/**
 * Initialize custom dropdowns for the edit project modal
 */
function initProjectModalDropdowns(project: LeadProject): void {
  const typeSelect = document.getElementById('edit-project-type') as HTMLSelectElement;
  const statusSelect = document.getElementById('edit-project-status') as HTMLSelectElement;

  // Type dropdown
  if (typeSelect) {
    const typeWrapper = typeSelect.previousElementSibling as HTMLElement;
    if (typeWrapper?.classList.contains('modal-dropdown')) {
      // Dropdown already exists, just update the value
      setModalDropdownValue(typeWrapper, project.project_type || '');
    } else if (!typeSelect.dataset.dropdownInit) {
      // Initialize new dropdown
      typeSelect.value = project.project_type || '';
      typeSelect.dataset.dropdownInit = 'true';
      initModalDropdown(typeSelect, { placeholder: 'Select type...' });
    }
  }

  // Status dropdown
  if (statusSelect) {
    const statusWrapper = statusSelect.previousElementSibling as HTMLElement;
    if (statusWrapper?.classList.contains('modal-dropdown')) {
      // Dropdown already exists, just update the value
      setModalDropdownValue(statusWrapper, normalizeStatus(project.status));
    } else if (!statusSelect.dataset.dropdownInit) {
      // Initialize new dropdown
      statusSelect.value = normalizeStatus(project.status);
      statusSelect.dataset.dropdownInit = 'true';
      initModalDropdown(statusSelect, { placeholder: 'Select status...' });
    }
  }
}

/**
 * Setup modal close and form handlers (only attach once)
 */
let editProjectModalInitialized = false;
function setupEditProjectModalHandlers(modal: HTMLElement): void {
  if (editProjectModalInitialized) return;
  editProjectModalInitialized = true;

  const closeBtn = domCache.get('editClose');
  const cancelBtn = domCache.get('editCancel');
  const form = domCache.getAs<HTMLFormElement>('editForm');

  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Handle form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editingProjectId !== null) {
        await saveProjectChanges(editingProjectId);
        closeModal();
      }
    });
  }
}

/**
 * Save project changes from the edit modal
 */
async function saveProjectChanges(projectId: number): Promise<void> {
  if (!storedContext) return;

  const nameInput = document.getElementById('edit-project-name') as HTMLInputElement;
  const descriptionInput = document.getElementById('edit-project-description') as HTMLTextAreaElement;
  const typeSelect = document.getElementById('edit-project-type') as HTMLSelectElement;
  const budgetInput = document.getElementById('edit-project-budget') as HTMLInputElement;
  const priceInput = document.getElementById('edit-project-price') as HTMLInputElement;
  const timelineInput = document.getElementById('edit-project-timeline') as HTMLInputElement;
  const statusSelect = document.getElementById('edit-project-status') as HTMLSelectElement;
  const startDateInput = document.getElementById('edit-project-start-date') as HTMLInputElement;
  const endDateInput = document.getElementById('edit-project-end-date') as HTMLInputElement;
  const depositInput = document.getElementById('edit-project-deposit') as HTMLInputElement;
  const contractDateInput = document.getElementById('edit-project-contract-date') as HTMLInputElement;
  const previewUrlInput = document.getElementById('edit-project-preview-url') as HTMLInputElement;
  const repoUrlInput = document.getElementById('edit-project-repo-url') as HTMLInputElement;
  const productionUrlInput = document.getElementById('edit-project-production-url') as HTMLInputElement;
  const notesInput = document.getElementById('edit-project-notes') as HTMLTextAreaElement;

  const updates: Record<string, string> = {};
  if (nameInput?.value) updates.project_name = nameInput.value;
  // Allow clearing description by sending empty string
  if (descriptionInput) updates.description = descriptionInput.value || '';
  if (typeSelect?.value) updates.project_type = typeSelect.value;
  if (budgetInput?.value) updates.budget = budgetInput.value;
  if (priceInput?.value) updates.price = priceInput.value;
  if (timelineInput?.value) updates.timeline = timelineInput.value;
  if (statusSelect?.value) updates.status = statusSelect.value;
  // Allow clearing dates by sending empty string
  if (startDateInput) updates.start_date = startDateInput.value || '';
  if (endDateInput) updates.end_date = endDateInput.value || '';
  // Deposit and contract date (allow clearing)
  if (depositInput) updates.deposit_amount = depositInput.value || '';
  if (contractDateInput) updates.contract_signed_date = contractDateInput.value || '';
  // URL fields (allow clearing)
  if (previewUrlInput) updates.preview_url = previewUrlInput.value || '';
  if (repoUrlInput) updates.repo_url = repoUrlInput.value || '';
  if (productionUrlInput) updates.production_url = productionUrlInput.value || '';
  // Admin notes (allow clearing by sending empty string)
  if (notesInput) updates.admin_notes = notesInput.value || '';

  try {
    const response = await apiPut(`/api/projects/${projectId}`, updates);
    const result = await response.json();

    if (response.ok && result.project) {
      storedContext.showNotification('Project updated successfully', 'success');
      // Update local project data with response (no need to reload all projects)
      const projectIndex = projectsData.findIndex((p) => p.id === projectId);
      if (projectIndex !== -1) {
        // Preserve computed fields that the API might not return
        const existingProject = projectsData[projectIndex];
        projectsData[projectIndex] = {
          ...existingProject,
          ...result.project,
          // Ensure computed fields are preserved
          file_count: existingProject.file_count,
          message_count: existingProject.message_count,
          unread_count: existingProject.unread_count
        };
        populateProjectDetailView(projectsData[projectIndex]);
      }
    } else {
      storedContext.showNotification(result.message || 'Failed to update project', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error saving project:', error);
    storedContext.showNotification('Failed to update project', 'error');
  }
}

function setupProjectDetailTabs(ctx: AdminDashboardContext): void {
  const tabBtns = document.querySelectorAll('.project-detail-tabs button');
  const tabContents = document.querySelectorAll('[id^="pd-tab-"]');

  tabBtns.forEach((btn) => {
    const btnEl = btn as HTMLElement;
    // Skip if already set up
    if (btnEl.dataset.listenerAdded) return;
    btnEl.dataset.listenerAdded = 'true';

    btn.addEventListener('click', () => {
      const tabName = btnEl.dataset.pdTab;
      if (!tabName) return;

      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach((content) => {
        content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
      });
    });
  });

  // Back button handler (use cached ref)
  const backBtn = domCache.get('backBtn');
  if (backBtn && !backBtn.dataset.listenerAdded) {
    backBtn.dataset.listenerAdded = 'true';
    backBtn.addEventListener('click', () => {
      currentProjectId = null;
      ctx.switchTab('projects');
    });
  }

  // Create invoice handler (use cached ref)
  const createInvoiceBtn = domCache.get('createInvoiceBtn');
  if (createInvoiceBtn && !createInvoiceBtn.dataset.listenerAdded) {
    createInvoiceBtn.dataset.listenerAdded = 'true';
    createInvoiceBtn.addEventListener('click', () => showCreateInvoicePrompt());
  }

  // Add milestone handler (use cached ref)
  const addMilestoneBtn = domCache.get('addMilestoneBtn');
  if (addMilestoneBtn && !addMilestoneBtn.dataset.listenerAdded) {
    addMilestoneBtn.dataset.listenerAdded = 'true';
    addMilestoneBtn.addEventListener('click', () => showAddMilestonePrompt());
  }

  // Send message handler (use cached ref)
  const sendMsgBtn = domCache.get('sendMsgBtn');
  if (sendMsgBtn && !sendMsgBtn.dataset.listenerAdded) {
    sendMsgBtn.dataset.listenerAdded = 'true';
    sendMsgBtn.addEventListener('click', () => sendProjectMessage());
  }

  // File upload handlers
  setupProjectFileUpload();
}

function formatProjectType(type: string | undefined): string {
  if (!type) return '';

  // Map known project types to display labels
  const typeLabels: Record<string, string> = {
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    'portfolio': 'Portfolio',
    'e-commerce': 'E-Commerce',
    'ecommerce': 'E-Commerce',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    'website': 'Website',
    'mobile-app': 'Mobile App',
    'branding': 'Branding',
    'other': 'Other'
  };

  // Check if we have a known label
  const label = typeLabels[type.toLowerCase()];
  if (label) return label;

  // Fallback: replace hyphens/underscores with spaces and capitalize
  return type
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize status value to underscore format for CSS class consistency.
 * Database may store hyphens (in-progress) but CSS/JS uses underscores (in_progress).
 */
function normalizeStatus(status: string | undefined): string {
  if (!status) return 'pending';
  return status.replace(/-/g, '_');
}

/**
 * Format a date string for display without timezone issues.
 * Handles YYYY-MM-DD format by parsing components directly to avoid UTC conversion.
 * Returns empty string for missing/invalid dates.
 */
function formatDateForDisplay(dateStr: string | undefined | null): string {
  if (!dateStr) return '';

  // Handle ISO date strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      // Create date using local timezone (month is 0-indexed)
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString();
    }
  }

  // Fallback: try standard parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

// Project Messages
export async function loadProjectMessages(
  projectId: number,
  _ctx: AdminDashboardContext
): Promise<void> {
  const container = domCache.get('messagesThread');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/projects/${projectId}/messages`);

    if (response.ok) {
      const data = await response.json();
      renderProjectMessages(data.messages || [], container);
    } else {
      container.innerHTML = '<p class="empty-state">No messages yet.</p>';
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load messages:', error);
    container.innerHTML = '<p class="empty-state">Failed to load messages.</p>';
  }
}

function renderProjectMessages(messages: Message[], container: HTMLElement): void {
  if (messages.length === 0) {
    container.innerHTML = '<p class="empty-state">No messages yet. Start the conversation!</p>';
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const safeSender = SanitizationUtils.escapeHtml(msg.sender_name || 'Unknown');
      const safeMessage = SanitizationUtils.escapeHtml(msg.message || '');
      const time = new Date(msg.created_at).toLocaleString();
      const isAdmin = msg.sender_type === 'admin';

      return `
        <div class="message ${isAdmin ? 'message-sent' : 'message-received'}">
          <div class="message-header">
            <span class="message-sender">${safeSender}</span>
            <span class="message-time">${time}</span>
          </div>
          <div class="message-content">${safeMessage}</div>
        </div>
      `;
    })
    .join('');
}

// Project Files
export async function loadProjectFiles(
  projectId: number,
  _ctx: AdminDashboardContext
): Promise<void> {
  // Force refresh to get fresh DOM reference after uploads
  const container = domCache.get('filesList', true);
  if (!container) return;

  try {
    const response = await apiFetch(`/api/projects/${projectId}/files`);

    if (response.ok) {
      const data = await response.json();
      renderProjectFiles(data.files || [], container);
    } else {
      container.innerHTML = '<p class="empty-state">No files uploaded yet.</p>';
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load files:', error);
    container.innerHTML = '<p class="empty-state">Failed to load files.</p>';
  }
}

function renderProjectFiles(files: ProjectFile[], container: HTMLElement): void {
  if (files.length === 0) {
    container.innerHTML = '<p class="empty-state">No files uploaded yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="files-table" aria-label="Project files">
      <thead>
        <tr>
          <th scope="col">File</th>
          <th scope="col">Size</th>
          <th scope="col">Uploaded</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${files
    .map((file) => {
      const safeName = SanitizationUtils.escapeHtml(file.original_filename || file.filename);
      // Use file_size or size (API returns both for compatibility)
      const fileSize = file.file_size || file.size || 0;
      const size = formatFileSize(fileSize);
      const date = new Date(file.created_at).toLocaleDateString();
      // Use API endpoint for file access (authenticated)
      const fileApiUrl = `/api/uploads/file/${file.id}`;
      const downloadUrl = `${fileApiUrl}?download=true`;
      // Check if file is previewable (JSON, text, images)
      const isPreviewable = /\.(json|txt|md|png|jpg|jpeg|gif|webp|svg|pdf)$/i.test(safeName);

      return `
              <tr>
                <td>${safeName}</td>
                <td>${size}</td>
                <td>${date}</td>
                <td class="file-actions">
                  ${isPreviewable ? `<button class="action-btn preview-btn" data-file-id="${file.id}" data-file-url="${fileApiUrl}" data-file-name="${safeName}" aria-label="Preview ${safeName}">Preview</button>` : ''}
                  <button class="action-btn download-btn" data-file-url="${downloadUrl}" data-file-name="${safeName}" aria-label="Download ${safeName}">Download</button>
                </td>
              </tr>
            `;
    })
    .join('')}
      </tbody>
    </table>
  `;

  // Add click handlers for preview buttons
  container.querySelectorAll('.preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fileUrl = (btn as HTMLElement).dataset.fileUrl;
      const fileName = (btn as HTMLElement).dataset.fileName;
      if (fileUrl) {
        openFilePreview(fileUrl, fileName || 'File Preview');
      }
    });
  });

  // Add click handlers for download buttons
  container.querySelectorAll('.download-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fileUrl = (btn as HTMLElement).dataset.fileUrl;
      const fileName = (btn as HTMLElement).dataset.fileName;
      if (fileUrl) {
        await downloadFile(fileUrl, fileName || 'download');
      }
    });
  });
}

/**
 * Download file using authenticated fetch
 */
async function downloadFile(fileUrl: string, fileName: string): Promise<void> {
  try {
    const response = await apiFetch(fileUrl);
    if (!response.ok) throw new Error('Failed to download file');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Download error:', err);
    showToast('Failed to download file', 'error');
  }
}

/**
 * Open file preview in a modal or new tab
 * Uses authenticated API fetch
 */
async function openFilePreview(fileUrl: string, fileName: string): Promise<void> {
  try {
    // For JSON files, fetch and display in a modal
    if (/\.json$/i.test(fileName)) {
      const response = await apiFetch(fileUrl);
      if (!response.ok) throw new Error('Failed to load file');
      const data = await response.json();
      showJsonPreviewModal(data, fileName);
    } else if (/\.(txt|md)$/i.test(fileName)) {
      // For text files, fetch and display as text
      const response = await apiFetch(fileUrl);
      if (!response.ok) throw new Error('Failed to load file');
      const text = await response.text();
      showTextPreviewModal(text, fileName);
    } else if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
      // For images, fetch and create blob URL
      const response = await apiFetch(fileUrl);
      if (!response.ok) throw new Error('Failed to load file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      showImagePreviewModal(blobUrl, fileName);
    } else if (/\.pdf$/i.test(fileName)) {
      // For PDFs, fetch and open in new tab as blob
      const response = await apiFetch(fileUrl);
      if (!response.ok) throw new Error('Failed to load file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      // Revoke blob URL after delay to free memory (browser will have loaded PDF by then)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } else {
      // For other files, try to download via authenticated fetch
      const response = await apiFetch(`${fileUrl}?download=true`);
      if (!response.ok) throw new Error('Failed to load file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    }
  } catch (err) {
    console.error('Preview error:', err);
    showToast('Failed to load file for preview', 'error');
  }
}

/**
 * Show JSON content in a preview modal
 */
function showJsonPreviewModal(data: unknown, fileName: string): void {
  // Check if modal already exists
  let modal = document.getElementById('file-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'file-preview-modal';
    modal.className = 'admin-modal-overlay';
    document.body.appendChild(modal);
  }

  const formattedJson = JSON.stringify(data, null, 2);

  modal.innerHTML = `
    <div class="admin-modal" style="max-width: 700px;">
      <div class="admin-modal-header">
        <h3>${SanitizationUtils.escapeHtml(fileName)}</h3>
        <button class="admin-modal-close" id="preview-modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div class="admin-modal-body" style="max-height: 60vh; overflow: auto;">
        <pre style="white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5; margin: 0; color: var(--portal-text-light);">${SanitizationUtils.escapeHtml(formattedJson)}</pre>
      </div>
      <div class="admin-modal-footer">
        <button class="btn btn-secondary" id="preview-modal-close-btn">Close</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  const closeModal = () => {
    modal?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

  document.getElementById('preview-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('preview-modal-close-btn')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}

/**
 * Show text content in a preview modal
 */
function showTextPreviewModal(text: string, fileName: string): void {
  let modal = document.getElementById('file-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'file-preview-modal';
    modal.className = 'admin-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="admin-modal" style="max-width: 700px;">
      <div class="admin-modal-header">
        <h3>${SanitizationUtils.escapeHtml(fileName)}</h3>
        <button class="admin-modal-close" id="preview-modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div class="admin-modal-body" style="max-height: 60vh; overflow: auto;">
        <pre style="white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5; margin: 0; color: var(--portal-text-light);">${SanitizationUtils.escapeHtml(text)}</pre>
      </div>
      <div class="admin-modal-footer">
        <button class="btn btn-secondary" id="preview-modal-close-btn">Close</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  const closeModal = () => {
    modal?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

  document.getElementById('preview-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('preview-modal-close-btn')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}

/**
 * Show image in a preview modal
 */
function showImagePreviewModal(imageUrl: string, fileName: string): void {
  let modal = document.getElementById('file-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'file-preview-modal';
    modal.className = 'admin-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="admin-modal" style="max-width: 900px;">
      <div class="admin-modal-header">
        <h3>${SanitizationUtils.escapeHtml(fileName)}</h3>
        <button class="admin-modal-close" id="preview-modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div class="admin-modal-body" style="max-height: 70vh; overflow: auto; display: flex; justify-content: center; align-items: center;">
        <img src="${imageUrl}" alt="${SanitizationUtils.escapeHtml(fileName)}" style="max-width: 100%; max-height: 65vh; object-fit: contain;" />
      </div>
      <div class="admin-modal-footer">
        <button class="btn btn-secondary" id="preview-modal-close-btn">Close</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  const closeModal = () => {
    // Revoke blob URL to free memory
    if (imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    modal?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

  document.getElementById('preview-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('preview-modal-close-btn')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}

// Project Milestones
export async function loadProjectMilestones(
  projectId: number,
  ctx: AdminDashboardContext
): Promise<void> {
  const container = domCache.get('milestonesList');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/projects/${projectId}/milestones`);

    if (response.ok) {
      const data = await response.json();
      renderProjectMilestones(data.milestones || [], container, ctx);
    } else {
      container.innerHTML = '<p class="empty-state">No milestones yet.</p>';
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load milestones:', error);
    container.innerHTML = '<p class="empty-state">Failed to load milestones.</p>';
  }
}

function renderProjectMilestones(
  milestones: ProjectMilestone[],
  container: HTMLElement,
  ctx: AdminDashboardContext
): void {
  if (milestones.length === 0) {
    container.innerHTML = '<p class="empty-state">No milestones defined yet.</p>';
    return;
  }

  container.innerHTML = milestones
    .map((milestone) => {
      const safeTitle = SanitizationUtils.escapeHtml(milestone.title);
      const safeDesc = SanitizationUtils.escapeHtml(milestone.description || '');
      const dueDate = new Date(milestone.due_date).toLocaleDateString();

      return `
        <div class="milestone-item ${milestone.is_completed ? 'completed' : ''}">
          <div class="milestone-checkbox">
            <input type="checkbox" ${milestone.is_completed ? 'checked' : ''}
              data-milestone-id="${milestone.id}" class="milestone-toggle">
          </div>
          <div class="milestone-content">
            <h4>${safeTitle}</h4>
            <p>${safeDesc}</p>
            <span class="milestone-due">Due: ${dueDate}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // Add toggle handlers
  container.querySelectorAll('.milestone-toggle').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const milestoneId = parseInt(target.dataset.milestoneId || '0');
      toggleMilestone(milestoneId, target.checked, ctx);
    });
  });

  // Calculate and update progress based on completed milestones
  const completedCount = milestones.filter((m) => m.is_completed).length;
  const totalCount = milestones.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  updateProgressBar(progress);
}

function updateProgressBar(progress: number): void {
  const progressPercent = domCache.get('progressPercent');
  const progressBar = domCache.get('progressBar');

  if (progressPercent) {
    progressPercent.textContent = `${progress}%`;
  }
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  // Save progress to database
  if (currentProjectId) {
    apiPut(`/api/projects/${currentProjectId}`, { progress })
      .then((response) => {
        if (!response.ok) {
          console.error('[AdminProjects] Failed to save progress:', response.status);
        }
      })
      .catch((err) => console.error('[AdminProjects] Error saving progress:', err));
  }
}

export async function toggleMilestone(
  milestoneId: number,
  isCompleted: boolean,
  ctx: AdminDashboardContext
): Promise<void> {
  if (!currentProjectId) return;

  try {
    const response = await apiPut(`/api/projects/${currentProjectId}/milestones/${milestoneId}`, { is_completed: isCompleted });

    if (response.ok) {
      ctx.showNotification('Milestone updated', 'success');
      // Reload milestones to update progress
      loadProjectMilestones(currentProjectId, ctx);
    } else {
      ctx.showNotification('Failed to update milestone', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to toggle milestone:', error);
  }
}

// Project Invoices
export async function loadProjectInvoices(
  projectId: number,
  _ctx: AdminDashboardContext
): Promise<void> {
  const container = domCache.get('invoicesList');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/invoices/project/${projectId}`);

    if (response.ok) {
      const data = await response.json();
      renderProjectInvoices(data.invoices || [], container);
    } else {
      container.innerHTML = '<p class="empty-state">No invoices yet.</p>';
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load invoices:', error);
    container.innerHTML = '<p class="empty-state">Failed to load invoices.</p>';
  }
}

function renderProjectInvoices(invoices: ProjectInvoice[], container: HTMLElement): void {
  if (invoices.length === 0) {
    container.innerHTML = '<p class="empty-state">No invoices created yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="invoices-table" aria-label="Project invoices">
      <thead>
        <tr>
          <th scope="col">Invoice #</th>
          <th scope="col">Amount</th>
          <th scope="col">Due Date</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        ${invoices
    .map((invoice) => {
      const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(invoice.amount_total);
      const dueDate = new Date(invoice.due_date).toLocaleDateString();
      const statusClass = `status-${invoice.status}`;

      return `
              <tr>
                <td>${invoice.invoice_number}</td>
                <td>${amount}</td>
                <td>${dueDate}</td>
                <td><span class="status-badge ${statusClass}">${invoice.status}</span></td>
              </tr>
            `;
    })
    .join('')}
      </tbody>
    </table>
  `;
}

/**
 * Navigate to client detail view by looking up client via email
 */
async function navigateToClientByEmail(email: string): Promise<void> {
  if (!storedContext || !email) return;

  try {
    // Import and use the clients module
    const clientsModule = await import('./admin-clients');

    // First ensure clients are loaded
    await clientsModule.loadClients(storedContext);

    // Find the client by email
    const clients = clientsModule.getClientsData();
    const client = clients.find(c => c.email === email);

    if (client) {
      clientsModule.showClientDetails(client.id, storedContext);
    } else {
      storedContext.showNotification('Client not found', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error navigating to client:', error);
    storedContext?.showNotification('Error loading client details', 'error');
  }
}

// =====================================================
// INVOICE CREATION
// =====================================================

/**
 * Show prompt to create a new invoice
 */
async function showCreateInvoicePrompt(): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  const project = projectsData.find((p) => p.id === currentProjectId) as any;
  if (!project) return;

  const result = await multiPromptDialog({
    title: 'Create Invoice',
    fields: [
      {
        name: 'description',
        label: 'Line Item Description',
        type: 'text',
        defaultValue: 'Web Development Services',
        required: true
      },
      {
        name: 'amount',
        label: 'Amount ($)',
        type: 'number',
        defaultValue: '1000',
        placeholder: 'Enter amount',
        required: true
      }
    ],
    confirmText: 'Create Invoice',
    cancelText: 'Cancel'
  });

  if (!result) return;

  const amount = parseFloat(result.amount);
  if (isNaN(amount) || amount <= 0) {
    alertWarning('Please enter a valid amount');
    return;
  }

  createInvoice(project.client_id || project.id, result.description, amount);
}

/**
 * Create a new invoice for the current project
 */
async function createInvoice(
  clientId: number,
  description: string,
  amount: number
): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  try {
    const response = await apiPost('/api/invoices', {
      projectId: currentProjectId,
      clientId,
      lineItems: [
        {
          description,
          quantity: 1,
          rate: amount,
          amount
        }
      ],
      notes: '',
      terms: 'Payment due within 30 days'
    });

    if (response.ok) {
      storedContext.showNotification('Invoice created successfully!', 'success');
      loadProjectInvoices(currentProjectId, storedContext);
    } else {
      const error = await response.json();
      storedContext.showNotification(`Failed to create invoice: ${error.message || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error creating invoice:', error);
    storedContext.showNotification('Error creating invoice', 'error');
  }
}

// =====================================================
// MILESTONE CREATION
// =====================================================

/**
 * Show prompt to add a new milestone
 */
async function showAddMilestonePrompt(): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = await multiPromptDialog({
    title: 'Add Milestone',
    fields: [
      {
        name: 'title',
        label: 'Milestone Title',
        type: 'text',
        placeholder: 'Enter milestone title',
        required: true
      },
      {
        name: 'description',
        label: 'Description (optional)',
        type: 'textarea',
        placeholder: 'Enter milestone description'
      },
      {
        name: 'dueDate',
        label: 'Due Date',
        type: 'date',
        defaultValue: defaultDueDate,
        required: true
      }
    ],
    confirmText: 'Add Milestone',
    cancelText: 'Cancel'
  });

  if (!result) return;

  addMilestone(result.title, result.description || '', result.dueDate);
}

/**
 * Add a new milestone to the current project
 */
async function addMilestone(
  title: string,
  description: string,
  dueDate: string
): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  try {
    const response = await apiPost(`/api/projects/${currentProjectId}/milestones`, {
      title,
      description,
      due_date: dueDate
    });

    if (response.ok) {
      storedContext.showNotification('Milestone added!', 'success');
      loadProjectMilestones(currentProjectId, storedContext);
    } else {
      storedContext.showNotification('Failed to add milestone', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error adding milestone:', error);
    storedContext.showNotification('Error adding milestone', 'error');
  }
}

// =====================================================
// PROJECT MESSAGING
// =====================================================

/**
 * Send a message on the current project
 */
async function sendProjectMessage(): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  const messageInput = domCache.getAs<HTMLTextAreaElement>('messageInput');
  if (!messageInput || !messageInput.value.trim()) return;

  const message = messageInput.value.trim();

  try {
    const response = await apiPost(`/api/projects/${currentProjectId}/messages`, { message });

    if (response.ok) {
      messageInput.value = '';
      storedContext.showNotification('Message sent!', 'success');
      loadProjectMessages(currentProjectId, storedContext);
    } else {
      storedContext.showNotification('Failed to send message', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error sending message:', error);
    storedContext.showNotification('Error sending message', 'error');
  }
}

// =====================================================
// PROJECT FILE UPLOAD
// =====================================================

/**
 * Set up file upload handlers for project detail view
 */
function setupProjectFileUpload(): void {
  const dropzone = domCache.get('uploadDropzone');
  const fileInput = domCache.getAs<HTMLInputElement>('fileInput');
  const browseBtn = domCache.get('browseFilesBtn');

  if (!dropzone) return;

  // Skip if already set up
  if (dropzone.dataset.listenerAdded) return;
  dropzone.dataset.listenerAdded = 'true';

  // Browse button click
  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        uploadProjectFiles(Array.from(fileInput.files));
        fileInput.value = '';
      }
    });
  }

  // Drag & drop handlers
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadProjectFiles(Array.from(files));
    }
  });
}

/**
 * Upload files for the current project
 */
async function uploadProjectFiles(files: File[]): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  // Check file count limit
  if (files.length > 5) {
    alertWarning('Maximum 5 files allowed per upload.');
    return;
  }

  // Check file sizes (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  const oversizedFiles = files.filter((f) => f.size > maxSize);
  if (oversizedFiles.length > 0) {
    alertWarning(`Some files exceed the 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
    return;
  }

  try {
    // Upload files one at a time to the project-specific endpoint
    // This ensures files are properly associated with the project in the database
    let successCount = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append('project_file', file);

      const response = await apiFetch(`/api/uploads/project/${currentProjectId}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        successCount++;
      } else {
        const error = await response.json();
        console.error(`Failed to upload ${file.name}:`, error.message);
      }
    }

    if (successCount > 0) {
      storedContext.showNotification(`${successCount} file(s) uploaded successfully`, 'success');
      // Refresh the files list to show newly uploaded files
      // Invalidate the cached DOM reference and reload
      domCache.invalidate('filesList');
      await loadProjectFiles(currentProjectId, storedContext);
    } else {
      throw new Error('All uploads failed');
    }
  } catch (error) {
    console.error('[AdminProjects] Upload error:', error);
    storedContext.showNotification(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
  }
}

// =====================================================
// ADD PROJECT (ADMIN MANUAL CREATION)
// =====================================================

interface ClientOption {
  id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
}

/**
 * Setup the add project button handler
 */
export function setupAddProjectButton(ctx: AdminDashboardContext): void {
  const addBtn = domCache.get('addProjectBtn');
  if (addBtn && !addBtn.dataset.listenerAdded) {
    addBtn.dataset.listenerAdded = 'true';
    addBtn.addEventListener('click', () => addProject(ctx));
  }
}

/**
 * Open the add project modal
 */
async function addProject(ctx: AdminDashboardContext): Promise<void> {
  const modal = domCache.get('addProjectModal');
  const form = domCache.getAs<HTMLFormElement>('addProjectForm');
  const closeBtn = domCache.get('addProjectClose');
  const cancelBtn = domCache.get('addProjectCancel');

  if (!modal || !form) return;

  // Reset form
  form.reset();

  // Hide new client fields by default
  const newClientFields = document.getElementById('new-client-fields');
  if (newClientFields) newClientFields.classList.add('hidden');

  // Load existing clients into dropdown
  await populateClientDropdown();

  // Initialize custom dropdowns for the modal (with onChange callback for client dropdown)
  initAddProjectModalDropdowns();

  // Show modal and lock body scroll
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  // Close handlers
  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    form.reset();
    // Reset dropdown values
    resetAddProjectDropdowns();
  };

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });

  // Form submit handler
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await handleAddProjectSubmit(ctx, closeModal);
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

/**
 * Initialize custom dropdowns for the add project modal
 */
function initAddProjectModalDropdowns(): void {
  // First, close any open dropdowns from previous modal session
  document.querySelectorAll('.custom-dropdown[data-modal-dropdown].open').forEach((el) => {
    el.classList.remove('open');
  });

  const clientSelect = document.getElementById('new-project-client') as HTMLSelectElement;
  const typeSelect = document.getElementById('new-project-type') as HTMLSelectElement;
  const budgetSelect = document.getElementById('new-project-budget') as HTMLSelectElement;
  const timelineSelect = document.getElementById('new-project-timeline') as HTMLSelectElement;

  // Client dropdown - with onChange to toggle new client fields
  if (clientSelect && !clientSelect.dataset.dropdownInit) {
    clientSelect.dataset.dropdownInit = 'true';
    initModalDropdown(clientSelect, {
      placeholder: 'Select existing client...',
      onChange: (value: string) => {
        // Toggle new client fields based on selection
        const newClientFields = document.getElementById('new-client-fields');
        if (!newClientFields) return;

        if (value === 'new') {
          newClientFields.classList.remove('hidden');
          const nameInput = document.getElementById('new-project-client-name') as HTMLInputElement;
          const emailInput = document.getElementById('new-project-client-email') as HTMLInputElement;
          if (nameInput) nameInput.required = true;
          if (emailInput) emailInput.required = true;
        } else {
          newClientFields.classList.add('hidden');
          const nameInput = document.getElementById('new-project-client-name') as HTMLInputElement;
          const emailInput = document.getElementById('new-project-client-email') as HTMLInputElement;
          if (nameInput) nameInput.required = false;
          if (emailInput) emailInput.required = false;
        }
      }
    });
  }

  // Project type dropdown
  if (typeSelect && !typeSelect.dataset.dropdownInit) {
    typeSelect.dataset.dropdownInit = 'true';
    initModalDropdown(typeSelect, { placeholder: 'Select type...' });
  }

  // Budget dropdown
  if (budgetSelect && !budgetSelect.dataset.dropdownInit) {
    budgetSelect.dataset.dropdownInit = 'true';
    initModalDropdown(budgetSelect, { placeholder: 'Select budget...' });
  }

  // Timeline dropdown
  if (timelineSelect && !timelineSelect.dataset.dropdownInit) {
    timelineSelect.dataset.dropdownInit = 'true';
    initModalDropdown(timelineSelect, { placeholder: 'Select timeline...' });
  }
}

/**
 * Reset dropdown values and close all dropdowns when modal closes
 */
function resetAddProjectDropdowns(): void {
  const clientSelect = document.getElementById('new-project-client') as HTMLSelectElement;
  const typeSelect = document.getElementById('new-project-type') as HTMLSelectElement;
  const budgetSelect = document.getElementById('new-project-budget') as HTMLSelectElement;
  const timelineSelect = document.getElementById('new-project-timeline') as HTMLSelectElement;

  // Reset each dropdown using setModalDropdownValue
  [clientSelect, typeSelect, budgetSelect, timelineSelect].forEach((select) => {
    if (select) {
      const wrapper = select.previousElementSibling as HTMLElement;
      if (wrapper?.classList.contains('custom-dropdown')) {
        // Close the dropdown if open
        wrapper.classList.remove('open');
        // Reset value
        setModalDropdownValue(wrapper, '');
      }
    }
  });
}

/**
 * Populate the client dropdown with existing clients
 */
async function populateClientDropdown(): Promise<void> {
  const clientSelect = document.getElementById('new-project-client') as HTMLSelectElement;
  if (!clientSelect) return;

  try {
    const response = await apiFetch('/api/clients');
    if (response.ok) {
      const data = await response.json();
      const clients: ClientOption[] = data.clients || [];

      // Clear existing options except first two
      while (clientSelect.options.length > 2) {
        clientSelect.remove(2);
      }

      // Add client options
      clients.forEach((client) => {
        const option = document.createElement('option');
        option.value = String(client.id);
        const displayName = client.contact_name || client.email;
        const company = client.company_name ? ` (${client.company_name})` : '';
        option.textContent = `${displayName}${company}`;
        clientSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load clients for dropdown:', error);
  }
}

/**
 * Get input value by ID
 */
function getInputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  return el?.value?.trim() || '';
}

/**
 * Handle add project form submission
 */
async function handleAddProjectSubmit(
  ctx: AdminDashboardContext,
  closeModal: () => void
): Promise<void> {
  const clientId = getInputValue('new-project-client');
  const isNewClient = clientId === 'new';

  // Validate required fields
  if (!clientId) {
    ctx.showNotification('Please select a client', 'error');
    return;
  }

  const projectType = getInputValue('new-project-type');
  const description = getInputValue('new-project-description');
  const budget = getInputValue('new-project-budget');
  const timeline = getInputValue('new-project-timeline');

  if (!projectType || !description || !budget || !timeline) {
    ctx.showNotification('Please fill in all required fields', 'error');
    return;
  }

  // Gather project data
  const projectData: {
    newClient: {
      name: string;
      email: string;
      company: string;
      phone: string;
    } | null;
    clientId: number | null;
    projectType: string;
    description: string;
    budget: string;
    timeline: string;
    notes: string;
  } = {
    newClient: isNewClient ? {
      name: getInputValue('new-project-client-name'),
      email: getInputValue('new-project-client-email'),
      company: getInputValue('new-project-client-company'),
      phone: getInputValue('new-project-client-phone')
    } : null,
    clientId: isNewClient ? null : parseInt(clientId),
    projectType,
    description,
    budget,
    timeline,
    notes: getInputValue('new-project-notes')
  };

  // Validate new client fields if creating new client
  if (isNewClient) {
    if (!projectData.newClient?.name || !projectData.newClient?.email) {
      ctx.showNotification('Client name and email are required', 'error');
      return;
    }
  }

  try {
    const response = await apiPost('/api/admin/projects', projectData);

    if (response.ok) {
      const result = await response.json();
      ctx.showNotification('Project created successfully', 'success');
      closeModal();
      await loadProjects(ctx);

      // Optionally navigate to the new project
      if (result.projectId) {
        showProjectDetails(result.projectId, ctx);
      }
    } else {
      const error = await response.json();
      ctx.showNotification(error.error || 'Failed to create project', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error creating project:', error);
    ctx.showNotification('Error creating project', 'error');
  }
}
