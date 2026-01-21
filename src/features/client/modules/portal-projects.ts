/**
 * ===============================================
 * PORTAL PROJECTS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-projects.ts
 *
 * Project loading and display for client portal.
 * Handles mock/real project data, project list, and project details.
 */

import type { ClientProject } from '../../../types/client';
import type { ClientPortalContext, PortalProject } from '../portal-types';
import type {
  ProjectUpdateResponse,
  MessageResponse,
  ProjectDetailResponse
} from '../../../types/api';

/** API endpoints */
const PROJECTS_API_BASE = '/api/projects';

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

/** Get cached element by ID */
function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

/** Callbacks for project interactions */
export interface ProjectCallbacks {
  onProjectSelected: (project: ClientProject) => void;
  formatDate: (dateString: string) => string;
  escapeHtml: (text: string) => string;
}


/**
 * Populate the projects list in the sidebar
 */
export function populateProjectsList(
  projectsList: HTMLElement,
  projects: ClientProject[],
  onProjectSelect: (project: ClientProject) => void
): void {
  if (projects.length === 0) {
    projectsList.innerHTML = '<div class="no-projects"><p>No projects found.</p></div>';
    return;
  }

  projectsList.innerHTML = '';

  projects.forEach((project) => {
    const projectItem = document.createElement('div');
    projectItem.className = 'project-item';
    projectItem.dataset.projectId = project.id;

    projectItem.innerHTML = `
      <span class="project-icon">📄</span>
      <span class="project-name">${project.projectName}</span>
    `;

    projectItem.addEventListener('click', () => {
      onProjectSelect(project);
      document
        .querySelectorAll('.project-item')
        .forEach((item) => item.classList.remove('active'));
      projectItem.classList.add('active');
    });

    projectsList.appendChild(projectItem);
  });
}

/**
 * Fetch full project details including updates and messages from API
 */
export async function fetchProjectDetails(
  projectId: string,
  currentProject: ClientProject
): Promise<ClientProject> {
  try {
    const response = await fetch(`${PROJECTS_API_BASE}/${projectId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      console.warn('[ClientPortal] Failed to fetch project details:', response.status);
      return currentProject;
    }

    const data = await response.json();

    // Transform and update updates
    if (data.updates && Array.isArray(data.updates)) {
      currentProject.updates = data.updates.map((u: ProjectUpdateResponse) => ({
        id: String(u.id),
        date: u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        title: u.title || 'Update',
        description: u.description || '',
        author: u.author || 'System',
        type: u.update_type || 'general'
      }));
    }

      // Transform and update messages
      if (data.messages && Array.isArray(data.messages)) {
        currentProject.messages = data.messages.map((m: MessageResponse) => ({
        id: String(m.id),
        sender: m.sender_name || 'Unknown',
          senderRole: (m.sender_role === 'admin' ? 'developer' : (m.sender_role || 'system')) as 'client' | 'developer' | 'system',
        message: m.message || '',
        timestamp: m.created_at || new Date().toISOString(),
        isRead: Boolean(m.is_read)
      }));
    }

    return currentProject;
  } catch (error) {
    console.warn('[ClientPortal] Error fetching project details:', error);
    return currentProject;
  }
}

/**
 * Populate project details in the UI
 */
export function populateProjectDetails(
  currentProject: ClientProject,
  callbacks: ProjectCallbacks
): void {
  // Populate project title
  const titleElement = getElement('project-title');
  if (titleElement) {
    titleElement.textContent = currentProject.projectName;
  }

  // Populate status
  const statusElement = getElement('project-status');
  if (statusElement) {
    statusElement.textContent = currentProject.status.replace('-', ' ');
    statusElement.className = `status-badge status-${currentProject.status}`;
  }

  // Populate project description
  const descriptionElement = getElement('project-description');
  if (descriptionElement) {
    descriptionElement.textContent =
      currentProject.description || 'Project details will be updated soon.';
  }

  // Populate current phase
  const currentPhaseElement = getElement('current-phase');
  if (currentPhaseElement) {
    const phase =
      currentProject.status === 'pending'
        ? 'Initial Review'
        : currentProject.status === 'in-progress'
          ? 'Development'
          : currentProject.status === 'in-review'
            ? 'Review'
            : 'Completed';
    currentPhaseElement.textContent = phase;
  }

  // Populate next milestone
  const nextMilestoneElement = getElement('next-milestone');
  if (
    nextMilestoneElement &&
    currentProject.milestones &&
    currentProject.milestones.length > 0
  ) {
    const nextMilestone = currentProject.milestones.find((m) => !m.isCompleted);
    nextMilestoneElement.textContent = nextMilestone
      ? nextMilestone.title
      : 'No upcoming milestones';
  }

  // Populate progress
  const progressFill = getElement('progress-fill');
  const progressText = getElement('progress-text');
  if (progressFill && progressText) {
    progressFill.style.width = `${currentProject.progress}%`;
    progressText.textContent = `${currentProject.progress}% Complete`;
  }

  // Populate dates
  const startDateElement = getElement('start-date');
  if (startDateElement) {
    startDateElement.textContent = callbacks.formatDate(currentProject.startDate);
  }

  const lastUpdateElement = getElement('last-update');
  if (lastUpdateElement) {
    const lastUpdate =
      currentProject.updates && currentProject.updates.length > 0
        ? currentProject.updates[0].date
        : currentProject.startDate;
    lastUpdateElement.textContent = callbacks.formatDate(lastUpdate);
  }
}

/**
 * Load and render project updates timeline
 */
export function loadUpdates(
  currentProject: ClientProject,
  callbacks: ProjectCallbacks
): void {
  const timelineContainer = getElement('updates-timeline');
  if (!timelineContainer) return;

  timelineContainer.innerHTML = '';

  currentProject.updates.forEach((update) => {
    const updateElement = document.createElement('div');
    updateElement.className = 'timeline-item';
    // Sanitize user data to prevent XSS
    const safeTitle = callbacks.escapeHtml(update.title || '');
    const safeDescription = callbacks.escapeHtml(update.description || '');
    const safeAuthor = callbacks.escapeHtml(update.author || '');
    updateElement.innerHTML = `
      <div class="timeline-marker ${update.type}"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <h4>${safeTitle}</h4>
          <span class="timeline-date">${callbacks.formatDate(update.date)}</span>
        </div>
        <p>${safeDescription}</p>
        <div class="timeline-author">by ${safeAuthor}</div>
      </div>
    `;
    timelineContainer.appendChild(updateElement);
  });
}

/**
 * Load and render project messages
 */
export function loadMessages(
  currentProject: ClientProject,
  callbacks: ProjectCallbacks
): void {
  const messagesContainer = getElement('messages-list');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = '';

  currentProject.messages.forEach((message) => {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${message.senderRole}`;
    // Sanitize user data to prevent XSS
    const safeSender = callbacks.escapeHtml(message.sender || '');
    const safeMessage = callbacks.escapeHtml(message.message || '');
    messageElement.innerHTML = `
      <div class="message-header">
        <span class="message-sender">${safeSender}</span>
        <span class="message-time">${callbacks.formatDate(message.timestamp)}</span>
      </div>
      <div class="message-content">${safeMessage}</div>
    `;
    messagesContainer.appendChild(messageElement);
  });
}

/**
 * Load project preview into iframe
 */
export async function loadProjectPreview(_ctx: ClientPortalContext): Promise<void> {
  const iframe = getElement('preview-iframe') as HTMLIFrameElement;
  const urlDisplay = getElement('preview-url');
  const openNewTabBtn = getElement('btn-open-new-tab');
  const refreshBtn = getElement('btn-refresh-preview');

  if (!iframe) return;

  try {
    // Get client's projects to find one with a preview URL
    const response = await fetch(PROJECTS_API_BASE, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to load projects');
    }

    const data = await response.json();
    const projects = data.projects || [];

    // Find a project with a preview URL
    const projectWithPreview = projects.find((p: PortalProject) => p.preview_url);

    if (projectWithPreview && projectWithPreview.preview_url) {
      const previewUrl = projectWithPreview.preview_url;
      iframe.src = previewUrl;
      if (urlDisplay) urlDisplay.textContent = previewUrl;

      // Setup open in new tab button
      if (openNewTabBtn) {
        openNewTabBtn.onclick = () => window.open(previewUrl, '_blank');
      }

      // Setup refresh button
      if (refreshBtn) {
        refreshBtn.onclick = () => {
          iframe.src = '';
          setTimeout(() => {
            iframe.src = previewUrl;
          }, 100);
        };
      }
    } else {
      iframe.src = '';
      if (urlDisplay) urlDisplay.textContent = 'No preview available for your projects yet';
    }
  } catch (error) {
    console.error('Error loading project preview:', error);
    iframe.src = '';
    if (urlDisplay) urlDisplay.textContent = 'Error loading preview';
  }
}
