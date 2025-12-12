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
import type { Project, ProjectMilestone, ProjectFile, ProjectInvoice, AdminDashboardContext } from '../admin-types';

interface ProjectsData {
  leads: Project[];
  stats: {
    total: number;
    active: number;
    completed: number;
    on_hold: number;
  };
}

let projectsData: Project[] = [];
let currentProjectId: number | null = null;

export function getProjectsData(): Project[] {
  return projectsData;
}

export function getCurrentProjectId(): number | null {
  return currentProjectId;
}

export function setCurrentProjectId(id: number | null): void {
  currentProjectId = id;
}

export async function loadProjects(ctx: AdminDashboardContext): Promise<void> {
  const token = ctx.getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/admin/leads', {
      headers: { Authorization: `Bearer ${token}` }
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
    (p: any) => p.status !== 'pending' || p.project_name
  );

  // Update stats
  const projectsTotal = document.getElementById('projects-total');
  const projectsActive = document.getElementById('projects-active');
  const projectsCompleted = document.getElementById('projects-completed');
  const projectsOnHold = document.getElementById('projects-on-hold');

  const activeCount = projects.filter(
    (p: any) => p.status === 'active' || p.status === 'in_progress'
  ).length;
  const completedCount = projects.filter((p: any) => p.status === 'completed').length;
  const onHoldCount = projects.filter((p: any) => p.status === 'on_hold').length;

  if (projectsTotal) projectsTotal.textContent = projects.length.toString();
  if (projectsActive) projectsActive.textContent = activeCount.toString();
  if (projectsCompleted) projectsCompleted.textContent = completedCount.toString();
  if (projectsOnHold) projectsOnHold.textContent = onHoldCount.toString();

  renderProjectsTable(projects, ctx);
}

function renderProjectsTable(projects: any[], ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('projects-table-body');
  if (!tableBody) return;

  if (projects.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="loading-row">No projects yet. Convert leads to start projects.</td></tr>';
    return;
  }

  tableBody.innerHTML = projects
    .map((project: any) => {
      const safeName = SanitizationUtils.escapeHtml(
        project.project_name || project.description?.substring(0, 30) || 'Untitled Project'
      );
      const safeContact = SanitizationUtils.escapeHtml(project.contact_name || '-');
      const safeCompany = SanitizationUtils.escapeHtml(project.company_name || '');

      return `
        <tr data-project-id="${project.id}">
          <td>${safeName}</td>
          <td>${safeContact}<br><small>${safeCompany}</small></td>
          <td>${formatProjectType(project.project_type)}</td>
          <td>${project.budget_range || '-'}</td>
          <td>${project.timeline || '-'}</td>
          <td>
            <select class="project-status-select status-select" data-id="${project.id}" onclick="event.stopPropagation()">
              <option value="pending" ${project.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="active" ${project.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="in_progress" ${project.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
              <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="action-btn action-edit" data-id="${project.id}" onclick="event.stopPropagation()">View</button>
          </td>
        </tr>
      `;
    })
    .join('');

  setupProjectTableHandlers(ctx);
}

function setupProjectTableHandlers(ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('projects-table-body');
  if (!tableBody) return;

  // Row click handlers
  const rows = tableBody.querySelectorAll('tr[data-project-id]');
  rows.forEach((row) => {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SELECT' || target.tagName === 'BUTTON') return;
      const projectId = parseInt((row as HTMLElement).dataset.projectId || '0');
      showProjectDetails(projectId, ctx);
    });
  });

  // Status select handlers
  const statusSelects = tableBody.querySelectorAll('.project-status-select');
  statusSelects.forEach((select) => {
    select.addEventListener('change', (e) => {
      e.stopPropagation();
      const target = e.target as HTMLSelectElement;
      const id = target.dataset.id;
      if (id) {
        updateProjectStatus(parseInt(id), target.value, ctx);
      }
    });
  });

  // View button handlers
  const viewBtns = tableBody.querySelectorAll('.action-btn.action-edit');
  viewBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id) {
        showProjectDetails(parseInt(id), ctx);
      }
    });
  });
}

export async function updateProjectStatus(
  id: number,
  status: string,
  ctx: AdminDashboardContext
): Promise<void> {
  const token = ctx.getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
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
  ctx: AdminDashboardContext,
  switchTab?: (tab: string) => void
): void {
  const project = projectsData.find((p: any) => p.id === projectId);
  if (!project) return;

  currentProjectId = projectId;

  // Switch to project-detail tab if callback provided
  if (switchTab) {
    switchTab('project-detail');
  }

  populateProjectDetailView(project);
  setupProjectDetailTabs(ctx);

  // Load project-specific data
  loadProjectMessages(projectId, ctx);
  loadProjectFiles(projectId, ctx);
  loadProjectMilestones(projectId, ctx);
  loadProjectInvoices(projectId, ctx);
}

function populateProjectDetailView(project: any): void {
  const titleEl = document.getElementById('project-detail-title');
  if (titleEl) titleEl.textContent = project.project_name || 'Project Details';

  // Overview fields
  const fields: Record<string, string> = {
    'pd-project-name': project.project_name || 'Untitled Project',
    'pd-client-name': project.contact_name || '-',
    'pd-client-email': project.email || '-',
    'pd-company': project.company_name || '-',
    'pd-type': formatProjectType(project.project_type),
    'pd-budget': project.budget_range || '-',
    'pd-timeline': project.timeline || '-',
    'pd-start-date': project.created_at ? new Date(project.created_at).toLocaleDateString() : '-'
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = SanitizationUtils.escapeHtml(value);
  });

  // Status badge
  const status = document.getElementById('pd-status');
  if (status) {
    status.textContent = (project.status || 'pending').replace('_', ' ');
    status.className = `status-badge status-${(project.status || 'pending').replace('_', '-')}`;
  }

  // Progress
  const progress = project.progress || 0;
  const progressPercent = document.getElementById('pd-progress-percent');
  const progressBar = document.getElementById('pd-progress-bar');
  if (progressPercent) progressPercent.textContent = `${progress}%`;
  if (progressBar) progressBar.style.width = `${progress}%`;

  // Notes
  const notes = document.getElementById('pd-notes');
  if (notes) {
    const safeDesc = SanitizationUtils.escapeHtml(project.description || '');
    const safeFeatures = SanitizationUtils.escapeHtml(project.features || '');

    if (project.description) {
      notes.innerHTML = `<p>${safeDesc}</p>`;
      if (project.features) {
        notes.innerHTML += `<h4>Features Requested:</h4><p>${safeFeatures}</p>`;
      }
    } else {
      notes.innerHTML = '<p class="empty-state">No project notes yet.</p>';
    }
  }

  // Settings form
  const settingName = document.getElementById('pd-setting-name') as HTMLInputElement;
  const settingStatus = document.getElementById('pd-setting-status') as HTMLSelectElement;
  const settingProgress = document.getElementById('pd-setting-progress') as HTMLInputElement;

  if (settingName) settingName.value = project.project_name || '';
  if (settingStatus) settingStatus.value = project.status || 'pending';
  if (settingProgress) settingProgress.value = (project.progress || 0).toString();
}

function setupProjectDetailTabs(ctx: AdminDashboardContext): void {
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

// Project Messages
export async function loadProjectMessages(
  projectId: number,
  ctx: AdminDashboardContext
): Promise<void> {
  const token = ctx.getAuthToken();
  if (!token) return;

  const container = document.getElementById('pd-messages-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
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

function renderProjectMessages(messages: any[], container: HTMLElement): void {
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
  const token = ctx.getAuthToken();
  if (!token) return;

  const container = document.getElementById('pd-files-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/files`, {
      headers: { Authorization: `Bearer ${token}` }
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
      const safeName = SanitizationUtils.escapeHtml(file.original_name || file.filename);
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
  const token = ctx.getAuthToken();
  if (!token) return;

  const container = document.getElementById('pd-milestones-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/milestones`, {
      headers: { Authorization: `Bearer ${token}` }
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
}

export async function toggleMilestone(
  milestoneId: number,
  isCompleted: boolean,
  ctx: AdminDashboardContext
): Promise<void> {
  const token = ctx.getAuthToken();
  if (!token || !currentProjectId) return;

  try {
    const response = await fetch(`/api/projects/${currentProjectId}/milestones/${milestoneId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_completed: isCompleted })
    });

    if (response.ok) {
      ctx.showNotification('Milestone updated', 'success');
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
  const token = ctx.getAuthToken();
  if (!token) return;

  const container = document.getElementById('pd-invoices-list');
  if (!container) return;

  try {
    const response = await fetch(`/api/projects/${projectId}/invoices`, {
      headers: { Authorization: `Bearer ${token}` }
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

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
