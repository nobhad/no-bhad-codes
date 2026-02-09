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
import {
  formatFileSize,
  formatDisplayValue,
  formatTextWithLineBreaks,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatProjectType
} from '../../../utils/format-utils';
import { initModalDropdown } from '../../../utils/modal-dropdown';
import { createFilterSelect, type FilterSelectInstance } from '../../../components/filter-select';
import { createTableDropdown, PROJECT_STATUS_OPTIONS } from '../../../utils/table-dropdown';
import { createModalDropdown } from '../../../components/modal-dropdown';
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
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { getStatusDotHTML } from '../../../components/status-badge';
import { createDOMCache, batchUpdateText } from '../../../utils/dom-cache';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { alertWarning, multiPromptDialog, confirmDanger } from '../../../utils/confirm-dialog';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { createRowCheckbox, createBulkActionToolbar, setupBulkSelectionHandlers, resetSelection, type BulkActionConfig } from '../../../utils/table-bulk-actions';
import {
  createPaginationUI,
  applyPagination,
  getDefaultPaginationState,
  loadPaginationState,
  savePaginationState,
  type PaginationState,
  type PaginationConfig
} from '../../../utils/table-pagination';
import { exportToCsv, PROJECTS_EXPORT_CONFIG } from '../../../utils/table-export';
import { deleteProject, archiveProject, duplicateProject } from '../project-details/actions';
import { setupFileUploadHandlers, loadPendingRequestsDropdown, loadProjectFiles as loadProjectFilesFromModule } from '../project-details';
import { createSecondarySidebar, SECONDARY_TAB_ICONS, type SecondarySidebarController } from '../../../components/secondary-sidebar';
import { createPortalModal } from '../../../components/portal-modal';

// ============================================
// UTILITY HELPERS
// ============================================

/**
 * Parse a numeric value that might have commas or other formatting
 * Handles: "4,500", "4500", "$4,500", etc.
 */
function parseNumericValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // Remove commas, currency symbols, and whitespace, then parse
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

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
  client_id?: number;
  client_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  project_type?: string;
  budget_range?: string;
  budget?: number;
  timeline?: string;
  status: 'pending' | 'active' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  description?: string;
  features?: string;
  progress?: number;
  notes?: string;
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
    'on-hold': number;
  };
}

let projectsData: LeadProject[] = [];
let currentProjectId: number | null = null;
let storedContext: AdminDashboardContext | null = null;
let secondarySidebar: SecondarySidebarController | null = null;
let filterState: FilterState = loadFilterState(PROJECTS_FILTER_CONFIG.storageKey);
let filterUIInitialized = false;

// Pagination configuration and state
const PROJECTS_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'projects',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_projects_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(PROJECTS_PAGINATION_CONFIG),
  ...loadPaginationState(PROJECTS_PAGINATION_CONFIG.storageKey!)
};

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
    showTableLoading(tableBody, 9, 'Loading projects...');
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
  // Insert before export button (Search → Filter → Export → Refresh → Add order)
  const exportBtn = container.querySelector('#export-projects-btn');
  if (exportBtn) {
    container.insertBefore(filterUI, exportBtn);
    // Wire up export button click handler
    exportBtn.addEventListener('click', () => {
      const filteredData = applyFilters(projectsData, filterState, PROJECTS_FILTER_CONFIG);
      if (filteredData.length === 0) {
        showToast('No projects to export', 'warning');
        return;
      }
      exportToCsv(filteredData as unknown as Record<string, unknown>[], PROJECTS_EXPORT_CONFIG);
      showToast(`Exported ${filteredData.length} projects to CSV`, 'success');
    });
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

  // Create bulk action toolbar (selection count + Clear; no bulk API yet)
  const bulkToolbarEl = document.getElementById('projects-bulk-toolbar');
  if (bulkToolbarEl) {
    const toolbar = createBulkActionToolbar({
      tableId: 'projects',
      actions: []
    });
    bulkToolbarEl.replaceWith(toolbar);
  }
}

function updateProjectsDisplay(data: ProjectsData, ctx: AdminDashboardContext): void {
  const projects = (data.leads || []).filter(
    (p) => normalizeStatus(p.status) !== 'pending' || p.project_name
  );

  // Calculate stats
  const activeCount = projects.filter(
    (p) => normalizeStatus(p.status) === 'active' || normalizeStatus(p.status) === 'in-progress'
  ).length;
  const completedCount = projects.filter((p) => normalizeStatus(p.status) === 'completed').length;
  const onHoldCount = projects.filter((p) => normalizeStatus(p.status) === 'on-hold').length;

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
    showTableEmpty(tableBody, 8, 'No projects yet.');
    renderPaginationUI(0, ctx);
    return;
  }

  // Apply filters
  const filteredProjects = applyFilters(projects, filterState, PROJECTS_FILTER_CONFIG);

  if (filteredProjects.length === 0) {
    showTableEmpty(tableBody, 8, 'No projects match the current filters.');
    renderPaginationUI(0, ctx);
    return;
  }

  // Update pagination state with total items
  paginationState.totalItems = filteredProjects.length;

  // Apply pagination
  const paginatedProjects = applyPagination(filteredProjects, paginationState);

  // Reset bulk selection when data changes
  resetSelection('projects');

  // Clear and rebuild table with dropdown containers
  tableBody.innerHTML = '';

  paginatedProjects.forEach((project) => {
    // Decode HTML entities first (data may have &amp; stored), then escape for safe HTML output
    const safeName = SanitizationUtils.escapeHtml(
      SanitizationUtils.decodeHtmlEntities(project.project_name || project.description?.substring(0, 30) || 'Untitled Project')
    );
    const safeContact = SanitizationUtils.escapeHtml(
      SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(project.contact_name || ''))
    );
    const safeCompany = project.company_name
      ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(project.company_name)))
      : '';
    // Normalize status to hyphen format for consistency
    const status = normalizeStatus(project.status);

    const row = document.createElement('tr');
    row.dataset.projectId = String(project.id);
    row.className = 'clickable-row';

    // Standard column order: ☐ | Project (+Client) | Type | Status | Budget | Timeline | Start | Target | Actions
    row.innerHTML = `
      ${createRowCheckbox('projects', project.id)}
      <td class="identity-cell">
        <span class="identity-name">${safeName}</span>
        ${(safeContact || safeCompany) ? `<span class="identity-contact">${safeContact}${safeCompany ? ` - ${safeCompany}` : ''}</span>` : ''}
        <span class="type-budget-stacked">${formatProjectType(project.project_type)} · ${formatDisplayValue(project.budget_range)}</span>
      </td>
      <td class="type-cell">
        <span class="type-value">${formatProjectType(project.project_type)}</span>
        <span class="budget-stacked">${formatDisplayValue(project.budget_range)}</span>
      </td>
      <td class="status-cell"></td>
      <td class="budget-cell">
        <span class="budget-value">${formatDisplayValue(project.budget_range)}</span>
        <span class="timeline-stacked">${formatDisplayValue(project.timeline)}</span>
      </td>
      <td class="timeline-cell">${formatDisplayValue(project.timeline)}</td>
      <td class="date-cell start-cell">
        <span class="date-value">${formatDate(project.start_date)}</span>
        <span class="target-stacked">${formatDate(project.end_date)}</span>
      </td>
      <td class="date-cell target-cell">${formatDate(project.end_date)}</td>
      <td class="actions-cell">
        <div class="table-actions">
          <button class="icon-btn btn-view-project" data-project-id="${project.id}" title="View Project" aria-label="View project details">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </td>
    `;

    // Create status dropdown
    const statusCell = row.querySelector('.status-cell');
    if (statusCell) {
      const dropdown = createTableDropdown({
        options: PROJECT_STATUS_OPTIONS,
        currentValue: status,
        onChange: async (newStatus) => {
          await updateProjectStatus(project.id, newStatus, ctx);
          project.status = newStatus as LeadProject['status'];
        }
      });
      statusCell.appendChild(dropdown);
    }

    // Add click handler for row (excluding status cell, checkbox, and actions)
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.table-dropdown') || target.closest('.bulk-select-cell') || target.closest('.actions-cell') || target.tagName === 'INPUT') return;
      showProjectDetails(project.id, ctx);
    });

    // Add click handler for view button
    const viewBtn = row.querySelector('.btn-view-project');
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProjectDetails(project.id, ctx);
      });
    }

    tableBody.appendChild(row);
  });

  // Setup bulk selection handlers
  const projectsBulkConfig: BulkActionConfig = {
    tableId: 'projects',
    actions: []
  };
  const allRowIds = paginatedProjects.map(p => p.id);
  setupBulkSelectionHandlers(projectsBulkConfig, allRowIds);

  // Render pagination
  renderPaginationUI(filteredProjects.length, ctx);
}

/**
 * Render pagination UI for projects table
 */
function renderPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('projects-pagination');
  if (!container) return;

  // Update state
  paginationState.totalItems = totalItems;

  // Create pagination UI
  const paginationUI = createPaginationUI(
    PROJECTS_PAGINATION_CONFIG,
    paginationState,
    (newState) => {
      paginationState = newState;
      savePaginationState(PROJECTS_PAGINATION_CONFIG.storageKey!, paginationState);
      // Re-render table with new pagination
      if (projectsData.length > 0) {
        renderProjectsTable(projectsData, ctx);
      }
    }
  );

  // Replace container content
  container.innerHTML = '';
  container.appendChild(paginationUI);
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

/**
 * Project detail tabs configuration for secondary sidebar
 */
const PROJECT_DETAIL_TABS = [
  { id: 'overview', icon: SECONDARY_TAB_ICONS.OVERVIEW, label: 'Overview' },
  { id: 'files', icon: SECONDARY_TAB_ICONS.FILES, label: 'Files' },
  { id: 'messages', icon: SECONDARY_TAB_ICONS.MESSAGES, label: 'Messages' },
  { id: 'invoices', icon: SECONDARY_TAB_ICONS.INVOICES, label: 'Invoices' },
  { id: 'tasks', icon: SECONDARY_TAB_ICONS.TASKS, label: 'Tasks' },
  { id: 'time', icon: SECONDARY_TAB_ICONS.TIMELINE, label: 'Time' },
  { id: 'contract', icon: SECONDARY_TAB_ICONS.CONTRACT, label: 'Contract' }
];

/**
 * Initialize secondary sidebar for project detail view
 */
function initSecondarySidebar(projectName: string): void {
  // Clean up existing sidebar if any
  cleanupSecondarySidebar();

  const container = document.querySelector('.dashboard-container');
  const mountPoint = document.getElementById('secondary-sidebar');
  const horizontalMountPoint = document.getElementById('secondary-tabs-horizontal');

  if (!mountPoint || !horizontalMountPoint) {
    console.warn('[AdminProjects] Secondary sidebar mount points not found');
    return;
  }

  // Add class to show secondary sidebar
  container?.classList.add('has-secondary-sidebar');

  // Get current active tab from horizontal tabs
  const activeHorizontalTab = document.querySelector('.project-detail-tabs button.active') as HTMLElement;
  const activeTabId = activeHorizontalTab?.dataset.pdTab || 'overview';

  // Truncate project name for sidebar title
  const truncatedName = projectName.length > 20 ? `${projectName.slice(0, 18)}...` : projectName;

  // Create secondary sidebar
  secondarySidebar = createSecondarySidebar({
    tabs: PROJECT_DETAIL_TABS,
    activeTab: activeTabId,
    title: truncatedName,
    onBack: () => storedContext?.switchTab('projects'),
    persistState: true,
    container: container as HTMLElement,
    onTabChange: (tabId) => handleSecondaryTabChange(tabId)
  });

  // Mount the sidebar and horizontal tabs
  mountPoint.innerHTML = '';
  mountPoint.appendChild(secondarySidebar.getElement());

  horizontalMountPoint.innerHTML = '';
  horizontalMountPoint.appendChild(secondarySidebar.getHorizontalTabs());
}

/**
 * Handle tab change from secondary sidebar
 */
function handleSecondaryTabChange(tabId: string): void {
  // Find and click the corresponding horizontal tab button
  const tabBtn = document.querySelector(`.project-detail-tabs button[data-pd-tab="${tabId}"]`) as HTMLButtonElement;
  if (tabBtn) {
    tabBtn.click();
  }
}

/**
 * Clean up secondary sidebar when leaving project detail view
 */
function cleanupSecondarySidebar(): void {
  if (secondarySidebar) {
    secondarySidebar.destroy();
    secondarySidebar = null;
  }

  // Remove has-secondary-sidebar class
  const container = document.querySelector('.dashboard-container');
  container?.classList.remove('has-secondary-sidebar');

  // Clear mount points
  const mountPoint = document.getElementById('secondary-sidebar');
  const horizontalMountPoint = document.getElementById('secondary-tabs-horizontal');
  if (mountPoint) mountPoint.innerHTML = '';
  if (horizontalMountPoint) horizontalMountPoint.innerHTML = '';
}

/**
 * Get the current project name for breadcrumbs
 */
export function getCurrentProjectName(): string | null {
  if (!currentProjectId) return null;
  const project = projectsData.find((p) => p.id === currentProjectId);
  return project?.project_name ?? null;
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
  loadProjectSidebarStats(projectId);

  // Setup file upload with confirmation modal
  loadPendingRequestsDropdown(projectId);
  setupFileUploadHandlers(projectId, () => {
    loadProjectFiles(projectId, ctx);
    loadProjectFilesFromModule(projectId);
  });
}

function populateProjectDetailView(project: LeadProject): void {
  const titleEl = domCache.get('detailTitle');
  if (titleEl) titleEl.textContent = 'Project Details';

  const projectData = project as any;

  // Overview fields - use batch update for text content
  // Note: textContent doesn't interpret HTML, so we decode entities but don't need to escape
  // Empty string for missing values (no dashes). Client email uses innerHTML for copy button.
  const formattedBudget = formatDisplayValue(project.budget_range);
  const formattedStartDate = formatDate(projectData.start_date || project.created_at);
  const formattedEndDate = formatDate(projectData.end_date);
  const formattedType = formatProjectType(project.project_type);

  batchUpdateText({
    'pd-project-name': SanitizationUtils.decodeHtmlEntities(project.project_name || 'Untitled Project'),
    'pd-client-name': SanitizationUtils.decodeHtmlEntities(project.contact_name || ''),
    'pd-company': SanitizationUtils.decodeHtmlEntities(project.company_name || ''),
    'pd-type': formattedType,
    'pd-budget': formattedBudget,
    'pd-price': projectData.price ? formatCurrency(parseNumericValue(projectData.price)) : '',
    'pd-timeline': formatDisplayValue(project.timeline),
    'pd-start-date': formattedStartDate,
    'pd-end-date': formattedEndDate,
    'pd-deposit': projectData.deposit_amount ? formatCurrency(parseNumericValue(projectData.deposit_amount)) : '',
    'pd-contract-date': formatDate(projectData.contract_signed_date),
    // Header card elements
    'pd-header-client-name': SanitizationUtils.decodeHtmlEntities(project.contact_name || ''),
    'pd-header-company': SanitizationUtils.decodeHtmlEntities(project.company_name || ''),
    'pd-header-email': SanitizationUtils.decodeHtmlEntities(project.email || ''),
    'pd-header-type': formattedType,
    'pd-header-start': formattedStartDate,
    'pd-header-end': formattedEndDate,
    'pd-header-budget': formattedBudget,
    // Sidebar financial elements
    'pd-sidebar-budget': formattedBudget
  });

  // Hide company row in header if no company
  const companyRow = document.getElementById('pd-header-company-row');
  if (companyRow) {
    companyRow.style.display = project.company_name ? '' : 'none';
  }

  // Client email with copy button (innerHTML, not batchUpdateText)
  const pdClientEmailEl = document.getElementById('pd-client-email');
  if (pdClientEmailEl) pdClientEmailEl.innerHTML = getEmailWithCopyHtml(project.email || '', SanitizationUtils.escapeHtml(project.email || ''));

  // Update URL links (preview, repo, production) - new format uses pd-url-link class
  const updateUrlLink = (linkId: string, url: string | null): void => {
    const link = document.getElementById(linkId) as HTMLAnchorElement;
    if (!link) return;
    const decodedUrl = url ? SanitizationUtils.decodeHtmlEntities(url) : null;

    // Handle old format with .url-link-text
    const textEl = link.querySelector<HTMLElement>('.url-link-text');
    if (textEl) {
      if (decodedUrl) {
        link.href = decodedUrl;
        link.onclick = null;
        textEl.textContent = decodedUrl;
      } else {
        link.href = '#';
        link.onclick = (e) => e.preventDefault();
        textEl.textContent = '';
      }
    } else {
      // New format - just set href, CSS hides if href="#"
      if (decodedUrl) {
        link.href = decodedUrl;
        link.style.display = '';
      } else {
        link.href = '#';
        link.style.display = 'none';
      }
    }
  };

  updateUrlLink('pd-preview-url-link', projectData.preview_url);
  updateUrlLink('pd-repo-url-link', projectData.repo_url);
  updateUrlLink('pd-production-url-link', projectData.production_url);

  // Hide URLs section if no URLs
  const urlsSection = document.getElementById('pd-urls-section');
  if (urlsSection) {
    const hasUrls = projectData.preview_url || projectData.repo_url || projectData.production_url;
    urlsSection.style.display = hasUrls ? '' : 'none';
  }

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
  const clickableClients = ['pd-client-link', 'pd-company-link', 'pd-email-link', 'pd-header-client-link'];

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

  // Setup edit button in header card
  const headerEditBtn = document.getElementById('pd-btn-edit');
  if (headerEditBtn) {
    const newHeaderEditBtn = headerEditBtn.cloneNode(true) as HTMLElement;
    headerEditBtn.parentNode?.replaceChild(newHeaderEditBtn, headerEditBtn);
    newHeaderEditBtn.addEventListener('click', () => openEditProjectModal(project));
  }

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

/** Cleanup for edit modal focus trap */
let editModalFocusCleanup: (() => void) | null = null;

function closeEditProjectModal(): void {
  const modal = domCache.get('editModal');
  if (!modal) return;
  editModalFocusCleanup?.();
  editModalFocusCleanup = null;
  modal.removeAttribute('aria-labelledby');
  modal.removeAttribute('role');
  modal.removeAttribute('aria-modal');
  closeModalOverlay(modal);
}

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
  // URL fields - decode HTML entities in case they were double-encoded
  if (previewUrlInput) previewUrlInput.value = SanitizationUtils.decodeHtmlEntities(projectData.preview_url || '');
  if (repoUrlInput) repoUrlInput.value = SanitizationUtils.decodeHtmlEntities(projectData.repo_url || '');
  if (productionUrlInput) productionUrlInput.value = SanitizationUtils.decodeHtmlEntities(projectData.production_url || '');
  // Admin notes field - decode entities
  if (notesInput) notesInput.value = SanitizationUtils.decodeHtmlEntities(projectData.notes || '');

  // Setup close handlers and create dropdown elements (only once per modal lifecycle)
  // Must be called BEFORE initProjectModalDropdowns so the select elements exist
  setupEditProjectModalHandlers(modal);

  // Initialize custom dropdowns with current project values
  initProjectModalDropdowns(project);

  // Show modal and lock body scroll
  openModalOverlay(modal);

  // Focus trap and ARIA
  editModalFocusCleanup?.();
  modal.setAttribute('aria-labelledby', 'edit-project-modal-title');
  editModalFocusCleanup = manageFocusTrap(modal, {
    initialFocus: '#edit-project-name',
    onClose: closeEditProjectModal
  });
}

/**
 * Project type options for edit modal
 */
const EDIT_PROJECT_TYPE_OPTIONS = [
  { value: '', label: 'Select type...' },
  { value: 'simple-site', label: 'Simple Website' },
  { value: 'business-site', label: 'Business Website' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web Application' },
  { value: 'browser-extension', label: 'Browser Extension' },
  { value: 'other', label: 'Other' }
];

/**
 * Project status options for edit modal
 */
const EDIT_PROJECT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'in-review', label: 'In Review' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

/**
 * Initialize custom dropdowns for the edit project modal.
 * Uses createModalDropdown for modal-specific styling (48px height, form field bg).
 */
export function initProjectModalDropdowns(project: LeadProject): void {
  const typeMount = document.getElementById('edit-project-type-mount');
  const statusMount = document.getElementById('edit-project-status-mount');

  // Type dropdown: modal dropdown with placeholder
  if (typeMount) {
    typeMount.innerHTML = '';
    const typeDropdown = createModalDropdown({
      options: EDIT_PROJECT_TYPE_OPTIONS,
      currentValue: project.project_type || '',
      ariaLabelPrefix: 'Project type',
      placeholder: 'Select type...'
    });
    typeMount.appendChild(typeDropdown);
  }

  // Status dropdown: modal dropdown
  if (statusMount) {
    const currentStatus = normalizeStatus(project.status);
    statusMount.innerHTML = '';
    const statusDropdown = createModalDropdown({
      options: EDIT_PROJECT_STATUS_OPTIONS,
      currentValue: currentStatus,
      ariaLabelPrefix: 'Status'
    });
    statusMount.appendChild(statusDropdown);
  }
}

/**
 * Setup modal close and form handlers (only attach once)
 */
let editProjectModalInitialized = false;

export function setupEditProjectModalHandlers(modal: HTMLElement): void {
  if (editProjectModalInitialized) return;
  editProjectModalInitialized = true;

  // Type dropdown is now created in initProjectModalDropdowns with createTableDropdown
  // Status is created in initProjectModalDropdowns with createTableDropdown (same as table)

  const closeBtn = domCache.get('editClose');
  const cancelBtn = domCache.get('editCancel');
  const form = domCache.getAs<HTMLFormElement>('editForm');

  closeBtn?.addEventListener('click', closeEditProjectModal);
  cancelBtn?.addEventListener('click', closeEditProjectModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEditProjectModal();
  });

  // Handle form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editingProjectId !== null) {
        await saveProjectChanges(editingProjectId);
        closeEditProjectModal();
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
  const typeMount = document.getElementById('edit-project-type-mount');
  const typeValue = typeMount?.querySelector('.modal-dropdown')?.getAttribute('data-value') ?? '';
  const budgetInput = document.getElementById('edit-project-budget') as HTMLInputElement;
  const priceInput = document.getElementById('edit-project-price') as HTMLInputElement;
  const timelineInput = document.getElementById('edit-project-timeline') as HTMLInputElement;
  const statusMount = document.getElementById('edit-project-status-mount');
  const statusValue = statusMount?.querySelector('.modal-dropdown')?.getAttribute('data-value') ?? '';
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
  if (typeValue) updates.project_type = typeValue;
  if (budgetInput?.value) updates.budget = budgetInput.value;
  // Strip commas from numeric fields before saving
  if (priceInput?.value) updates.price = priceInput.value.replace(/,/g, '');
  if (timelineInput?.value) updates.timeline = timelineInput.value;
  if (statusValue) updates.status = statusValue;
  // Allow clearing dates by sending empty string
  if (startDateInput) updates.start_date = startDateInput.value || '';
  if (endDateInput) updates.end_date = endDateInput.value || '';
  // Deposit and contract date (allow clearing) - strip commas from deposit
  if (depositInput) updates.deposit_amount = (depositInput.value || '').replace(/,/g, '');
  if (contractDateInput) updates.contract_signed_date = contractDateInput.value || '';
  // URL fields (allow clearing)
  if (previewUrlInput) updates.preview_url = previewUrlInput.value || '';
  if (repoUrlInput) updates.repo_url = repoUrlInput.value || '';
  if (productionUrlInput) updates.production_url = productionUrlInput.value || '';
  // Admin notes (allow clearing by sending empty string)
  if (notesInput) updates.admin_notes = notesInput.value || '';

  try {
    const response = await apiPut(`/api/projects/${projectId}`, updates);
    if (!response.ok) {
      storedContext.showNotification('Failed to update project. Please try again.', 'error');
      return;
    }
    const result = await response.json();

    if (result.project) {
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
      storedContext.showNotification('Failed to update project. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error saving project:', error);
    storedContext.showNotification('Failed to update project. Please try again.', 'error');
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

      // Sync secondary sidebar with horizontal tab
      if (secondarySidebar) {
        secondarySidebar.setActiveTab(tabName);
      }
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

  // Add Task button handler
  const btnAddTask = document.getElementById('btn-add-task');
  if (btnAddTask && !btnAddTask.dataset.listenerAdded) {
    btnAddTask.dataset.listenerAdded = 'true';
    btnAddTask.addEventListener('click', async () => {
      if (!currentProjectId) return;
      const { initTasksModule, showCreateTaskModal } = await import('./admin-tasks');
      await initTasksModule(currentProjectId);
      await showCreateTaskModal();
    });
  }

  // Send message handler (use cached ref)
  const sendMsgBtn = domCache.get('sendMsgBtn');
  if (sendMsgBtn && !sendMsgBtn.dataset.listenerAdded) {
    sendMsgBtn.dataset.listenerAdded = 'true';
    sendMsgBtn.addEventListener('click', () => sendProjectMessage());
  }

  // Note: File upload handlers are set up in admin-project-details.ts via setupFileUploadHandlers()

  // More menu (edit, duplicate, archive, delete)
  setupMoreMenu(ctx);
}

/**
 * Set up the more menu dropdown for project actions
 */
function setupMoreMenu(ctx: AdminDashboardContext): void {
  const moreMenu = document.getElementById('pd-more-menu');
  if (!moreMenu) return;

  const trigger = moreMenu.querySelector('.custom-dropdown-trigger') as HTMLElement;
  if (!trigger || trigger.dataset.listenerAdded === 'true') return;
  trigger.dataset.listenerAdded = 'true';

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    moreMenu.classList.toggle('open');
  });

  // Handle menu item clicks
  moreMenu.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.custom-dropdown-item') as HTMLElement | null;
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();
    const action = item.dataset.action;
    moreMenu.classList.remove('open');

    if (!currentProjectId || !action) return;

    const project = projectsData.find((p) => p.id === currentProjectId);
    if (!project) return;

    switch (action) {
    case 'edit':
      openEditProjectModal(project);
      break;
    case 'duplicate':
      await duplicateProject(
        currentProjectId,
        projectsData,
        () => loadProjects(ctx),
        (id) => showProjectDetails(id, ctx)
      );
      break;
    case 'archive':
      await archiveProject(
        currentProjectId,
        projectsData,
        () => loadProjects(ctx),
        (id) => showProjectDetails(id, ctx)
      );
      break;
    case 'delete':
      await deleteProject(currentProjectId, projectsData, () => {
        currentProjectId = null;
        ctx.switchTab('projects');
      });
      break;
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!moreMenu.contains(e.target as Node)) {
      moreMenu.classList.remove('open');
    }
  });

  // Keyboard support: Escape to close, Enter/Space to toggle
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      moreMenu.classList.remove('open');
      trigger.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      moreMenu.classList.toggle('open');
    }
  });

  // Close on Escape when focus is in the menu
  moreMenu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      moreMenu.classList.remove('open');
      trigger.focus();
    }
  });
}

// NOTE: formatProjectType moved to shared format-utils.ts

/**
 * Normalize status value to hyphen format to match database.
 * Legacy data may have underscores, convert to hyphens for consistency.
 */
function normalizeStatus(status: string | undefined): string {
  if (!status) return 'pending';
  return status.replace(/_/g, '-');
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
      const time = formatDateTime(msg.created_at);
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
      renderProjectFiles(data.files || [], container, projectId);
    } else {
      container.innerHTML = '<p class="empty-state">No files yet. Upload files in the Files tab.</p>';
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load files:', error);
    container.innerHTML = '<p class="empty-state">Failed to load files.</p>';
  }
}

function renderProjectFiles(files: ProjectFile[], container: HTMLElement, projectId: number): void {
  if (files.length === 0) {
    container.innerHTML = '<p class="empty-state">No files yet. Upload files in the Files tab.</p>';
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
      const storageFilename = file.filename || ''; // Actual filename on disk for intake detection
      // Use file_size or size (API returns both for compatibility)
      const fileSize = file.file_size || file.size || 0;
      const size = formatFileSize(fileSize);
      const date = formatDate(file.created_at);
      // Use API endpoint for file access (authenticated)
      const fileApiUrl = `/api/uploads/file/${file.id}`;
      const downloadUrl = `${fileApiUrl}?download=true`;
      // Check if file is previewable (by display name extension OR intake files by storage name)
      const isIntakeFile = /^(intake_|admin_project_)/i.test(storageFilename) && /\.json$/i.test(storageFilename);
      const isPreviewable = /\.(json|txt|md|png|jpg|jpeg|gif|webp|svg|pdf)$/i.test(safeName) || isIntakeFile;

      const previewBtn = isPreviewable
        ? `<button type="button" class="icon-btn btn-preview" data-file-id="${file.id}" data-file-url="${fileApiUrl}" data-file-name="${safeName}" data-storage-filename="${storageFilename}" aria-label="Preview ${safeName}" title="Preview"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>`
        : '';
      const downloadBtn = `<button type="button" class="icon-btn btn-download" data-file-url="${downloadUrl}" data-file-name="${safeName}" data-storage-filename="${storageFilename}" aria-label="Download ${safeName}" title="Download"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>`;
      const deleteBtn = `<button type="button" class="icon-btn icon-btn-danger btn-delete-file" data-file-id="${file.id}" data-file-name="${safeName}" aria-label="Delete ${safeName}" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
      return `
              <tr>
                <td data-label="File">${safeName}</td>
                <td data-label="Size">${size}</td>
                <td data-label="Uploaded">${date}</td>
                <td class="file-actions" data-label="Actions">
                  ${previewBtn}
                  ${downloadBtn}
                  ${deleteBtn}
                </td>
              </tr>
            `;
    })
    .join('')}
      </tbody>
    </table>
  `;

  // Add click handlers for preview buttons
  container.querySelectorAll('.btn-preview').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fileUrl = (btn as HTMLElement).dataset.fileUrl;
      const fileName = (btn as HTMLElement).dataset.fileName;
      const storageFilename = (btn as HTMLElement).dataset.storageFilename;
      if (fileUrl) {
        openFilePreview(fileUrl, fileName || 'File Preview', projectId, storageFilename);
      }
    });
  });

  // Add click handlers for download buttons
  container.querySelectorAll('.btn-download').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fileUrl = (btn as HTMLElement).dataset.fileUrl;
      const fileName = (btn as HTMLElement).dataset.fileName;
      const storageFilename = (btn as HTMLElement).dataset.storageFilename;
      if (fileUrl) {
        await downloadFile(fileUrl, fileName || 'download', projectId, storageFilename);
      }
    });
  });

  // Add click handlers for delete buttons
  container.querySelectorAll('.btn-delete-file').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fileId = (btn as HTMLElement).dataset.fileId;
      const fileName = (btn as HTMLElement).dataset.fileName || 'this file';
      if (!fileId) return;

      const confirmed = await confirmDanger(`Delete "${fileName}"? This action cannot be undone.`);
      if (!confirmed) return;

      try {
        const response = await apiFetch(`/api/uploads/file/${fileId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          showToast('File deleted', 'success');
          // Refresh the file list
          if (storedContext) {
            await loadProjectFiles(projectId, storedContext);
          }
        } else {
          showToast('Failed to delete file', 'error');
        }
      } catch (error) {
        console.error('[AdminProjects] Error deleting file:', error);
        showToast('Failed to delete file', 'error');
      }
    });
  });
}

/**
 * Download file using authenticated fetch
 * For intake files, downloads the PDF version instead of raw JSON
 */
/**
 * Extract filename from Content-Disposition header
 */
function getFilenameFromResponse(response: Response, fallback: string): string {
  const contentDisposition = response.headers.get('Content-Disposition');
  if (contentDisposition) {
    // Try to extract filename from header
    const match = contentDisposition.match(/filename[^;=\n]*=["']?([^"';\n]*)["']?/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  return fallback;
}

async function downloadFile(fileUrl: string, fileName: string, projectId?: number, storageFilename?: string): Promise<void> {
  try {
    // For intake files, download PDF instead of raw JSON
    const filenameToCheck = storageFilename || fileName;
    const isIntakeFile = /^(intake_|admin_project_|project_intake_|nobhadcodes_intake_)/i.test(filenameToCheck) && /\.json$/i.test(filenameToCheck);

    let response: Response;

    if (isIntakeFile && projectId) {
      // Download PDF version of intake file
      response = await apiFetch(`/api/projects/${projectId}/intake/pdf`);
    } else {
      response = await apiFetch(fileUrl);
    }

    if (!response.ok) throw new Error('Failed to download file');

    // Get filename from response header or use fallback
    const downloadName = getFilenameFromResponse(response, isIntakeFile ? fileName.replace(/\.json$/i, '.pdf') : fileName);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = downloadName;
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
 * @param storageFilename - The actual filename on disk (used for intake file detection)
 */
async function openFilePreview(fileUrl: string, fileName: string, projectId?: number, storageFilename?: string): Promise<void> {
  try {
    // For intake JSON files, open as branded PDF instead of raw JSON
    // Check storage filename (actual disk name) for intake pattern, fall back to display name
    const filenameToCheck = storageFilename || fileName;
    const isIntakeFile = /^(intake_|admin_project_|project_intake_|nobhadcodes_intake_)/i.test(filenameToCheck) && /\.json$/i.test(filenameToCheck);
    if (isIntakeFile && projectId) {
      // Open intake PDF directly - browser will use auth cookie
      // This allows proper filename in Content-Disposition header to work
      const pdfUrl = `/api/projects/${projectId}/intake/pdf`;
      window.open(pdfUrl, '_blank');
      return;
    }

    // For other JSON files, fetch and display in a modal
    if (/\.json$/i.test(fileName)) {
      const response = await apiFetch(fileUrl);
      if (!response.ok) throw new Error('Failed to load file');
      const data = await response.json();
      showJsonPreviewModal(data, fileName);
    } else if (/\.md$/i.test(fileName)) {
      // For markdown files, fetch and render as formatted markdown
      const response = await apiFetch(fileUrl);
      if (!response.ok) throw new Error('Failed to load file');
      const text = await response.text();
      showMarkdownPreviewModal(text, fileName);
    } else if (/\.txt$/i.test(fileName)) {
      // For plain text files, fetch and display as text
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

// ============================================
// PREVIEW MODAL - Unified modal for file previews
// ============================================

interface PreviewModalOptions {
  title: string;
  content: string;
  wide?: boolean;
  bodyClass?: string;
  onClose?: () => void;
}

// Store reference to active preview modal for cleanup
let activePreviewModal: ReturnType<typeof createPortalModal> | null = null;

/**
 * Show a preview modal with customizable content
 */
function showPreviewModal(options: PreviewModalOptions): void {
  const { title, content, wide = false, bodyClass = '', onClose } = options;

  // Clean up any existing preview modal
  if (activePreviewModal) {
    activePreviewModal.hide();
    activePreviewModal = null;
  }

  // Build content class name
  const contentClasses = ['file-preview-modal-content'];
  if (wide) contentClasses.push('file-preview-modal-content--wide');
  if (bodyClass) contentClasses.push(bodyClass);

  // Create modal using portal modal component
  const modal = createPortalModal({
    id: 'file-preview-modal',
    titleId: 'preview-modal-title',
    title: title,
    contentClassName: contentClasses.join(' '),
    onClose: () => {
      onClose?.();
      // Actually close the modal when X button is clicked
      if (activePreviewModal) {
        activePreviewModal.hide();
        activePreviewModal = null;
      }
    }
  });

  // Set body content
  modal.body.innerHTML = content;

  // Build footer with close button
  modal.footer.innerHTML = `
    <button class="btn btn-secondary" id="preview-modal-close-btn">Close</button>
  `;

  // Append to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();
  activePreviewModal = modal;

  // Event handlers
  modal.footer.querySelector('#preview-modal-close-btn')?.addEventListener('click', () => {
    onClose?.();
    modal.hide();
    activePreviewModal = null;
  });

  // Close on Escape key
  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose?.();
      modal.hide();
      activePreviewModal = null;
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Show JSON content in a preview modal
 */
function showJsonPreviewModal(data: unknown, fileName: string): void {
  const formattedJson = JSON.stringify(data, null, 2);

  showPreviewModal({
    title: fileName,
    content: `<pre class="file-preview-code">${SanitizationUtils.escapeHtml(formattedJson)}</pre>`
  });
}

/**
 * Simple markdown to HTML converter for file previews
 * Handles: headers, bold, italic, code blocks, inline code, lists, tables, links, horizontal rules
 */
function renderMarkdown(text: string): string {
  // Escape HTML first to prevent XSS, then apply markdown formatting
  let html = SanitizationUtils.escapeHtml(text);

  // Code blocks (must be done before other formatting to preserve content)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>');

  // Tables
  html = html.replace(/^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (_match, header, body) => {
    const headerCells = header.split('|').map((cell: string) => `<th>${cell.trim()}</th>`).join('');
    const bodyRows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((cell: string) => `<td>${cell.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="md-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="md-hr">');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="md-list">$&</ul>');

  // Line breaks (preserve paragraph structure)
  html = html.replace(/\n\n+/g, '</p><p class="md-paragraph">');
  html = `<p class="md-paragraph">${html}</p>`;

  // Clean up empty paragraphs and fix structure
  html = html.replace(/<p class="md-paragraph"><\/p>/g, '');
  html = html.replace(/<p class="md-paragraph">(<h[1-4])/g, '$1');
  html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
  html = html.replace(/<p class="md-paragraph">(<ul|<table|<pre|<hr)/g, '$1');
  html = html.replace(/(<\/ul>|<\/table>|<\/pre>)<\/p>/g, '$1');

  return html;
}

/**
 * Show text content in a preview modal
 */
function showTextPreviewModal(text: string, fileName: string): void {
  showPreviewModal({
    title: fileName,
    content: `<pre class="file-preview-code">${SanitizationUtils.escapeHtml(text)}</pre>`
  });
}

/**
 * Show markdown content in a preview modal with rendered formatting
 */
function showMarkdownPreviewModal(text: string, fileName: string): void {
  showPreviewModal({
    title: fileName,
    content: `<div class="md-preview">${renderMarkdown(text)}</div>`,
    wide: true,
    bodyClass: 'md-preview-body'
  });
}

/**
 * Show image in a preview modal
 */
function showImagePreviewModal(imageUrl: string, fileName: string): void {
  showPreviewModal({
    title: fileName,
    content: `<img class="file-preview-image" src="${imageUrl}" alt="${SanitizationUtils.escapeHtml(fileName)}" />`,
    wide: true,
    bodyClass: 'file-preview-modal-body',
    onClose: () => {
      // Revoke blob URL to free memory
      if (imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    }
  });
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
      container.innerHTML = '<p class="empty-state">No milestones yet. Add one to track progress.</p>';
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
    container.innerHTML = '<p class="empty-state">No milestones yet. Add one to track progress.</p>';
    return;
  }

  container.innerHTML = milestones
    .map((milestone) => {
      const safeTitle = SanitizationUtils.escapeHtml(milestone.title);
      const safeDesc = SanitizationUtils.escapeHtml(milestone.description || '');
      const dueDate = formatDate(milestone.due_date);

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

// Project Sidebar Stats
async function loadProjectSidebarStats(projectId: number): Promise<void> {
  try {
    // Fetch counts and financial data in parallel
    const [filesRes, messagesRes, tasksRes, invoicesRes] = await Promise.all([
      apiFetch(`/api/projects/${projectId}/files`),
      apiFetch(`/api/projects/${projectId}/messages`),
      apiFetch(`/api/projects/${projectId}/tasks`),
      apiFetch(`/api/invoices/project/${projectId}`)
    ]);

    // Update file count
    if (filesRes.ok) {
      const filesData = await filesRes.json();
      const fileCount = filesData.files?.length || 0;
      const fileCountEl = document.getElementById('pd-stat-files');
      if (fileCountEl) fileCountEl.textContent = String(fileCount);
    }

    // Update message count
    if (messagesRes.ok) {
      const messagesData = await messagesRes.json();
      const messageCount = messagesData.messages?.length || 0;
      const messageCountEl = document.getElementById('pd-stat-messages');
      if (messageCountEl) messageCountEl.textContent = String(messageCount);
    }

    // Update task count
    if (tasksRes.ok) {
      const tasksData = await tasksRes.json();
      const taskCount = tasksData.tasks?.length || 0;
      const taskCountEl = document.getElementById('pd-stat-tasks');
      if (taskCountEl) taskCountEl.textContent = String(taskCount);
    }

    // Update invoice count and financials
    if (invoicesRes.ok) {
      const invoicesData = await invoicesRes.json();
      const invoices = invoicesData.invoices || [];
      const invoiceCount = invoices.length;
      const invoiceCountEl = document.getElementById('pd-stat-invoices');
      if (invoiceCountEl) invoiceCountEl.textContent = String(invoiceCount);

      // Calculate financial totals
      let totalInvoiced = 0;
      let totalPaid = 0;

      invoices.forEach((inv: { total_amount?: number; amount_paid?: number; status?: string }) => {
        const amount = Number(inv.total_amount) || 0;
        totalInvoiced += amount;
        if (inv.status === 'paid') {
          totalPaid += amount;
        } else {
          totalPaid += Number(inv.amount_paid) || 0;
        }
      });

      const outstanding = totalInvoiced - totalPaid;

      // Update financial stats
      const invoicedEl = document.getElementById('pd-sidebar-invoiced');
      const paidEl = document.getElementById('pd-sidebar-paid');
      const outstandingEl = document.getElementById('pd-sidebar-outstanding');

      if (invoicedEl) invoicedEl.textContent = formatCurrency(totalInvoiced);
      if (paidEl) paidEl.textContent = formatCurrency(totalPaid);
      if (outstandingEl) {
        outstandingEl.textContent = formatCurrency(outstanding);
        // Remove warning class if no outstanding amount
        if (outstanding <= 0) {
          outstandingEl.classList.remove('pd-stat-warning');
        }
      }
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load sidebar stats:', error);
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
      container.innerHTML = '<p class="empty-state">No invoices yet. Create one in the Invoices tab.</p>';
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load invoices:', error);
    container.innerHTML = '<p class="empty-state">Failed to load invoices.</p>';
  }
}

function renderProjectInvoices(invoices: ProjectInvoice[], container: HTMLElement): void {
  if (invoices.length === 0) {
    container.innerHTML = '<p class="empty-state">No invoices yet. Create one in the Invoices tab.</p>';
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
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${invoices
    .map((invoice) => {
      const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(invoice.amount_total);
      const dueDate = formatDate(invoice.due_date);
      const isDraft = invoice.status === 'draft';
      const showSendBtn = isDraft;
      const showMarkPaidBtn = ['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status);

      const previewBtn = `<button type="button" class="icon-btn btn-preview-invoice" data-invoice-id="${invoice.id}" aria-label="Preview PDF" title="Preview PDF"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
      const editBtn = isDraft
        ? `<button type="button" class="icon-btn btn-edit-invoice" data-invoice-id="${invoice.id}" aria-label="Edit Invoice" title="Edit Invoice"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>`
        : '';
      const downloadBtn = `<button type="button" class="icon-btn btn-download-invoice" data-invoice-id="${invoice.id}" data-invoice-number="${invoice.invoice_number}" aria-label="Download PDF" title="Download PDF"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>`;
      const sendBtn = showSendBtn
        ? `<button type="button" class="icon-btn btn-send-invoice" data-invoice-id="${invoice.id}" aria-label="Send to Client" title="Send to Client"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>`
        : '';
      const paidBtn = showMarkPaidBtn
        ? `<button type="button" class="icon-btn btn-mark-paid" data-invoice-id="${invoice.id}" aria-label="Mark as Paid" title="Mark as Paid"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></button>`
        : '';
      return `
              <tr>
                <td>${invoice.invoice_number}</td>
                <td>${amount}</td>
                <td>${dueDate}</td>
                <td>${getStatusDotHTML(invoice.status)}</td>
                <td class="actions-cell">
                  ${sendBtn}
                  ${editBtn}
                  ${paidBtn}
                  ${previewBtn}
                  ${downloadBtn}
                </td>
              </tr>
            `;
    })
    .join('')}
      </tbody>
    </table>
  `;

  // Add event listeners for preview and download buttons
  container.querySelectorAll('.btn-preview-invoice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const invoiceId = (btn as HTMLElement).dataset.invoiceId;
      if (invoiceId) {
        try {
          // Fetch PDF with auth and open as blob URL for preview
          const response = await apiFetch(`/api/invoices/${invoiceId}/pdf?preview=true`);
          if (!response.ok) throw new Error('Failed to load preview');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } catch (error) {
          console.error('[AdminProjects] Preview failed:', error);
          showToast('Failed to preview invoice', 'error');
        }
      }
    });
  });

  container.querySelectorAll('.btn-download-invoice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const invoiceId = (btn as HTMLElement).dataset.invoiceId;
      const invoiceNumber = (btn as HTMLElement).dataset.invoiceNumber || 'invoice';
      if (invoiceId) {
        try {
          const response = await apiFetch(`/api/invoices/${invoiceId}/pdf`);
          if (!response.ok) throw new Error('Failed to download');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${invoiceNumber}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('[AdminProjects] Download failed:', error);
          showToast('Failed to download invoice', 'error');
        }
      }
    });
  });

  // Edit invoice button - delegates to admin dashboard
  container.querySelectorAll('.btn-edit-invoice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const invoiceId = (btn as HTMLElement).dataset.invoiceId;
      console.log('[Invoice] Edit clicked, invoiceId:', invoiceId, 'adminDashboard:', !!window.adminDashboard);
      if (invoiceId && window.adminDashboard) {
        try {
          await window.adminDashboard.editInvoice(parseInt(invoiceId));
          // Reload invoices in this view after edit
          if (currentProjectId && storedContext) {
            loadProjectInvoices(currentProjectId, storedContext);
          }
        } catch (error) {
          console.error('[Invoice] Edit error:', error);
        }
      }
    });
  });

  // Send invoice button - delegates to admin dashboard
  container.querySelectorAll('.btn-send-invoice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const invoiceId = (btn as HTMLElement).dataset.invoiceId;
      console.log('[Invoice] Send clicked, invoiceId:', invoiceId, 'adminDashboard:', !!window.adminDashboard);
      if (invoiceId && window.adminDashboard) {
        try {
          await window.adminDashboard.sendInvoice(parseInt(invoiceId));
          // Reload invoices in this view after successful send
          if (currentProjectId && storedContext) {
            loadProjectInvoices(currentProjectId, storedContext);
          }
        } catch (error) {
          console.error('[Invoice] Send error:', error);
        }
      }
    });
  });

  // Mark paid button - delegates to admin dashboard
  container.querySelectorAll('.btn-mark-paid').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const invoiceId = (btn as HTMLElement).dataset.invoiceId;
      if (invoiceId && window.adminDashboard) {
        try {
          await window.adminDashboard.markInvoicePaid(parseInt(invoiceId));
          // Reload invoices in this view after marking paid
          if (currentProjectId && storedContext) {
            loadProjectInvoices(currentProjectId, storedContext);
          }
        } catch (error) {
          console.error('[Invoice] Mark paid error:', error);
        }
      }
    });
  });
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
 * Show custom modal to create a new invoice with multiple line items
 */
async function showCreateInvoicePrompt(): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  const project = projectsData.find((p) => p.id === currentProjectId) as any;
  if (!project) return;

  // Fetch available deposits for this project
  interface AvailableDeposit {
    invoice_id: number;
    invoice_number: string;
    total_amount: number;
    amount_applied: number;
    available_amount: number;
    paid_date: string;
  }
  let availableDeposits: AvailableDeposit[] = [];
  try {
    const depositsResponse = await apiFetch(`/api/invoices/deposits/${currentProjectId}`);
    console.log('[Invoice] Deposits response status:', depositsResponse.status);
    if (depositsResponse.ok) {
      const data = await depositsResponse.json();
      console.log('[Invoice] Available deposits:', data);
      availableDeposits = data.deposits || [];
    }
  } catch (error) {
    console.log('[Invoice] Could not fetch deposits:', error);
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'confirm-dialog-overlay';
  overlay.id = 'create-invoice-modal';

  // Line items data
  const lineItems: { description: string; quantity: number; rate: number }[] = [
    { description: 'Web Development Services', quantity: 1, rate: project.price || 500 }
  ];

  // Selected deposit for credit
  let selectedDepositId: number | null = null;
  let selectedDepositAmount: number = 0;

  // Helper functions (defined before use)
  const saveCurrentValues = (): void => {
    const rows = overlay.querySelectorAll('.line-item-row');
    rows.forEach((row, index) => {
      if (lineItems[index]) {
        const desc = row.querySelector('.line-item-desc') as HTMLInputElement;
        const qty = row.querySelector('.line-item-qty') as HTMLInputElement;
        const rate = row.querySelector('.line-item-rate') as HTMLInputElement;
        lineItems[index].description = desc?.value || '';
        lineItems[index].quantity = parseInt(qty?.value) || 1;
        lineItems[index].rate = parseFloat(rate?.value) || 0;
      }
    });
  };

  const updateLineItemAmounts = (): void => {
    const rows = overlay.querySelectorAll('.line-item-row');
    let subtotal = 0;
    rows.forEach((row) => {
      const qty = parseFloat((row.querySelector('.line-item-qty') as HTMLInputElement)?.value) || 1;
      const rate = parseFloat((row.querySelector('.line-item-rate') as HTMLInputElement)?.value) || 0;
      const amount = qty * rate;
      subtotal += amount;
      const amountSpan = row.querySelector('.line-item-amount');
      if (amountSpan) amountSpan.textContent = `$${amount.toFixed(2)}`;
    });

    // Update subtotal display
    const subtotalEl = overlay.querySelector('.invoice-subtotal');
    if (subtotalEl) subtotalEl.textContent = `Subtotal: $${subtotal.toFixed(2)}`;

    // Update deposit credit display
    const creditEl = overlay.querySelector('.invoice-credit') as HTMLElement;
    if (creditEl) {
      if (selectedDepositAmount > 0) {
        creditEl.textContent = `Deposit Credit: -$${selectedDepositAmount.toFixed(2)}`;
        creditEl.style.display = 'block';
      } else {
        creditEl.style.display = 'none';
      }
    }

    // Calculate final total
    const finalTotal = Math.max(0, subtotal - selectedDepositAmount);
    const totalEl = overlay.querySelector('.invoice-total strong');
    if (totalEl) totalEl.textContent = `Total Due: $${finalTotal.toFixed(2)}`;
  };

  const closeModal = (): void => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 150);
  };

  const submitInvoice = async (): Promise<void> => {
    saveCurrentValues();

    // Validate line items
    const validLineItems = lineItems.filter(item => item.description.trim() && item.rate > 0);
    if (validLineItems.length === 0) {
      alertWarning('Please add at least one line item with description and amount');
      return;
    }

    const typeSelect = overlay.querySelector('#invoice-type-select') as HTMLSelectElement;
    const isDeposit = typeSelect?.value === 'deposit';
    const depositPercentageInput = overlay.querySelector('#deposit-percentage') as HTMLInputElement;
    const depositPercentage = isDeposit && depositPercentageInput ? parseFloat(depositPercentageInput.value) : undefined;

    // Calculate total
    const totalAmount = validLineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const clientId = project.client_id;

    if (!clientId) {
      showToast('Cannot create invoice: Project has no associated client', 'error');
      return;
    }

    closeModal();

    if (isDeposit) {
      // Create deposit invoice
      try {
        const response = await apiPost('/api/invoices/deposit', {
          projectId: currentProjectId,
          clientId,
          amount: totalAmount,
          percentage: depositPercentage,
          description: validLineItems[0].description
        });

        if (response.ok) {
          showToast('Deposit invoice created successfully!', 'success');
          if (currentProjectId && storedContext) loadProjectInvoices(currentProjectId, storedContext);
        } else {
          showToast('Failed to create deposit invoice', 'error');
        }
      } catch (error) {
        console.error('[AdminProjects] Error creating deposit invoice:', error);
        showToast('Failed to create deposit invoice', 'error');
      }
    } else {
      // Create standard invoice with line items (and apply deposit credit if selected)
      createInvoiceWithLineItems(clientId, validLineItems, selectedDepositId, selectedDepositAmount);
    }
  };

  // Render the modal (defined before attachModalHandlers which uses it)
  const renderModal = (): void => {
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

    overlay.innerHTML = `
      <div class="confirm-dialog invoice-modal">
        <div class="confirm-dialog-icon info">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <h3 class="confirm-dialog-title">Create Invoice</h3>

        <div class="invoice-modal-form">
          <div class="form-group">
            <label class="form-label">Invoice Type *</label>
            <select id="invoice-type-select" class="form-input">
              <option value="standard">Standard Invoice</option>
              <option value="deposit">Deposit Invoice</option>
            </select>
          </div>

          <div class="form-group deposit-field" style="display: none;">
            <label class="form-label">Deposit Percentage</label>
            <input type="number" id="deposit-percentage" class="form-input" value="50" min="1" max="100" placeholder="e.g., 50">
          </div>

          <div class="form-group">
            <label class="form-label">Line Items</label>
            <div class="line-items-container">
              ${lineItems.map((item, index) => `
                <div class="line-item-row" data-index="${index}">
                  <input type="text" class="form-input line-item-desc" placeholder="Description" value="${SanitizationUtils.escapeHtml(item.description)}" required>
                  <input type="number" class="form-input line-item-qty" placeholder="Qty" value="${item.quantity}" min="1" style="width: 70px;">
                  <input type="number" class="form-input line-item-rate" placeholder="Rate" value="${item.rate}" min="0" step="0.01" style="width: 100px;">
                  <span class="line-item-amount">$${(item.quantity * item.rate).toFixed(2)}</span>
                  ${lineItems.length > 1 ? `<button type="button" class="btn-remove-line" data-index="${index}" title="Remove">&times;</button>` : ''}
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-line-item">+ Add Line Item</button>
          </div>

          ${availableDeposits.length > 0 ? `
          <div class="form-group deposit-credit-section" id="deposit-credit-section">
            <label class="form-label">Apply Deposit Credit</label>
            <select id="deposit-credit-select" class="form-input">
              <option value="">-- No deposit credit --</option>
              ${availableDeposits.map(dep => `
                <option value="${dep.invoice_id}" data-amount="${dep.available_amount}">
                  ${SanitizationUtils.escapeHtml(dep.invoice_number)} - $${dep.available_amount.toFixed(2)} available
                </option>
              `).join('')}
            </select>
            <small class="form-hint">Select a paid deposit to apply as credit to this invoice</small>
          </div>
          ` : `
          <div class="form-group" id="no-deposits-info" style="display: none;">
            <small class="form-hint">No paid deposits available for credit</small>
          </div>
          `}

          <div class="invoice-totals-section">
            <div class="invoice-subtotal">Subtotal: $${totalAmount.toFixed(2)}</div>
            <div class="invoice-credit" style="display: none; color: var(--color-success);">Deposit Credit: -$0.00</div>
            <div class="invoice-total">
              <strong>Total Due: $${totalAmount.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">Cancel</button>
          <button type="button" class="confirm-dialog-btn confirm-dialog-confirm">Create Invoice</button>
        </div>
      </div>
    `;

    // Helper to calculate deposit amount from percentage
    const calculateDepositAmount = (): void => {
      const percentInput = overlay.querySelector('#deposit-percentage') as HTMLInputElement;
      const percent = parseFloat(percentInput?.value) || 50;
      // Get the original project price as base for deposit calculation
      const baseAmount = project.price || 500;
      const depositAmount = (baseAmount * percent) / 100;

      // Update the first line item with the deposit amount
      if (lineItems.length > 0) {
        lineItems[0].rate = depositAmount;
        lineItems[0].description = `Project Deposit (${percent}%)`;
        // Update the UI
        const firstRow = overlay.querySelector('.line-item-row');
        if (firstRow) {
          const rateInput = firstRow.querySelector('.line-item-rate') as HTMLInputElement;
          const descInput = firstRow.querySelector('.line-item-desc') as HTMLInputElement;
          if (rateInput) rateInput.value = String(depositAmount);
          if (descInput) descInput.value = `Project Deposit (${percent}%)`;
        }
        updateLineItemAmounts();
      }
    };

    // Attach event handlers inline
    // Invoice type change - show/hide deposit percentage and credit section
    const typeSelect = overlay.querySelector('#invoice-type-select') as HTMLSelectElement;
    const depositField = overlay.querySelector('.deposit-field') as HTMLElement;
    const depositCreditSection = overlay.querySelector('#deposit-credit-section') as HTMLElement;

    if (typeSelect && !typeSelect.dataset.dropdownInit) {
      typeSelect.dataset.dropdownInit = 'true';
      initModalDropdown(typeSelect, { placeholder: 'Invoice type...' });
    }
    const depositCreditSelect = overlay.querySelector('#deposit-credit-select') as HTMLSelectElement;
    if (depositCreditSelect && !depositCreditSelect.dataset.dropdownInit) {
      depositCreditSelect.dataset.dropdownInit = 'true';
      initModalDropdown(depositCreditSelect, { placeholder: 'Apply deposit credit...' });
    }

    typeSelect?.addEventListener('change', () => {
      const isDeposit = typeSelect.value === 'deposit';
      if (depositField) {
        depositField.style.display = isDeposit ? 'block' : 'none';
      }
      // Hide deposit credit section when creating a deposit invoice
      if (depositCreditSection) {
        depositCreditSection.style.display = isDeposit ? 'none' : 'block';
      }
      // Clear selected deposit when switching to deposit type
      if (isDeposit) {
        selectedDepositId = null;
        selectedDepositAmount = 0;
        // Calculate deposit amount based on percentage
        calculateDepositAmount();
      } else {
        // Restore original amount when switching back to standard
        if (lineItems.length > 0) {
          lineItems[0].rate = project.price || 500;
          lineItems[0].description = 'Web Development Services';
          const firstRow = overlay.querySelector('.line-item-row');
          if (firstRow) {
            const rateInput = firstRow.querySelector('.line-item-rate') as HTMLInputElement;
            const descInput = firstRow.querySelector('.line-item-desc') as HTMLInputElement;
            if (rateInput) rateInput.value = String(project.price || 500);
            if (descInput) descInput.value = 'Web Development Services';
          }
          updateLineItemAmounts();
        }
      }
    });

    // Deposit percentage change - recalculate deposit amount
    const depositPercentInput = overlay.querySelector('#deposit-percentage') as HTMLInputElement;
    depositPercentInput?.addEventListener('input', () => {
      if (typeSelect?.value === 'deposit') {
        calculateDepositAmount();
      }
    });

    // Deposit credit selection
    depositCreditSelect?.addEventListener('change', () => {
      const selectedOption = depositCreditSelect.selectedOptions[0];
      if (selectedOption && selectedOption.value) {
        selectedDepositId = parseInt(selectedOption.value);
        selectedDepositAmount = parseFloat(selectedOption.dataset.amount || '0');
      } else {
        selectedDepositId = null;
        selectedDepositAmount = 0;
      }
      updateLineItemAmounts();
    });

    // Add line item button
    const addLineBtn = overlay.querySelector('#btn-add-line-item');
    addLineBtn?.addEventListener('click', () => {
      lineItems.push({ description: '', quantity: 1, rate: 0 });
      saveCurrentValues();
      renderModal();
    });

    // Remove line item buttons
    overlay.querySelectorAll('.btn-remove-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.index || '0');
        lineItems.splice(index, 1);
        saveCurrentValues();
        renderModal();
      });
    });

    // Update amounts on input change
    overlay.querySelectorAll('.line-item-qty, .line-item-rate').forEach(input => {
      input.addEventListener('input', () => {
        updateLineItemAmounts();
      });
    });

    // Cancel button
    overlay.querySelector('.confirm-dialog-cancel')?.addEventListener('click', closeModal);

    // Confirm button
    overlay.querySelector('.confirm-dialog-confirm')?.addEventListener('click', submitInvoice);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Close on Escape
    const escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  };

  // Initial render
  renderModal();
  document.body.appendChild(overlay);

  // Focus first input
  setTimeout(() => {
    const firstInput = overlay.querySelector('.line-item-desc') as HTMLInputElement;
    firstInput?.focus();
  }, 100);
}

/**
 * Create invoice with multiple line items
 */
async function createInvoiceWithLineItems(
  clientId: number,
  lineItems: { description: string; quantity: number; rate: number }[],
  depositInvoiceId?: number | null,
  depositAmount?: number
): Promise<void> {
  if (!currentProjectId || !storedContext) return;

  try {
    const response = await apiPost('/api/invoices', {
      projectId: currentProjectId,
      clientId,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate
      })),
      notes: '',
      terms: 'Payment due within 30 days'
    });

    if (response.ok) {
      const data = await response.json();
      const newInvoiceId = data.invoice?.id;

      // Apply deposit credit if selected
      if (newInvoiceId && depositInvoiceId && depositAmount && depositAmount > 0) {
        try {
          const creditResponse = await apiPost(`/api/invoices/${newInvoiceId}/apply-credit`, {
            depositInvoiceId,
            amount: depositAmount
          });

          if (creditResponse.ok) {
            showToast('Invoice created with deposit credit applied!', 'success');
          } else {
            showToast('Invoice created, but failed to apply deposit credit', 'warning');
          }
        } catch (creditError) {
          console.error('[AdminProjects] Error applying deposit credit:', creditError);
          showToast('Invoice created, but failed to apply deposit credit', 'warning');
        }
      } else {
        showToast('Invoice created successfully!', 'success');
      }

      if (currentProjectId && storedContext) loadProjectInvoices(currentProjectId, storedContext);
    } else {
      const errorData = await response.json();
      console.error('[AdminProjects] Invoice creation failed:', errorData);
      showToast('Failed to create invoice', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error creating invoice:', error);
    showToast('Failed to create invoice', 'error');
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
// ADD PROJECT (ADMIN MANUAL CREATION)
// =====================================================

interface ClientOption {
  id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
}

let newProjectClientSelectInstance: FilterSelectInstance | null = null;

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

  // Ensure reusable dropdowns exist (create once)
  ensureAddProjectSelects();

  // Load existing clients into dropdown
  await populateClientDropdown();

  // Show modal and lock body scroll
  openModalOverlay(modal);

  let addProjectFocusCleanup: (() => void) | null = null;
  const closeModal = () => {
    addProjectFocusCleanup?.();
    addProjectFocusCleanup = null;
    modal.removeAttribute('aria-labelledby');
    modal.removeAttribute('role');
    modal.removeAttribute('aria-modal');
    closeModalOverlay(modal);
    form.reset();
    resetAddProjectDropdowns();
  };

  modal.setAttribute('aria-labelledby', 'add-project-modal-title');
  addProjectFocusCleanup = manageFocusTrap(modal, {
    initialFocus: '#new-project-client',
    onClose: closeModal
  });

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await handleAddProjectSubmit(ctx, closeModal);
  };

  form.addEventListener('submit', handleSubmit, { once: true });
}

/**
 * Create add project modal dropdowns (reusable component) once
 */
function ensureAddProjectSelects(): void {
  const newClientFields = document.getElementById('new-client-fields');

  const clientMount = document.getElementById('new-project-client-mount');
  if (clientMount && !clientMount.querySelector('select')) {
    newProjectClientSelectInstance = createFilterSelect({
      id: 'new-project-client',
      ariaLabel: 'Client',
      emptyOption: 'Select existing client...',
      options: [{ value: 'new', label: '+ Create New Client' }],
      value: '',
      className: 'form-input',
      required: true,
      onChange: (value: string) => {
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
    clientMount.appendChild(newProjectClientSelectInstance.element);
  }

  const typeMount = document.getElementById('new-project-type-mount');
  if (typeMount && !typeMount.querySelector('select')) {
    const typeInstance = createFilterSelect({
      id: 'new-project-type',
      ariaLabel: 'Project type',
      emptyOption: 'Select type...',
      options: [
        { value: 'simple-site', label: 'Simple Website' },
        { value: 'business-site', label: 'Business Website' },
        { value: 'portfolio', label: 'Portfolio' },
        { value: 'e-commerce', label: 'E-Commerce' },
        { value: 'web-app', label: 'Web Application' },
        { value: 'browser-extension', label: 'Browser Extension' },
        { value: 'other', label: 'Other' }
      ],
      value: '',
      className: 'form-input',
      required: true
    });
    typeMount.appendChild(typeInstance.element);
  }

  const budgetMount = document.getElementById('new-project-budget-mount');
  if (budgetMount && !budgetMount.querySelector('select')) {
    const budgetInstance = createFilterSelect({
      id: 'new-project-budget',
      ariaLabel: 'Budget',
      emptyOption: 'Select budget...',
      options: [
        { value: 'under-1k', label: 'Under $1,000' },
        { value: '1k-2.5k', label: '$1,000 - $2,500' },
        { value: '2.5k-5k', label: '$2,500 - $5,000' },
        { value: '5k-10k', label: '$5,000 - $10,000' },
        { value: '10k+', label: '$10,000+' }
      ],
      value: '',
      className: 'form-input',
      required: true
    });
    budgetMount.appendChild(budgetInstance.element);
  }

  const timelineMount = document.getElementById('new-project-timeline-mount');
  if (timelineMount && !timelineMount.querySelector('select')) {
    const timelineInstance = createFilterSelect({
      id: 'new-project-timeline',
      ariaLabel: 'Timeline',
      emptyOption: 'Select timeline...',
      options: [
        { value: 'asap', label: 'ASAP' },
        { value: '1-month', label: 'Within 1 Month' },
        { value: '1-3-months', label: '1-3 Months' },
        { value: '3-6-months', label: '3-6 Months' },
        { value: 'flexible', label: 'Flexible' }
      ],
      value: '',
      className: 'form-input',
      required: true
    });
    timelineMount.appendChild(timelineInstance.element);
  }
}

/**
 * Reset dropdown values when modal closes
 */
function resetAddProjectDropdowns(): void {
  const ids = ['new-project-client', 'new-project-type', 'new-project-budget', 'new-project-timeline'];
  ids.forEach((id) => {
    const select = document.getElementById(id) as HTMLSelectElement;
    if (select) select.value = '';
  });
}

/**
 * Populate the client dropdown with existing clients (reusable component setOptions)
 */
async function populateClientDropdown(): Promise<void> {
  if (!newProjectClientSelectInstance) return;

  try {
    const response = await apiFetch('/api/clients');
    if (response.ok) {
      const data = await response.json();
      const clients: ClientOption[] = data.clients || [];
      const options = [
        { value: '', label: 'Select existing client...' },
        ...clients.map((c) => {
          const displayName = SanitizationUtils.decodeHtmlEntities(c.contact_name || c.email);
          const company = c.company_name ? ` (${SanitizationUtils.decodeHtmlEntities(c.company_name)})` : '';
          return { value: String(c.id), label: `${displayName}${company}` };
        }),
        { value: 'new', label: '+ Create New Client' }
      ];
      newProjectClientSelectInstance.setOptions(options, '');
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
      ctx.showNotification('Failed to create project. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminProjects] Error creating project:', error);
    ctx.showNotification('Failed to create project. Please try again.', 'error');
  }
}
