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
  if (ctx.isDemo()) return;

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
  if (ctx.isDemo()) return;

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

/**
 * Open the edit project modal with current project data
 */
function openEditProjectModal(project: LeadProject): void {
  const modal = document.getElementById('edit-project-modal');
  if (!modal) return;

  const projectData = project as any;

  // Populate form fields
  const nameInput = document.getElementById('edit-project-name') as HTMLInputElement;
  const typeSelect = document.getElementById('edit-project-type') as HTMLSelectElement;
  const budgetInput = document.getElementById('edit-project-budget') as HTMLInputElement;
  const priceInput = document.getElementById('edit-project-price') as HTMLInputElement;
  const timelineInput = document.getElementById('edit-project-timeline') as HTMLInputElement;
  const previewUrlInput = document.getElementById('edit-project-preview-url') as HTMLInputElement;
  const statusSelect = document.getElementById('edit-project-status') as HTMLSelectElement;

  if (nameInput) nameInput.value = project.project_name || '';
  if (typeSelect) typeSelect.value = project.project_type || '';
  if (budgetInput) budgetInput.value = project.budget_range || '';
  if (priceInput) priceInput.value = projectData.price || '';
  if (timelineInput) timelineInput.value = project.timeline || '';
  if (previewUrlInput) previewUrlInput.value = projectData.preview_url || '';
  if (statusSelect) statusSelect.value = normalizeStatus(project.status);

  // Show modal
  modal.classList.remove('hidden');

  // Setup close handlers
  const closeBtn = document.getElementById('edit-project-close');
  const cancelBtn = document.getElementById('edit-project-cancel');
  const form = document.getElementById('edit-project-form') as HTMLFormElement;

  const closeModal = () => modal.classList.add('hidden');

  closeBtn?.addEventListener('click', closeModal, { once: true });
  cancelBtn?.addEventListener('click', closeModal, { once: true });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });

  // Handle form submit
  if (form) {
    const newForm = form.cloneNode(true) as HTMLFormElement;
    form.parentNode?.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProjectChanges(project.id);
      closeModal();
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

// Store original values for comparison
let originalProjectSettings: { name: string; status: string; progress: string } | null = null;

/**
 * Set up tracking for unsaved changes in project settings
 */
function setupUnsavedChangesTracking(project: any): void {
  const settingName = document.getElementById('pd-setting-name') as HTMLInputElement;
  const settingStatus = document.getElementById('pd-setting-status') as HTMLInputElement;
  const settingProgress = document.getElementById('pd-setting-progress') as HTMLInputElement;
  const saveBtn = document.getElementById('btn-save-project-settings');

  if (!settingName || !settingStatus || !settingProgress || !saveBtn) return;

  // Store original values
  originalProjectSettings = {
    name: project.project_name || '',
    status: normalizeStatus(project.status),
    progress: (project.progress || 0).toString()
  };

  // Reset button state
  updateSaveButtonState(false);

  // Add change listeners (only if not already added)
  if (!settingName.dataset.changeTracking) {
    settingName.dataset.changeTracking = 'true';
    settingName.addEventListener('input', checkForChanges);
  }
  if (!settingProgress.dataset.changeTracking) {
    settingProgress.dataset.changeTracking = 'true';
    settingProgress.addEventListener('input', checkForChanges);
  }
}

/**
 * Check if form values differ from original and update button state
 */
function checkForChanges(): void {
  if (!originalProjectSettings) return;

  const settingName = document.getElementById('pd-setting-name') as HTMLInputElement;
  const settingStatus = document.getElementById('pd-setting-status') as HTMLInputElement;
  const settingProgress = document.getElementById('pd-setting-progress') as HTMLInputElement;

  if (!settingName || !settingStatus || !settingProgress) return;

  const hasChanges =
    settingName.value !== originalProjectSettings.name ||
    settingStatus.value !== originalProjectSettings.status ||
    settingProgress.value !== originalProjectSettings.progress;

  updateSaveButtonState(hasChanges);
}

/**
 * Update save button appearance based on unsaved changes
 */
function updateSaveButtonState(hasChanges: boolean): void {
  const saveBtn = document.getElementById('btn-save-project-settings');
  if (!saveBtn) return;

  if (hasChanges) {
    saveBtn.classList.add('has-unsaved-changes');
  } else {
    saveBtn.classList.remove('has-unsaved-changes');
  }
}

/**
 * Set up custom status dropdown behavior
 */
function setupCustomStatusDropdown(): void {
  const dropdown = document.getElementById('pd-status-dropdown');

  if (!dropdown) return;

  // Skip if already set up
  if (dropdown.dataset.listenerAdded) return;
  dropdown.dataset.listenerAdded = 'true';

  // Use event delegation on the dropdown container
  dropdown.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle trigger click
    if (target.closest('.custom-dropdown-trigger')) {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('open');
      return;
    }

    // Handle option click
    const option = target.closest('.custom-dropdown-option') as HTMLElement;
    if (option) {
      const value = option.dataset.value || '';
      const hiddenInput = document.getElementById('pd-setting-status') as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.value = value;
      }
      updateCustomDropdown(value);
      dropdown.classList.remove('open');
      checkForChanges();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdown.classList.remove('open');
    }
  });
}

/**
 * Update custom dropdown display based on selected value
 */
function updateCustomDropdown(status: string): void {
  const trigger = document.getElementById('pd-status-trigger');
  const valueSpan = trigger?.querySelector('.custom-dropdown-value');
  const menu = document.getElementById('pd-status-menu');

  if (!trigger || !valueSpan) return;

  // Update displayed text
  const statusLabels: Record<string, string> = {
    'pending': 'Pending',
    'active': 'Active',
    'on_hold': 'On Hold',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  valueSpan.textContent = statusLabels[status] || status;

  // Update trigger color
  trigger.classList.remove('status-pending', 'status-active', 'status-on_hold', 'status-completed', 'status-cancelled');
  if (status) {
    trigger.classList.add(`status-${status}`);
  }

  // Update selected option in menu
  if (menu) {
    const options = menu.querySelectorAll('.custom-dropdown-option');
    options.forEach((option) => {
      option.classList.toggle('selected', (option as HTMLElement).dataset.value === status);
    });
  }
}

function setupProjectDetailTabs(_ctx: AdminDashboardContext): void {
  const tabBtns = document.querySelectorAll('.pd-tab-btn');
  const tabContents = document.querySelectorAll('.pd-tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.pdTab;
      if (!tabName) return;

      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach((content) => {
        content.classList.toggle('active', content.id === `pd-tab-${tabName}`);
      });
    });
  });
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
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

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
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

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
  if (ctx.isDemo()) return;

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
  if (ctx.isDemo() || !currentProjectId) return;

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
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

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
