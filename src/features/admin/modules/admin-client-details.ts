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
import type { AdminDashboardContext } from '../admin-types';
import { formatDateTime, formatCurrency } from '../../../utils/format-utils';
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
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  avg_response_time?: number;
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
    loadAvailableTags()
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

// ============================================
// OVERVIEW TAB
// ============================================

function renderOverviewTab(): void {
  renderHealthScore();
  renderTagsSection();
  renderStatsSection();
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
      } catch (_error) {
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

function renderTagsSection(): void {
  const container = document.getElementById('cd-tags-container');
  if (!container) return;

  // Destroy existing instance
  if (tagInputInstance) {
    tagInputInstance.destroy();
    tagInputInstance = null;
  }

  container.innerHTML = `
    <div class="client-tags-section">
      <div class="client-tags-header">
        <h4>Tags</h4>
      </div>
      <div id="cd-tag-input-container"></div>
    </div>
  `;

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
      } catch (_error) {
        storedContext?.showNotification('Failed to create tag', 'error');
        return null;
      }
    },
    placeholder: 'Add tags...',
    allowCreate: true
  });
}

function renderStatsSection(): void {
  const container = document.getElementById('cd-stats-container');
  if (!container || !clientStats) return;

  container.innerHTML = `
    <div class="client-stats-row">
      <div class="client-stat-item">
        <div class="client-stat-value">${clientStats.total_projects}</div>
        <div class="client-stat-label">Total Projects</div>
      </div>
      <div class="client-stat-item">
        <div class="client-stat-value">${clientStats.active_projects}</div>
        <div class="client-stat-label">Active</div>
      </div>
      <div class="client-stat-item">
        <div class="client-stat-value">${formatCurrency(clientStats.total_paid)}</div>
        <div class="client-stat-label">Total Paid</div>
      </div>
      <div class="client-stat-item">
        <div class="client-stat-value">${formatCurrency(clientStats.outstanding)}</div>
        <div class="client-stat-label">Outstanding</div>
      </div>
    </div>
  `;
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
          ${escapeHtml(contact.name)}
          ${contact.is_primary ? '<span class="primary-badge">Primary</span>' : ''}
          ${contact.role ? `<span class="contact-role-badge ${contact.role}">${roleLabel}</span>` : ''}
        </div>
        ${contact.title ? `<div class="contact-title">${escapeHtml(contact.title)}</div>` : ''}
        <div class="contact-details">
          ${contact.email ? `
            <span class="contact-detail">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              ${escapeHtml(contact.email)}
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
          <button class="icon-btn" data-action="set-primary" title="Set as primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        ` : ''}
        <button class="icon-btn" data-action="edit" title="Edit contact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          </svg>
        </button>
        <button class="icon-btn" data-action="delete" title="Delete contact">
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
  } catch (_error) {
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
  } catch (_error) {
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
  } catch (_error) {
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
  } catch (_error) {
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
  } catch (_error) {
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
          <button class="icon-btn" data-action="${note.is_pinned ? 'unpin' : 'pin'}" title="${note.is_pinned ? 'Unpin' : 'Pin'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${note.is_pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M19 13v-2h-4V5l4-4H5l4 4v6H5v2h4v8l2 2 2-2v-8z"/>
            </svg>
          </button>
          <button class="icon-btn" data-action="delete" title="Delete">
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
    } catch (_error) {
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
  } catch (_error) {
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
  } catch (_error) {
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
