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
import type { ProjectMilestone, ProjectFile, ProjectInvoice, AdminDashboardContext, Message } from '../admin-types';

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

/**
 * Format budget/timeline values with proper capitalization
 * Capitalizes first letter of each word, ASAP becomes all caps
 */
function formatDisplayValue(value: string | undefined | null): string {
  if (!value || value === '-') return '-';

  // Handle ASAP - make it all caps
  let formatted = value.replace(/\basap\b/gi, 'ASAP');

  // Capitalize first letter of each word
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
  try {
    const response = await fetch('/api/admin/leads', {
      credentials: 'include'
    });

    if (response.ok) {
      const data: ProjectsData = await response.json();
      projectsData = data.leads || [];
      updateProjectsDisplay(data, ctx);
    }
  } catch (error) {
    console.error('[AdminProjects] Failed to load projects:', error);
  }
}

function updateProjectsDisplay(data: ProjectsData, ctx: AdminDashboardContext): void {
  const projects = (data.leads || []).filter(
    (p) => normalizeStatus(p.status) !== 'pending' || p.project_name
  );

  // Update stats
  const projectsTotal = document.getElementById('projects-total');
  const projectsActive = document.getElementById('projects-active');
  const projectsCompleted = document.getElementById('projects-completed');
  const projectsOnHold = document.getElementById('projects-on-hold');

  const activeCount = projects.filter(
    (p) => normalizeStatus(p.status) === 'active' || normalizeStatus(p.status) === 'in_progress'
  ).length;
  const completedCount = projects.filter((p) => normalizeStatus(p.status) === 'completed').length;
  const onHoldCount = projects.filter((p) => normalizeStatus(p.status) === 'on_hold').length;

  if (projectsTotal) projectsTotal.textContent = projects.length.toString();
  if (projectsActive) projectsActive.textContent = activeCount.toString();
  if (projectsCompleted) projectsCompleted.textContent = completedCount.toString();
  if (projectsOnHold) projectsOnHold.textContent = onHoldCount.toString();

  renderProjectsTable(projects, ctx);
}

function renderProjectsTable(projects: LeadProject[], ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('projects-table-body');
  if (!tableBody) return;

  if (projects.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="loading-row">No projects yet. Convert leads to start projects.</td></tr>';
    return;
  }

  tableBody.innerHTML = projects
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
  const tableBody = document.getElementById('projects-table-body');
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
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ status })
    });

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
  const titleEl = document.getElementById('project-detail-title');
  if (titleEl) titleEl.textContent = 'Project Details';

  const projectData = project as any;

  // Overview fields
  const fields: Record<string, string> = {
    'pd-project-name': project.project_name || 'Untitled Project',
    'pd-client-name': project.contact_name || '-',
    'pd-client-email': project.email || '-',
    'pd-company': project.company_name || '-',
    'pd-type': formatProjectType(project.project_type),
    'pd-budget': formatDisplayValue(project.budget_range),
    'pd-price': projectData.price || '-',
    'pd-timeline': formatDisplayValue(project.timeline),
    'pd-start-date': project.created_at ? new Date(project.created_at).toLocaleDateString() : '-'
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = SanitizationUtils.escapeHtml(value);
  });

  // Preview URL
  const previewUrlLink = document.getElementById('pd-preview-url-link') as HTMLAnchorElement;
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

  // Status badge - normalize to underscore format
  const statusEl = document.getElementById('pd-status');
  if (statusEl) {
    const normalizedStatus = normalizeStatus(project.status);
    statusEl.textContent = normalizedStatus.replace(/_/g, ' ');
    statusEl.className = `status-badge status-${normalizedStatus}`;
  }

  // Progress
  const progress = project.progress || 0;
  const progressPercent = document.getElementById('pd-progress-percent');
  const progressBar = document.getElementById('pd-progress-bar');
  if (progressPercent) progressPercent.textContent = `${progress}%`;
  if (progressBar) progressBar.style.width = `${progress}%`;

  // Description (now in static HTML element)
  const descriptionEl = document.getElementById('pd-description');
  if (descriptionEl) {
    descriptionEl.textContent = project.description || '-';
  }

  // Features - append below the description row if present
  const notes = document.getElementById('pd-notes');
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
      featuresContainer.innerHTML = `<span class="meta-label">Features Requested</span><div class="features-list">${featuresList}</div>`;
      notes.appendChild(featuresContainer);
    } else if (featuresContainer && featuresList) {
      featuresContainer.innerHTML = `<span class="meta-label">Features Requested</span><div class="features-list">${featuresList}</div>`;
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
  const editBtn = document.getElementById('btn-edit-project');
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
  const modal = document.getElementById('edit-project-modal');
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
  if (budgetInput) budgetInput.value = project.budget_range || '';
  if (priceInput) priceInput.value = projectData.price || '';
  if (timelineInput) timelineInput.value = project.timeline || '';
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

  const closeBtn = document.getElementById('edit-project-close');
  const cancelBtn = document.getElementById('edit-project-cancel');
  const form = document.getElementById('edit-project-form') as HTMLFormElement;

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
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });

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

  // Back button handler
  const backBtn = document.getElementById('btn-back-to-projects') as HTMLElement;
  if (backBtn && !backBtn.dataset.listenerAdded) {
    backBtn.dataset.listenerAdded = 'true';
    backBtn.addEventListener('click', () => {
      currentProjectId = null;
      ctx.switchTab('projects');
    });
  }

  // Create invoice handler
  const createInvoiceBtn = document.getElementById('btn-create-invoice') as HTMLElement;
  if (createInvoiceBtn && !createInvoiceBtn.dataset.listenerAdded) {
    createInvoiceBtn.dataset.listenerAdded = 'true';
    createInvoiceBtn.addEventListener('click', () => showCreateInvoicePrompt());
  }

  // Add milestone handler
  const addMilestoneBtn = document.getElementById('btn-add-milestone') as HTMLElement;
  if (addMilestoneBtn && !addMilestoneBtn.dataset.listenerAdded) {
    addMilestoneBtn.dataset.listenerAdded = 'true';
    addMilestoneBtn.addEventListener('click', () => showAddMilestonePrompt());
  }

  // Send message handler
  const sendMsgBtn = document.getElementById('btn-pd-send-message') as HTMLElement;
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
  const container = document.getElementById('pd-messages-thread');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/messages`, {
      credentials: 'include'
    });

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
  const container = document.getElementById('pd-files-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/files`, {
      credentials: 'include'
    });

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
    <table class="files-table">
      <thead>
        <tr>
          <th>File</th>
          <th>Size</th>
          <th>Uploaded</th>
          <th>Actions</th>
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
                  <a href="/uploads/${file.filename}" class="action-btn" download="${safeName}">Download</a>
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
  const container = document.getElementById('pd-milestones-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/milestones`, {
      credentials: 'include'
    });

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
  const progressPercent = document.getElementById('pd-progress-percent');
  const progressBar = document.getElementById('pd-progress-bar');

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
    const response = await fetch(`/api/projects/${currentProjectId}/milestones/${milestoneId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ is_completed: isCompleted })
    });

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
  const container = document.getElementById('pd-invoices-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/invoices/project/${projectId}`, {
      credentials: 'include'
    });

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
    <table class="invoices-table">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Amount</th>
          <th>Due Date</th>
          <th>Status</th>
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
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
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
      })
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
    const response = await fetch(`/api/projects/${currentProjectId}/milestones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        title,
        description,
        due_date: dueDate
      })
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

  const messageInput = document.getElementById('pd-message-input') as HTMLTextAreaElement;
  if (!messageInput || !messageInput.value.trim()) return;

  const message = messageInput.value.trim();

  try {
    const response = await fetch(`/api/projects/${currentProjectId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ message })
    });

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
  const dropzone = document.getElementById('pd-upload-dropzone');
  const fileInput = document.getElementById('pd-file-input') as HTMLInputElement;
  const browseBtn = document.getElementById('btn-pd-browse-files');

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

    const response = await fetch('/api/uploads/multiple', {
      method: 'POST',
      credentials: 'include',
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
