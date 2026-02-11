/**
 * ===============================================
 * ADMIN CLIENT DETAILS MODULE - CRM ENHANCEMENTS
 * ===============================================
 * @file src/features/admin/modules/admin-client-details.ts
 *
 * Enhanced client detail view with:
 * - Tabbed interface (Overview, Contacts, Activity, Projects, Notes)
 * - Health score display and breakdown
 * - Tags management
 * - Contact management
 * - Activity timeline
 * - Quick notes
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import type { AdminDashboardContext } from '../admin-types';
import { formatDateTime, formatCurrency, formatDate } from '../../../utils/format-utils';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { confirmDialog, confirmDanger, multiPromptDialog } from '../../../utils/confirm-dialog';
import { createTimeline, type TimelineEvent } from '../../../components/timeline';
import { createTagInput, type Tag } from '../../../components/tag-input';

// ============================================
// INTERFACES
// ============================================

interface ClientHealth {
  score: number;
  status: 'healthy' | 'at-risk' | 'critical';
  factors: {
    engagement: number;
    payment: number;
    project_success: number;
    communication: number;
  };
  calculated_at: string;
}

interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  role?: 'primary' | 'billing' | 'technical' | 'decision_maker' | 'other';
  is_primary: boolean;
  notes?: string;
  created_at: string;
}

interface ClientActivity {
  id: number;
  client_id: number;
  type: string;
  title: string;
  description?: string;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

interface ClientNote {
  id: number;
  client_id: number;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface ClientStats {
  // API returns camelCase
  totalProjects?: number;
  activeProjects?: number;
  completedProjects?: number;
  totalInvoiced?: number;
  totalPaid?: number;
  totalOutstanding?: number;
  avgResponseTime?: number;
}

interface ClientProject {
  id: number;
  project_name: string;
  status: string;
  created_at: string;
  progress?: number;
}

// ============================================
// STATE
// ============================================

let currentClientId: number | null = null;
let storedContext: AdminDashboardContext | null = null;
let _currentTab: string = 'overview';
let clientContacts: ClientContact[] = [];
let clientActivities: ClientActivity[] = [];
let clientNotes: ClientNote[] = [];
let clientProjects: ClientProject[] = [];
let availableTags: Tag[] = [];
let clientTags: Tag[] = [];
let clientHealth: ClientHealth | null = null;
let clientStats: ClientStats | null = null;
let timelineInstance: ReturnType<typeof createTimeline> | null = null;
let tagInputInstance: ReturnType<typeof createTagInput> | null = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text: string): string {
  return SanitizationUtils.escapeHtml(text);
}

function getHealthStatusClass(score: number): string {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

function getHealthStatusLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

function getFactorClass(value: number): string {
  if (value >= 70) return 'good';
  if (value >= 40) return 'warning';
  return 'poor';
}

// ============================================
// MAIN INITIALIZATION
// ============================================

/**
 * Initialize the enhanced client detail view with tabs
 */
export async function initClientDetailView(
  clientId: number,
  ctx: AdminDashboardContext
): Promise<void> {
  currentClientId = clientId;
  storedContext = ctx;

  // Setup tab navigation
  setupTabNavigation();

  // Load all data in parallel
  await Promise.all([
    loadClientHealth(clientId),
    loadClientContacts(clientId),
    loadClientActivities(clientId),
    loadClientNotes(clientId),
    loadClientTags(clientId),
    loadClientStats(clientId),
    loadClientProjects(clientId),
    loadAvailableTags(),
    loadClientCRMFields(clientId),
    loadClientCustomFields(clientId)
  ]);

  // Render the initial tab (overview)
  switchToTab('overview');
}

/**
 * Set up tab navigation event listeners
 */
function setupTabNavigation(): void {
  const tabsContainer = document.getElementById('client-detail-tabs');
  if (!tabsContainer) return;

  // Remove existing listeners by replacing with clone
  const newTabsContainer = tabsContainer.cloneNode(true) as HTMLElement;
  tabsContainer.parentNode?.replaceChild(newTabsContainer, tabsContainer);

  newTabsContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-cd-tab]') as HTMLButtonElement;
    if (!btn) return;

    const tabName = btn.dataset.cdTab;
    if (tabName) {
      switchToTab(tabName);
    }
  });
}

/**
 * Switch to a specific tab
 */
function switchToTab(tabName: string): void {
  _currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.client-detail-tabs button').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.cdTab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.client-detail-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `cd-tab-${tabName}`);
  });

  // Render tab content
  switch (tabName) {
  case 'overview':
    renderOverviewTab();
    break;
  case 'contacts':
    renderContactsTab();
    break;
  case 'activity':
    renderActivityTab();
    break;
  case 'projects':
    // Projects tab is handled by existing admin-clients.ts
    break;
  case 'invoices':
    // Invoices tab content populated by loadClientBilling in admin-clients.ts
    break;
  case 'notes':
    renderNotesTab();
    break;
  }
}

// ============================================
// DATA LOADING
// ============================================

async function loadClientHealth(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/health`);
    if (response.ok) {
      const data = await response.json();
      clientHealth = data.health || null;
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load health:', error);
    clientHealth = null;
  }
}

async function loadClientContacts(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/contacts`);
    if (response.ok) {
      const data = await response.json();
      clientContacts = data.contacts || [];
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load contacts:', error);
    clientContacts = [];
  }
}

async function loadClientActivities(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/activities`);
    if (response.ok) {
      const data = await response.json();
      clientActivities = data.activities || [];
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load activities:', error);
    clientActivities = [];
  }
}

async function loadClientNotes(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/notes`);
    if (response.ok) {
      const data = await response.json();
      clientNotes = data.notes || [];
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load notes:', error);
    clientNotes = [];
  }
}

async function loadClientTags(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/tags`);
    if (response.ok) {
      const data = await response.json();
      clientTags = (data.tags || []).map((t: { id: number; name: string; color: string }) => ({
        id: t.id,
        name: t.name,
        color: t.color || '#6b7280'
      }));
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load client tags:', error);
    clientTags = [];
  }
}

async function loadAvailableTags(): Promise<void> {
  try {
    const response = await apiFetch('/api/clients/tags');
    if (response.ok) {
      const data = await response.json();
      availableTags = (data.tags || []).map((t: { id: number; name: string; color: string }) => ({
        id: t.id,
        name: t.name,
        color: t.color || '#6b7280'
      }));
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load available tags:', error);
    availableTags = [];
  }
}

async function loadClientStats(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/stats`);
    if (response.ok) {
      const data = await response.json();
      clientStats = data.stats || null;
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load stats:', error);
    clientStats = null;
  }
}

async function loadClientProjects(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/projects`);
    if (response.ok) {
      const data = await response.json();
      clientProjects = data.projects || [];
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load projects:', error);
    clientProjects = [];
  }
}

// CRM fields data
let clientCRMData: {
  industry?: string;
  company_size?: string;
  acquisition_source?: string;
  website?: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  notes?: string;
} | null = null;

// Custom fields data
let clientCustomFields: Array<{
  field_id: number;
  field_name: string;
  field_type: string;
  value: string | number | boolean | null;
}> = [];

async function loadClientCRMFields(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}`);
    if (response.ok) {
      const data = await response.json();
      const client = data.client || {};
      clientCRMData = {
        industry: client.industry,
        company_size: client.company_size,
        acquisition_source: client.acquisition_source,
        website: client.website,
        last_contact_date: client.last_contact_date,
        next_follow_up_date: client.next_follow_up_date,
        notes: client.notes
      };
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load CRM fields:', error);
    clientCRMData = null;
  }
}

async function loadClientCustomFields(clientId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/custom-fields`);
    if (response.ok) {
      const data = await response.json();
      clientCustomFields = data.values || [];
    }
  } catch (error) {
    console.error('[AdminClientDetails] Failed to load custom fields:', error);
    clientCustomFields = [];
  }
}

// ============================================
// OVERVIEW TAB
// ============================================

function renderOverviewTab(): void {
  renderHealthScore();
  renderHeaderTags();
  renderStatsCompact();
  renderProjectsSummary();
  renderRecentActivity();
  renderCRMDetails();
  renderCustomFields();
  setupOverviewButtons();
}

function renderHealthScore(): void {
  const container = document.getElementById('cd-health-score-container');
  if (!container) return;

  if (!clientHealth) {
    container.innerHTML = `
      <div class="health-score-container">
        <div class="health-score-badge at-risk">
          <span>No health data</span>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-calculate-health">Calculate Health</button>
      </div>
    `;

    document.getElementById('btn-calculate-health')?.addEventListener('click', async () => {
      if (!currentClientId) return;
      try {
        const response = await apiPost(`/api/clients/${currentClientId}/health/recalculate`);
        if (response.ok) {
          await loadClientHealth(currentClientId);
          renderHealthScore();
          storedContext?.showNotification('Health score calculated', 'success');
        }
      } catch (error) {
        console.error('[ClientDetails] Failed to calculate health:', error);
        storedContext?.showNotification('Failed to calculate health', 'error');
      }
    });
    return;
  }

  const statusClass = getHealthStatusClass(clientHealth.score);
  const statusLabel = getHealthStatusLabel(clientHealth.score);

  container.innerHTML = `
    <div class="health-score-container">
      <div class="health-score-badge ${statusClass}">
        <span class="health-score-value">${clientHealth.score}</span>
        <span>${statusLabel}</span>
      </div>
    </div>
    <div class="health-factors">
      <div class="health-factor">
        <span class="health-factor-label">Engagement</span>
        <div class="health-factor-bar">
          <div class="health-factor-fill ${getFactorClass(clientHealth.factors.engagement)}" style="width: ${clientHealth.factors.engagement}%"></div>
        </div>
      </div>
      <div class="health-factor">
        <span class="health-factor-label">Payment</span>
        <div class="health-factor-bar">
          <div class="health-factor-fill ${getFactorClass(clientHealth.factors.payment)}" style="width: ${clientHealth.factors.payment}%"></div>
        </div>
      </div>
      <div class="health-factor">
        <span class="health-factor-label">Project Success</span>
        <div class="health-factor-bar">
          <div class="health-factor-fill ${getFactorClass(clientHealth.factors.project_success)}" style="width: ${clientHealth.factors.project_success}%"></div>
        </div>
      </div>
      <div class="health-factor">
        <span class="health-factor-label">Communication</span>
        <div class="health-factor-bar">
          <div class="health-factor-fill ${getFactorClass(clientHealth.factors.communication)}" style="width: ${clientHealth.factors.communication}%"></div>
        </div>
      </div>
    </div>
  `;
}

function renderHeaderTags(): void {
  const container = document.getElementById('cd-header-tags');
  if (!container) return;

  // Destroy existing instance
  if (tagInputInstance) {
    tagInputInstance.destroy();
    tagInputInstance = null;
  }

  container.innerHTML = '<div id="cd-tag-input-container"></div>';

  const tagInputContainer = document.getElementById('cd-tag-input-container');
  if (!tagInputContainer) return;

  tagInputInstance = createTagInput({
    containerId: 'cd-tag-input-container',
    availableTags,
    selectedTags: clientTags,
    onTagAdd: async (tag) => {
      if (!currentClientId) return;
      try {
        await apiPost(`/api/clients/${currentClientId}/tags/${tag.id}`);
        clientTags.push(tag);
        storedContext?.showNotification('Tag added', 'success');
      } catch (error) {
        storedContext?.showNotification('Failed to add tag', 'error');
        throw error;
      }
    },
    onTagRemove: async (tag) => {
      if (!currentClientId) return;
      try {
        await apiDelete(`/api/clients/${currentClientId}/tags/${tag.id}`);
        clientTags = clientTags.filter(t => t.id !== tag.id);
        storedContext?.showNotification('Tag removed', 'success');
      } catch (error) {
        storedContext?.showNotification('Failed to remove tag', 'error');
        throw error;
      }
    },
    onTagCreate: async (name) => {
      try {
        const response = await apiPost('/api/clients/tags', {
          name,
          color: generateTagColor()
        });
        if (response.ok) {
          const data = await response.json();
          const newTag: Tag = {
            id: data.tag.id,
            name: data.tag.name,
            color: data.tag.color
          };
          availableTags.push(newTag);

          // Also add to client
          if (currentClientId) {
            await apiPost(`/api/clients/${currentClientId}/tags/${newTag.id}`);
            clientTags.push(newTag);
          }

          storedContext?.showNotification('Tag created and added', 'success');
          return newTag;
        }
        return null;
      } catch (error) {
        console.error('[ClientDetails] Failed to create tag:', error);
        storedContext?.showNotification('Failed to create tag', 'error');
        return null;
      }
    },
    placeholder: 'Add tags...',
    allowCreate: true
  });
}

function renderStatsCompact(): void {
  const container = document.getElementById('cd-stats-container');
  if (!container) return;

  // API returns camelCase
  const activeProjects = clientStats?.activeProjects ?? 0;
  const totalProjects = clientStats?.totalProjects ?? 0;
  const totalPaid = clientStats?.totalPaid ?? 0;
  const outstanding = clientStats?.totalOutstanding ?? 0;

  container.innerHTML = `
    <div class="cd-stat-item">
      <div class="cd-stat-value">${activeProjects}</div>
      <div class="cd-stat-label">Active Projects</div>
    </div>
    <div class="cd-stat-item">
      <div class="cd-stat-value">${totalProjects}</div>
      <div class="cd-stat-label">Total Projects</div>
    </div>
    <div class="cd-stat-item">
      <div class="cd-stat-value">${formatCurrency(totalPaid)}</div>
      <div class="cd-stat-label">Total Paid</div>
    </div>
    <div class="cd-stat-item">
      <div class="cd-stat-value">${formatCurrency(outstanding)}</div>
      <div class="cd-stat-label">Outstanding</div>
    </div>
  `;
}

function renderProjectsSummary(): void {
  const container = document.getElementById('cd-overview-projects');
  if (!container) return;

  if (clientProjects.length === 0) {
    container.innerHTML = '<p class="empty-state">No projects yet</p>';
    return;
  }

  // Show up to 3 recent/active projects
  const recentProjects = clientProjects
    .filter(p => p.status !== 'completed' && p.status !== 'cancelled')
    .slice(0, 3);

  if (recentProjects.length === 0) {
    container.innerHTML = '<p class="empty-state">No active projects</p>';
    return;
  }

  container.innerHTML = `
    <div class="cd-projects-list">
      ${recentProjects.map(project => `
        <div class="cd-project-item" data-project-id="${project.id}">
          <div class="cd-project-info">
            <span class="cd-project-name">${escapeHtml(project.project_name)}</span>
            <span class="cd-project-status status-badge status-${project.status}">${project.status}</span>
          </div>
          ${project.progress !== undefined ? `
            <div class="cd-project-progress">
              <div class="cd-project-progress-bar" style="width: ${project.progress}%"></div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Add click handlers
  container.querySelectorAll('.cd-project-item').forEach(item => {
    item.addEventListener('click', () => {
      const projectId = parseInt((item as HTMLElement).dataset.projectId || '0');
      if (projectId && storedContext) {
        storedContext.switchTab('projects');
        setTimeout(() => {
          import('./admin-projects').then(module => {
            module.showProjectDetails(projectId, storedContext!);
          });
        }, 100);
      }
    });
  });
}

function setupOverviewButtons(): void {
  // View All Projects button
  const viewProjectsBtn = document.querySelector('[data-action="view-projects"]');
  if (viewProjectsBtn) {
    viewProjectsBtn.addEventListener('click', () => {
      // Switch to Projects tab
      const projectsTab = document.querySelector('[data-cd-tab="projects"]') as HTMLButtonElement;
      if (projectsTab) {
        projectsTab.click();
      }
    });
  }
}

function renderRecentActivity(): void {
  const container = document.getElementById('cd-recent-activity');
  if (!container) return;

  // Show last 5 activities
  const recentActivities = clientActivities.slice(0, 5);

  if (recentActivities.length === 0) {
    container.innerHTML = '<p class="empty-state">No recent activity</p>';
    return;
  }

  const getActivityIcon = (type: string): string => {
    switch (type) {
    case 'note':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    case 'email':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
    case 'call':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>';
    case 'meeting':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    }
  };

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  container.innerHTML = `
    <div class="cd-recent-activity-list">
      ${recentActivities.map(activity => `
        <div class="cd-activity-item">
          <div class="cd-activity-icon">${getActivityIcon(activity.type)}</div>
          <div class="cd-activity-content">
            <div class="cd-activity-title">${escapeHtml(activity.title)}</div>
            <div class="cd-activity-time">${formatRelativeTime(activity.created_at)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="cd-activity-view-all" data-action="view-all-activity">View all activity</div>
  `;

  // Add click handler for "View all activity"
  container.querySelector('[data-action="view-all-activity"]')?.addEventListener('click', () => {
    switchToTab('activity');
  });
}

function renderCRMDetails(): void {
  // Populate CRM field values
  const setValue = (id: string, value: string | null | undefined): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
  };

  if (clientCRMData) {
    setValue('cd-crm-industry', clientCRMData.industry);
    setValue('cd-crm-company-size', clientCRMData.company_size);
    setValue('cd-crm-acquisition-source', clientCRMData.acquisition_source);
    setValue('cd-crm-website', clientCRMData.website);
    setValue('cd-crm-last-contact', clientCRMData.last_contact_date ? formatDate(clientCRMData.last_contact_date) : null);
    setValue('cd-crm-next-followup', clientCRMData.next_follow_up_date ? formatDate(clientCRMData.next_follow_up_date) : null);
  }

  // Setup edit CRM button
  const editBtn = document.getElementById('cd-btn-edit-crm');
  if (editBtn && !editBtn.dataset.listenerAdded) {
    editBtn.dataset.listenerAdded = 'true';
    editBtn.addEventListener('click', showEditCRMDialog);
  }
}

async function showEditCRMDialog(): Promise<void> {
  if (!currentClientId) return;

  const result = await multiPromptDialog({
    title: 'Edit CRM Details',
    fields: [
      {
        name: 'industry',
        label: 'Industry',
        type: 'text',
        defaultValue: clientCRMData?.industry || '',
        placeholder: 'e.g., Technology, Healthcare'
      },
      {
        name: 'company_size',
        label: 'Company Size',
        type: 'select',
        defaultValue: clientCRMData?.company_size || '',
        options: [
          { value: '', label: 'Select...' },
          { value: '1-10', label: '1-10 employees' },
          { value: '11-50', label: '11-50 employees' },
          { value: '51-200', label: '51-200 employees' },
          { value: '201-500', label: '201-500 employees' },
          { value: '500+', label: '500+ employees' }
        ]
      },
      {
        name: 'acquisition_source',
        label: 'Acquisition Source',
        type: 'select',
        defaultValue: clientCRMData?.acquisition_source || '',
        options: [
          { value: '', label: 'Select...' },
          { value: 'referral', label: 'Referral' },
          { value: 'website', label: 'Website' },
          { value: 'social_media', label: 'Social Media' },
          { value: 'advertising', label: 'Advertising' },
          { value: 'cold_outreach', label: 'Cold Outreach' },
          { value: 'other', label: 'Other' }
        ]
      },
      {
        name: 'website',
        label: 'Website',
        type: 'text',
        defaultValue: clientCRMData?.website || '',
        placeholder: 'https://example.com'
      },
      {
        name: 'last_contact_date',
        label: 'Last Contact Date',
        type: 'date',
        defaultValue: clientCRMData?.last_contact_date?.split('T')[0] || ''
      },
      {
        name: 'next_follow_up_date',
        label: 'Next Follow-up Date',
        type: 'date',
        defaultValue: clientCRMData?.next_follow_up_date?.split('T')[0] || ''
      }
    ],
    confirmText: 'Save',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPut(`/api/clients/${currentClientId}/crm`, result);
    if (response.ok) {
      storedContext?.showNotification('CRM details updated', 'success');
      await loadClientCRMFields(currentClientId);
      renderCRMDetails();
    } else {
      storedContext?.showNotification('Failed to update CRM details', 'error');
    }
  } catch (error) {
    console.error('[AdminClientDetails] Error updating CRM:', error);
    storedContext?.showNotification('Error updating CRM details', 'error');
  }
}

function renderCustomFields(): void {
  const card = document.getElementById('cd-custom-fields-card');
  const container = document.getElementById('cd-custom-fields-container');
  if (!container || !card) return;

  // Hide card if no custom fields
  if (clientCustomFields.length === 0) {
    card.style.display = 'none';
    return;
  }

  // Show card and render fields
  card.style.display = '';
  container.innerHTML = `
    <div class="custom-fields-grid">
      ${clientCustomFields.map(field => `
        <div class="meta-item">
          <span class="field-label">${SanitizationUtils.escapeHtml(field.field_name)}</span>
          <span class="meta-value">${formatCustomFieldValue(field)}</span>
        </div>
      `).join('')}
    </div>
  `;

  // Setup edit custom fields button
  const editBtn = document.getElementById('cd-btn-edit-custom-fields');
  if (editBtn && !editBtn.dataset.listenerAdded) {
    editBtn.dataset.listenerAdded = 'true';
    editBtn.addEventListener('click', showEditCustomFieldsDialog);
  }
}

function formatCustomFieldValue(field: { field_type: string; value: string | number | boolean | null }): string {
  if (field.value === null || field.value === undefined || field.value === '') return '-';

  switch (field.field_type) {
  case 'boolean':
    return field.value ? 'Yes' : 'No';
  case 'date':
    return formatDate(String(field.value));
  case 'number':
    return String(field.value);
  default:
    return SanitizationUtils.escapeHtml(String(field.value));
  }
}

async function showEditCustomFieldsDialog(): Promise<void> {
  if (!currentClientId || clientCustomFields.length === 0) {
    storedContext?.showNotification('No custom fields to edit', 'info');
    return;
  }

  // Build fields dynamically based on custom field definitions
  const fields = clientCustomFields.map(field => {
    const baseField = {
      name: `field_${field.field_id}`,
      label: field.field_name,
      defaultValue: field.value !== null ? String(field.value) : ''
    };

    switch (field.field_type) {
    case 'boolean':
      return {
        ...baseField,
        type: 'select' as const,
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' }
        ],
        defaultValue: field.value ? 'true' : 'false'
      };
    case 'number':
      return { ...baseField, type: 'number' as const };
    case 'date':
      return {
        ...baseField,
        type: 'date' as const,
        defaultValue: field.value ? String(field.value).split('T')[0] : ''
      };
    case 'select':
      return { ...baseField, type: 'text' as const }; // Would need options from field definition
    default:
      return { ...baseField, type: 'text' as const };
    }
  });

  const result = await multiPromptDialog({
    title: 'Edit Custom Fields',
    fields,
    confirmText: 'Save',
    cancelText: 'Cancel'
  });

  if (!result) return;

  // Build values object
  const values: Record<number, string | number | boolean> = {};
  clientCustomFields.forEach(field => {
    const key = `field_${field.field_id}`;
    let value: string | number | boolean = result[key] || '';

    if (field.field_type === 'boolean') {
      value = result[key] === 'true';
    } else if (field.field_type === 'number' && result[key]) {
      value = parseFloat(result[key]);
    }

    values[field.field_id] = value;
  });

  try {
    const response = await apiPut(`/api/clients/${currentClientId}/custom-fields`, { values });
    if (response.ok) {
      storedContext?.showNotification('Custom fields updated', 'success');
      await loadClientCustomFields(currentClientId);
      renderCustomFields();
    } else {
      storedContext?.showNotification('Failed to update custom fields', 'error');
    }
  } catch (error) {
    console.error('[AdminClientDetails] Error updating custom fields:', error);
    storedContext?.showNotification('Error updating custom fields', 'error');
  }
}

// ============================================
// CONTACTS TAB
// ============================================

function renderContactsTab(): void {
  const container = document.getElementById('cd-tab-contacts');
  if (!container) return;

  if (clientContacts.length === 0) {
    container.innerHTML = `
      <p class="empty-state">No contacts added yet.</p>
      <button class="btn btn-secondary add-contact-btn" id="btn-add-contact">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Contact
      </button>
    `;
    setupAddContactButton();
    return;
  }

  // Sort: primary first, then by name
  const sortedContacts = [...clientContacts].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.name.localeCompare(b.name);
  });

  container.innerHTML = `
    <div class="contacts-list">
      ${sortedContacts.map(contact => renderContactCard(contact)).join('')}
    </div>
    <button class="btn btn-secondary add-contact-btn" id="btn-add-contact">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Contact
    </button>
  `;

  setupContactEventListeners();
  setupAddContactButton();
}

function renderContactCard(contact: ClientContact): string {
  const roleLabel = contact.role?.replace('_', ' ') || '';

  return `
    <div class="contact-card ${contact.is_primary ? 'primary' : ''}" data-contact-id="${contact.id}">
      <div class="contact-info">
        <div class="contact-name">
          ${escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.name))}
          ${contact.is_primary ? '<span class="primary-badge">Primary</span>' : ''}
          ${contact.role ? `<span class="contact-role-badge ${contact.role}">${roleLabel}</span>` : ''}
        </div>
        ${contact.title ? `<div class="contact-title">${escapeHtml(SanitizationUtils.decodeHtmlEntities(contact.title))}</div>` : ''}
        <div class="contact-details">
          ${contact.email ? `
            <span class="contact-detail">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              ${getEmailWithCopyHtml(contact.email, escapeHtml(contact.email))}
            </span>
          ` : ''}
          ${contact.phone ? `
            <span class="contact-detail">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
              </svg>
              ${escapeHtml(contact.phone)}
            </span>
          ` : ''}
        </div>
      </div>
      <div class="contact-actions">
        ${!contact.is_primary ? `
          <button class="icon-btn" data-action="set-primary" title="Set as primary" aria-label="Set as primary contact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        ` : ''}
        <button class="icon-btn" data-action="edit" title="Edit contact" aria-label="Edit contact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          </svg>
        </button>
        <button class="icon-btn" data-action="delete" title="Delete contact" aria-label="Delete contact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function setupContactEventListeners(): void {
  document.querySelectorAll('.contact-card').forEach(card => {
    const contactId = parseInt((card as HTMLElement).dataset.contactId || '0');

    card.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;

        switch (action) {
        case 'set-primary':
          await setContactPrimary(contactId);
          break;
        case 'edit':
          await editContact(contactId);
          break;
        case 'delete':
          await deleteContact(contactId);
          break;
        }
      });
    });
  });
}

function setupAddContactButton(): void {
  document.getElementById('btn-add-contact')?.addEventListener('click', () => {
    addContact();
  });
}

async function addContact(): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Add Contact',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'title', label: 'Job Title', type: 'text' },
      {
        name: 'role',
        label: 'Role',
        type: 'select',
        options: [
          { value: '', label: 'Select role...' },
          { value: 'primary', label: 'Primary Contact' },
          { value: 'billing', label: 'Billing Contact' },
          { value: 'technical', label: 'Technical Contact' },
          { value: 'decision_maker', label: 'Decision Maker' },
          { value: 'other', label: 'Other' }
        ]
      }
    ],
    confirmText: 'Add Contact',
    cancelText: 'Cancel'
  });

  if (!result || !currentClientId) return;

  try {
    const response = await apiPost(`/api/clients/${currentClientId}/contacts`, {
      name: result.name,
      email: result.email || null,
      phone: result.phone || null,
      title: result.title || null,
      role: result.role || null
    });

    if (response.ok) {
      const data = await response.json();
      clientContacts.push(data.contact);
      renderContactsTab();
      storedContext?.showNotification('Contact added', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to add contact:', error);
    storedContext?.showNotification('Failed to add contact', 'error');
  }
}

async function editContact(contactId: number): Promise<void> {
  const contact = clientContacts.find(c => c.id === contactId);
  if (!contact) return;

  const result = await multiPromptDialog({
    title: 'Edit Contact',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, defaultValue: contact.name },
      { name: 'email', label: 'Email', type: 'email', defaultValue: contact.email },
      { name: 'phone', label: 'Phone', type: 'text', defaultValue: contact.phone },
      { name: 'title', label: 'Job Title', type: 'text', defaultValue: contact.title },
      {
        name: 'role',
        label: 'Role',
        type: 'select',
        defaultValue: contact.role,
        options: [
          { value: '', label: 'Select role...' },
          { value: 'primary', label: 'Primary Contact' },
          { value: 'billing', label: 'Billing Contact' },
          { value: 'technical', label: 'Technical Contact' },
          { value: 'decision_maker', label: 'Decision Maker' },
          { value: 'other', label: 'Other' }
        ]
      }
    ],
    confirmText: 'Save',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPut(`/api/clients/contacts/${contactId}`, {
      name: result.name,
      email: result.email || null,
      phone: result.phone || null,
      title: result.title || null,
      role: result.role || null
    });

    if (response.ok) {
      const data = await response.json();
      const index = clientContacts.findIndex(c => c.id === contactId);
      if (index !== -1) {
        clientContacts[index] = data.contact;
      }
      renderContactsTab();
      storedContext?.showNotification('Contact updated', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to update contact:', error);
    storedContext?.showNotification('Failed to update contact', 'error');
  }
}

async function deleteContact(contactId: number): Promise<void> {
  const contact = clientContacts.find(c => c.id === contactId);
  if (!contact) return;

  const confirmed = await confirmDanger(
    `Delete contact "${contact.name}"?`,
    'Delete Contact'
  );
  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/clients/contacts/${contactId}`);
    if (response.ok) {
      clientContacts = clientContacts.filter(c => c.id !== contactId);
      renderContactsTab();
      storedContext?.showNotification('Contact deleted', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to delete contact:', error);
    storedContext?.showNotification('Failed to delete contact', 'error');
  }
}

async function setContactPrimary(contactId: number): Promise<void> {
  if (!currentClientId) return;

  const contact = clientContacts.find(c => c.id === contactId);
  if (!contact) return;

  const confirmed = await confirmDialog({
    title: 'Set Primary Contact',
    message: `Make "${contact.name}" the primary contact?`,
    confirmText: 'Yes, Set Primary',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/clients/${currentClientId}/contacts/${contactId}/set-primary`);
    if (response.ok) {
      // Update local state
      clientContacts = clientContacts.map(c => ({
        ...c,
        is_primary: c.id === contactId
      }));
      renderContactsTab();
      storedContext?.showNotification('Primary contact updated', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to update primary contact:', error);
    storedContext?.showNotification('Failed to update primary contact', 'error');
  }
}

// ============================================
// ACTIVITY TAB
// ============================================

function renderActivityTab(): void {
  const container = document.getElementById('cd-tab-activity');
  if (!container) return;

  // Destroy existing timeline
  if (timelineInstance) {
    timelineInstance.destroy();
    timelineInstance = null;
  }

  container.innerHTML = `
    <div class="activity-tab-content">
      <div class="activity-filters">
        <button class="activity-filter-btn active" data-filter="all">All</button>
        <button class="activity-filter-btn" data-filter="note">Notes</button>
        <button class="activity-filter-btn" data-filter="email">Emails</button>
        <button class="activity-filter-btn" data-filter="call">Calls</button>
        <button class="activity-filter-btn" data-filter="meeting">Meetings</button>
      </div>
      <div id="cd-activity-timeline"></div>
    </div>
    <div class="add-note-form">
      <button class="btn btn-secondary" id="btn-log-activity">Log Activity</button>
    </div>
  `;

  // Setup filter buttons
  container.querySelectorAll('.activity-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = (btn as HTMLElement).dataset.filter || 'all';
      filterActivities(filter);
    });
  });

  // Setup log activity button
  document.getElementById('btn-log-activity')?.addEventListener('click', () => {
    logActivity();
  });

  // Initial render
  filterActivities('all');
}

function filterActivities(filter: string): void {
  const filtered = filter === 'all'
    ? clientActivities
    : clientActivities.filter(a => a.type === filter);

  const events: TimelineEvent[] = filtered.map(activity => ({
    id: activity.id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    timestamp: activity.created_at,
    user: activity.created_by
  }));

  if (timelineInstance) {
    timelineInstance.refresh(events);
  } else {
    timelineInstance = createTimeline({
      containerId: 'cd-activity-timeline',
      events,
      emptyMessage: 'No activity recorded yet.',
      showLoadMore: false
    });
  }
}

async function logActivity(): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Log Activity',
    fields: [
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          { value: 'note', label: 'Note' },
          { value: 'email', label: 'Email' },
          { value: 'call', label: 'Phone Call' },
          { value: 'meeting', label: 'Meeting' }
        ]
      },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Details', type: 'textarea' }
    ],
    confirmText: 'Log Activity',
    cancelText: 'Cancel'
  });

  if (!result || !currentClientId) return;

  try {
    const response = await apiPost(`/api/clients/${currentClientId}/activities`, {
      type: result.type,
      title: result.title,
      description: result.description || null
    });

    if (response.ok) {
      const data = await response.json();
      clientActivities.unshift(data.activity);
      filterActivities('all');
      storedContext?.showNotification('Activity logged', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to log activity:', error);
    storedContext?.showNotification('Failed to log activity', 'error');
  }
}

// ============================================
// NOTES TAB
// ============================================

function renderNotesTab(): void {
  const container = document.getElementById('cd-tab-notes');
  if (!container) return;

  // Sort: pinned first, then by date
  const sortedNotes = [...clientNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  container.innerHTML = `
    <div class="add-note-form">
      <textarea id="new-note-content" class="form-textarea" placeholder="Add a quick note..." rows="3"></textarea>
      <div class="add-note-actions">
        <button class="btn btn-secondary" id="btn-add-note">Add Note</button>
      </div>
    </div>
    <div class="notes-section">
      ${sortedNotes.length === 0 ? '<p class="empty-state">No notes yet.</p>' : sortedNotes.map(note => renderNoteCard(note)).join('')}
    </div>
  `;

  setupNoteEventListeners();
}

function renderNoteCard(note: ClientNote): string {
  return `
    <div class="note-card ${note.is_pinned ? 'pinned' : ''}" data-note-id="${note.id}">
      <div class="note-header">
        <span class="note-meta">
          ${note.is_pinned ? '<svg class="note-pin-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13v-2h-4V5l4-4H5l4 4v6H5v2h4v8l2 2 2-2v-8z"/></svg>' : ''}
          ${formatDateTime(note.created_at)}
          ${note.created_by ? ` by ${escapeHtml(note.created_by)}` : ''}
        </span>
        <div class="note-actions">
          <button class="icon-btn" data-action="${note.is_pinned ? 'unpin' : 'pin'}" title="${note.is_pinned ? 'Unpin' : 'Pin'}" aria-label="${note.is_pinned ? 'Unpin note' : 'Pin note'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${note.is_pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M19 13v-2h-4V5l4-4H5l4 4v6H5v2h4v8l2 2 2-2v-8z"/>
            </svg>
          </button>
          <button class="icon-btn" data-action="delete" title="Delete" aria-label="Delete note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="note-content">${escapeHtml(note.content)}</div>
    </div>
  `;
}

function setupNoteEventListeners(): void {
  // Add note button
  document.getElementById('btn-add-note')?.addEventListener('click', async () => {
    const textarea = document.getElementById('new-note-content') as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim() || !currentClientId) return;

    try {
      const response = await apiPost(`/api/clients/${currentClientId}/notes`, {
        content: textarea.value.trim()
      });

      if (response.ok) {
        const data = await response.json();
        clientNotes.unshift(data.note);
        renderNotesTab();
        storedContext?.showNotification('Note added', 'success');
      }
    } catch (error) {
      console.error('[ClientDetails] Failed to add note:', error);
      storedContext?.showNotification('Failed to add note', 'error');
    }
  });

  // Note action buttons
  document.querySelectorAll('.note-card').forEach(card => {
    const noteId = parseInt((card as HTMLElement).dataset.noteId || '0');

    card.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = (btn as HTMLElement).dataset.action;

        if (action === 'pin' || action === 'unpin') {
          await toggleNotePin(noteId);
        } else if (action === 'delete') {
          await deleteNote(noteId);
        }
      });
    });
  });
}

async function toggleNotePin(noteId: number): Promise<void> {
  const note = clientNotes.find(n => n.id === noteId);
  if (!note) return;

  try {
    const response = await apiPut(`/api/clients/notes/${noteId}`, {
      is_pinned: !note.is_pinned
    });

    if (response.ok) {
      note.is_pinned = !note.is_pinned;
      renderNotesTab();
      storedContext?.showNotification(note.is_pinned ? 'Note pinned' : 'Note unpinned', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to update note:', error);
    storedContext?.showNotification('Failed to update note', 'error');
  }
}

async function deleteNote(noteId: number): Promise<void> {
  const confirmed = await confirmDanger('Delete this note?', 'Delete Note');
  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/clients/notes/${noteId}`);
    if (response.ok) {
      clientNotes = clientNotes.filter(n => n.id !== noteId);
      renderNotesTab();
      storedContext?.showNotification('Note deleted', 'success');
    }
  } catch (error) {
    console.error('[ClientDetails] Failed to delete note:', error);
    storedContext?.showNotification('Failed to delete note', 'error');
  }
}

// ============================================
// UTILITY
// ============================================

/**
 * Generate a random tag color
 */
function generateTagColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get health badge HTML for table display
 */
export function getHealthBadgeHtml(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return '<span class="health-badge-mini at-risk">-</span>';
  }

  const statusClass = getHealthStatusClass(score);
  return `<span class="health-badge-mini ${statusClass}">${score}</span>`;
}

/**
 * Get tags HTML for table display
 */
export function getTagsHtml(tags: Tag[]): string {
  if (!tags || tags.length === 0) return '';

  const displayTags = tags.slice(0, 3);
  const extraCount = tags.length - 3;

  let html = '<div class="table-tags">';
  html += displayTags.map(tag =>
    `<span class="table-tag-mini" style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)}">${escapeHtml(tag.name)}</span>`
  ).join('');

  if (extraCount > 0) {
    html += `<span class="table-tag-mini" style="background-color: #6b7280; color: white">+${extraCount}</span>`;
  }

  html += '</div>';
  return html;
}

/**
 * Get contrasting text color for a background color
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Export for use by admin-clients.ts
export {
  currentClientId,
  clientContacts,
  clientTags,
  clientHealth,
  loadClientHealth,
  loadClientContacts,
  loadClientTags
};
