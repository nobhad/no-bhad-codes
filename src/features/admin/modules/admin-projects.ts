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
import { formatFileSize } from '../../../utils/format-utils';
import { initModalDropdown, setModalDropdownValue } from '../../../utils/modal-dropdown';
import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
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
  editCancel: '#edit-project-cancel'
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
 * Format budget/timeline values with proper capitalization
 */
function formatDisplayValue(value: string | undefined | null): string {
  if (!value || value === '-') return '-';

  // Handle special cases first
  const lowerValue = value.toLowerCase();

  // ASAP should be all caps
  if (lowerValue === 'asap') return 'ASAP';

  // Budget ranges: "under-1k" -> "Under 1k", "1000-2500" -> "$1,000-$2,500"
  if (lowerValue.includes('under')) {
    return value.replace(/under-?/gi, 'Under ').replace(/-/g, '');
  }

  // Replace hyphens with spaces and capitalize each word
  let formatted = value.replace(/-/g, ' ');
  formatted = formatted.replace(/\b\w/g, (char) => char.toUpperCase());

  return formatted;
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
}

function renderProjectsTable(projects: LeadProject[], ctx: AdminDashboardContext): void {
  const tableBody = domCache.get('tableBody');
  if (!tableBody) return;

  if (projects.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="loading-row">No projects yet. Convert leads to start projects.</td></tr>';
    return;
  }

  // Apply filters
  const filteredProjects = applyFilters(projects, filterState, PROJECTS_FILTER_CONFIG);

  if (filteredProjects.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No projects match the current filters</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredProjects
    .map((project) => {
      const safeName = SanitizationUtils.escapeHtml(
        project.project_name || project.description?.substring(0, 30) || 'Untitled Project'
      );
      const safeContact = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(project.contact_name || '-'));
      const safeCompany = project.company_name ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(project.company_name)) : '';
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
  batchUpdateText({
    'pd-project-name': SanitizationUtils.escapeHtml(project.project_name || 'Untitled Project'),
    'pd-client-name': SanitizationUtils.escapeHtml(project.contact_name || '-'),
    'pd-client-email': SanitizationUtils.escapeHtml(project.email || '-'),
    'pd-company': SanitizationUtils.escapeHtml(project.company_name || '-'),
    'pd-type': SanitizationUtils.escapeHtml(formatProjectType(project.project_type)),
    'pd-budget': SanitizationUtils.escapeHtml(formatDisplayValue(project.budget_range)),
    'pd-price': SanitizationUtils.escapeHtml(projectData.price || '-'),
    'pd-timeline': SanitizationUtils.escapeHtml(formatDisplayValue(project.timeline)),
    'pd-start-date': SanitizationUtils.escapeHtml(project.created_at ? new Date(project.created_at).toLocaleDateString() : '-')
  });

  // Preview URL (use cached ref)
  const previewUrlLink = domCache.getAs<HTMLAnchorElement>('previewUrlLink');
  if (previewUrlLink) {
    const previewUrl = projectData.preview_url || '';
    if (previewUrl) {
      previewUrlLink.href = previewUrl;
      previewUrlLink.textContent = previewUrl;
    } else {
      previewUrlLink.href = '#';
      previewUrlLink.textContent = '-';
      previewUrlLink.onclick = (e) => e.preventDefault();
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

  // Description (use cached ref)
  const descriptionEl = domCache.get('description');
  if (descriptionEl) {
    descriptionEl.textContent = project.description || '-';
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
  const budgetInput = document.getElementById('edit-project-budget') as HTMLInputElement;
  const priceInput = document.getElementById('edit-project-price') as HTMLInputElement;
  const timelineInput = document.getElementById('edit-project-timeline') as HTMLInputElement;
  const previewUrlInput = document.getElementById('edit-project-preview-url') as HTMLInputElement;

  if (nameInput) nameInput.value = project.project_name || '';
  if (budgetInput) budgetInput.value = formatDisplayValue(project.budget_range);
  if (priceInput) priceInput.value = projectData.price || '';
  if (timelineInput) timelineInput.value = formatDisplayValue(project.timeline);
  if (previewUrlInput) previewUrlInput.value = projectData.preview_url || '';

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
  const typeSelect = document.getElementById('edit-project-type') as HTMLSelectElement;
  const budgetInput = document.getElementById('edit-project-budget') as HTMLInputElement;
  const priceInput = document.getElementById('edit-project-price') as HTMLInputElement;
  const timelineInput = document.getElementById('edit-project-timeline') as HTMLInputElement;
  const previewUrlInput = document.getElementById('edit-project-preview-url') as HTMLInputElement;
  const statusSelect = document.getElementById('edit-project-status') as HTMLSelectElement;

  const updates: Record<string, string> = {};
  if (nameInput?.value) updates.project_name = nameInput.value;
  if (typeSelect?.value) updates.project_type = typeSelect.value;
  if (budgetInput?.value) updates.budget = budgetInput.value;
  if (priceInput?.value) updates.price = priceInput.value;
  if (timelineInput?.value) updates.timeline = timelineInput.value;
  if (previewUrlInput?.value !== undefined) updates.preview_url = previewUrlInput.value;
  if (statusSelect?.value) updates.status = statusSelect.value;

  try {
    const response = await apiPut(`/api/projects/${projectId}`, updates);

    if (response.ok) {
      storedContext.showNotification('Project updated successfully', 'success');
      // Reload projects and refresh view
      await loadProjects(storedContext);
      const project = projectsData.find((p) => p.id === projectId);
      if (project) {
        populateProjectDetailView(project);
      }
    } else {
      const error = await response.json();
      storedContext.showNotification(error.message || 'Failed to update project', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error saving project:', error);
    storedContext.showNotification('Failed to update project', 'error');
  }
}

function setupProjectDetailTabs(ctx: AdminDashboardContext): void {
  const tabBtns = document.querySelectorAll('.pd-tab-btn');
  const tabContents = document.querySelectorAll('.pd-tab-content');

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
  if (!type) return '-';
  return type
    .split('_')
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
  const container = domCache.get('filesList');
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
      const size = formatFileSize(file.size);
      const date = new Date(file.created_at).toLocaleDateString();

      return `
              <tr>
                <td>${safeName}</td>
                <td>${size}</td>
                <td>${date}</td>
                <td>
                  <a href="/uploads/${file.filename}" class="action-btn" download="${safeName}" aria-label="Download ${safeName}">Download</a>
                </td>
              </tr>
            `;
    })
    .join('')}
      </tbody>
    </table>
  `;
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
    fetch(`/api/projects/${currentProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ progress })
    }).catch((err) => console.error('[AdminProjects] Error saving progress:', err));
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
function showCreateInvoicePrompt(): void {
  if (!currentProjectId || !storedContext) return;

  const project = projectsData.find((p) => p.id === currentProjectId) as any;
  if (!project) return;

  const description = prompt('Enter line item description:', 'Web Development Services');
  if (!description) return;

  const amountStr = prompt('Enter amount ($):', '1000');
  if (!amountStr) return;

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  createInvoice(project.client_id || project.id, description, amount);
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
function showAddMilestonePrompt(): void {
  if (!currentProjectId || !storedContext) return;

  const title = prompt('Enter milestone title:');
  if (!title) return;

  const description = prompt('Enter milestone description (optional):', '');
  const dueDateStr = prompt('Enter due date (YYYY-MM-DD):', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  if (!dueDateStr) return;

  addMilestone(title, description || '', dueDateStr);
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
    alert('Maximum 5 files allowed per upload.');
    return;
  }

  // Check file sizes (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  const oversizedFiles = files.filter((f) => f.size > maxSize);
  if (oversizedFiles.length > 0) {
    alert(`Some files exceed the 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
    return;
  }

  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('projectId', String(currentProjectId));

    const response = await apiFetch('/api/uploads/multiple', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    storedContext.showNotification(`${files.length} file(s) uploaded successfully`, 'success');
    loadProjectFiles(currentProjectId, storedContext);
  } catch (error) {
    console.error('[AdminProjects] Upload error:', error);
    storedContext.showNotification(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
  }
}
