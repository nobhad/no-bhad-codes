/**
 * ===============================================
 * PORTAL PROJECT DETAIL
 * ===============================================
 * @file src/features/client/portal-project-detail.ts
 *
 * Extracted from client-portal.ts
 * Handles project selection, detail fetching, detail population,
 * updates timeline, and messages rendering.
 */

import type { ClientProject } from '../../types/client';
import type {
  ProjectDetailResponse,
  ProjectUpdateResponse,
  MessageResponse
} from '../../types/api';
import type { ClientPortalContext } from './portal-types';
import { loadFilesModule } from './modules';
import { createDOMCache } from '../../utils/dom-cache';
import { formatTextWithLineBreaks, formatDate } from '../../utils/format-utils';
import { apiFetch, unwrapApiData } from '../../utils/api-client';
import { createStatusBadge } from '../../components/status-badge';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalProjectDetail');

/** Dependencies injected from the main portal module */
export interface ProjectDetailDeps {
  domCache: ReturnType<typeof createDOMCache>;
  moduleContext: ClientPortalContext;
  getCurrentProject: () => ClientProject | null;
  setCurrentProject: (project: ClientProject) => void;
  escapeHtml: (text: string) => string;
}

/**
 * Select a project and show its details
 */
export async function selectProject(
  project: ClientProject,
  deps: ProjectDetailDeps
): Promise<void> {
  deps.setCurrentProject(project);

  // Hide other views first
  const welcomeView = deps.domCache.get('welcomeView');
  const projectDetailView = deps.domCache.get('projectDetailView');
  const settingsView = deps.domCache.get('settingsView');
  const billingView = deps.domCache.get('billingView');

  if (welcomeView) welcomeView.style.display = 'none';
  if (settingsView) settingsView.style.display = 'none';
  if (billingView) billingView.style.display = 'none';
  if (projectDetailView) projectDetailView.style.display = 'block';

  // Clear active state from navigation items
  document.querySelectorAll('.account-item').forEach((item) => item.classList.remove('active'));

  // For authenticated users, fetch full project details (updates, messages)
  const authMode = sessionStorage.getItem('client_auth_mode');
  if (authMode === 'authenticated') {
    await fetchProjectDetails(project.id, deps);
  }

  populateProjectDetails(deps);
}

/**
 * Fetch full project details including updates and messages from API
 */
async function fetchProjectDetails(
  projectId: string,
  deps: ProjectDetailDeps
): Promise<void> {
  const currentProject = deps.getCurrentProject();
  if (!currentProject) return;

  try {
    // Fetch project details from API
    const response = await apiFetch(`/api/projects/${projectId}`);

    if (!response.ok) {
      logger.warn('Failed to fetch project details:', response.status);
      return;
    }

    const raw = await response.json();
    const data = unwrapApiData<ProjectDetailResponse>(raw);

    // Transform and update updates
    if (data.updates && Array.isArray(data.updates)) {
      currentProject.updates = data.updates.map((u: ProjectUpdateResponse) => ({
        id: String(u.id),
        date: u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        title: u.title || 'Update',
        description: u.description || '',
        author: (u as { author?: string }).author || 'System',
        type: (u.update_type || 'general') as
          | 'progress'
          | 'milestone'
          | 'issue'
          | 'resolution'
          | 'general'
      }));
    }

    // Transform and update messages
    if (data.messages && Array.isArray(data.messages)) {
      currentProject.messages = data.messages.map((m: MessageResponse) => ({
        id: String(m.id),
        sender: m.sender_name || 'Unknown',
        senderRole: (m.sender_role === 'admin' ? 'developer' : m.sender_role || 'system') as
          | 'client'
          | 'developer'
          | 'system',
        message: m.message || '',
        timestamp: m.created_at || new Date().toISOString(),
        isRead: m.read_at !== null
      }));
    }
  } catch (error) {
    logger.warn('Error fetching project details:', error);
  }
}

/**
 * Populate project details in the DOM
 */
function populateProjectDetails(deps: ProjectDetailDeps): void {
  const currentProject = deps.getCurrentProject();
  if (!currentProject) return;

  // Populate project title
  const titleElement = deps.domCache.get('projectTitle');
  if (titleElement) {
    titleElement.textContent = currentProject.projectName;
  }

  // Populate status using shared component
  const statusElement = deps.domCache.get('projectStatus');
  if (statusElement && statusElement.parentElement) {
    const statusLabel = currentProject.status.replace('-', ' ');
    const newBadge = createStatusBadge(statusLabel, currentProject.status);
    newBadge.id = statusElement.id;
    statusElement.replaceWith(newBadge);
    deps.domCache.invalidate('projectStatus');
  }

  // Populate project description (use innerHTML with sanitized line breaks)
  const descriptionElement = deps.domCache.get('projectDescriptionEl');
  if (descriptionElement) {
    descriptionElement.innerHTML = formatTextWithLineBreaks(
      currentProject.description || 'Project details will be updated soon.'
    );
  }

  // Populate current phase
  const currentPhaseElement = deps.domCache.get('currentPhase');
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
  const nextMilestoneElement = deps.domCache.get('nextMilestone');
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
  const progressFill = deps.domCache.get('progressFill');
  const progressText = deps.domCache.get('progressText');
  if (progressFill && progressText) {
    progressFill.style.width = `${currentProject.progress}%`;
    progressText.textContent = `${currentProject.progress}% Complete`;
  }

  // Populate dates
  const startDateElement = deps.domCache.get('startDate');
  if (startDateElement) {
    startDateElement.textContent = formatDate(currentProject.startDate);
  }

  const lastUpdateElement = deps.domCache.get('lastUpdate');
  if (lastUpdateElement) {
    const lastUpdate =
      currentProject.updates && currentProject.updates.length > 0
        ? currentProject.updates[0].date
        : currentProject.startDate;
    lastUpdateElement.textContent = formatDate(lastUpdate);
  }

  // Load sections
  loadUpdates(deps);
  loadFilesModule().then((filesModule) => filesModule.loadFiles(deps.moduleContext));
  loadMessages(deps);
}

/**
 * Load project updates into the timeline
 */
function loadUpdates(deps: ProjectDetailDeps): void {
  const currentProject = deps.getCurrentProject();
  if (!currentProject) return;

  const timelineContainer = deps.domCache.get('updatesTimeline');
  if (!timelineContainer) return;

  timelineContainer.innerHTML = '';

  currentProject.updates.forEach((update) => {
    const updateElement = document.createElement('div');
    updateElement.className = 'timeline-item';
    // Sanitize user data to prevent XSS
    const safeTitle = deps.escapeHtml(update.title || '');
    const safeDescription = deps.escapeHtml(update.description || '');
    const safeAuthor = deps.escapeHtml(update.author || '');
    updateElement.innerHTML = `
        <div class="timeline-marker ${update.type}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h4>${safeTitle}</h4>
            <span class="timeline-date">${formatDate(update.date)}</span>
          </div>
          <p>${safeDescription}</p>
          <div class="timeline-author">by ${safeAuthor}</div>
        </div>
      `;
    timelineContainer.appendChild(updateElement);
  });
}

/**
 * Load project messages
 */
function loadMessages(deps: ProjectDetailDeps): void {
  const currentProject = deps.getCurrentProject();
  if (!currentProject) return;

  const messagesContainer = deps.domCache.get('messagesList');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = '';

  currentProject.messages.forEach((message) => {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${message.senderRole}`;
    // Sanitize user data to prevent XSS
    const safeSender = deps.escapeHtml(message.sender || '');
    const safeMessage = deps.escapeHtml(message.message || '');
    messageElement.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${safeSender}</span>
          <span class="message-time">${formatDate(message.timestamp)}</span>
        </div>
        <div class="message-content">${safeMessage}</div>
      `;
    messagesContainer.appendChild(messageElement);
  });
}
