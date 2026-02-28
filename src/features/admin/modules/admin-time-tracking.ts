/**
 * ===============================================
 * ADMIN TIME TRACKING MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-time-tracking.ts
 *
 * Time entry management for projects.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import {
  confirmDanger,
  alertSuccess,
  alertError,
  multiPromptDialog
} from '../../../utils/confirm-dialog';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createBarChart } from '../../../components/chart-simple';
import { exportDataToCsv, TIME_ENTRIES_EXPORT_CONFIG } from '../../../utils/table-export';
import { showToast } from '../../../utils/toast-notifications';
import { renderActionsCell, createAction } from '../../../factories';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('TimeTracking');

// ============================================
// STORED CONTEXT FOR AUTH
// ============================================

let _storedContext: AdminDashboardContext | null = null;

/**
 * Set the admin dashboard context for auth token access
 */
export function setTimeTrackingContext(ctx: AdminDashboardContext): void {
  _storedContext = ctx;
}

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn =
  typeof import('../../../react/features/admin/time-tracking').mountTimeTrackingPanel;
type ReactUnmountFn =
  typeof import('../../../react/features/admin/time-tracking').unmountTimeTrackingPanel;

let mountTimeTrackingPanel: ReactMountFn | null = null;
let unmountTimeTrackingPanel: ReactUnmountFn | null = null;
let reactTableMounted = false;
let reactMountContainer: HTMLElement | null = null;

/**
 * Check if React table is actually mounted (container exists and has content)
 */
function isReactTableActuallyMounted(): boolean {
  if (!reactTableMounted) return false;
  // Check if the container still exists in the DOM and has content
  if (
    !reactMountContainer ||
    !reactMountContainer.isConnected ||
    reactMountContainer.children.length === 0
  ) {
    reactTableMounted = false;
    reactMountContainer = null;
    return false;
  }
  return true;
}

/** Lazy load React mount functions */
async function loadReactTimeTrackingPanel(): Promise<boolean> {
  if (mountTimeTrackingPanel && unmountTimeTrackingPanel) return true;

  try {
    const module = await import('../../../react/features/admin/time-tracking');
    mountTimeTrackingPanel = module.mountTimeTrackingPanel;
    unmountTimeTrackingPanel = module.unmountTimeTrackingPanel;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

/** Feature flag for React time tracking table */
function shouldUseReactTimeTrackingTable(): boolean {
  return true;
}

// Time entry interfaces
interface TimeEntry {
  id: number;
  project_id: number;
  task_id?: number;
  task_title?: string;
  user_email: string;
  user_name?: string;
  description: string;
  duration_minutes: number;
  date: string;
  is_billable: boolean;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
}

interface WeeklyData {
  day: string;
  hours: number;
}

// Module state
let currentProjectId: number | null = null;
let currentEntries: TimeEntry[] = [];
let weeklyChart: ReturnType<typeof createBarChart> | null = null;

/**
 * Renders the Time Tracking tab structure dynamically.
 * Called before loading data.
 */
export function renderTimeTrackingTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactTimeTrackingTable();

  if (useReact) {
    // React implementation - render minimal container
    container.innerHTML = `
      <!-- React Time Tracking Table Mount Point -->
      <div id="react-time-tracking-mount"></div>
    `;
    return;
  }

  // Vanilla implementation - original HTML structure
  container.innerHTML = `
    <div id="time-tracking-summary" class="time-tracking-summary"></div>
    <div id="time-weekly-chart-container" class="time-weekly-chart-container"></div>
    <div id="time-entries-list" class="time-entries-list"></div>
  `;
}

/**
 * Initialize time tracking module for a project
 */
export async function initTimeTrackingModule(projectId: number): Promise<void> {
  currentProjectId = projectId;

  // Check if React implementation should be used
  const useReact = shouldUseReactTimeTrackingTable();

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React TimeTrackingPanel
    const mountContainer = document.getElementById('react-time-tracking-mount');
    if (mountContainer) {
      const loaded = await loadReactTimeTrackingPanel();
      if (loaded && mountTimeTrackingPanel) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountTimeTrackingPanel) {
          unmountTimeTrackingPanel();
        }
        mountTimeTrackingPanel(mountContainer, {
          projectId: String(projectId),
          getAuthToken: _storedContext?.getAuthToken,
          showNotification: _storedContext?.showNotification
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        return;
      }
    }
  }

  // Fallback to vanilla implementation
  await loadTimeEntries();
  renderTimeTracking();
  setupEventHandlers();
}

/**
 * Load time entries from API
 */
async function loadTimeEntries(): Promise<void> {
  if (!currentProjectId) return;

  try {
    const response = await apiFetch(`/api/projects/${currentProjectId}/time-entries`);
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      currentEntries = data.entries || [];
    } else {
      currentEntries = [];
    }
  } catch (error) {
    logger.error(' Error loading time entries:', error);
    currentEntries = [];
  }
}

/**
 * Set up event handlers
 */
function setupEventHandlers(): void {
  const logTimeBtn = document.getElementById('btn-log-time');
  if (logTimeBtn && !logTimeBtn.dataset.listenerAdded) {
    logTimeBtn.dataset.listenerAdded = 'true';
    logTimeBtn.addEventListener('click', showLogTimeModal);
  }

  const exportBtn = document.getElementById('btn-export-time');
  if (exportBtn && !exportBtn.dataset.listenerAdded) {
    exportBtn.dataset.listenerAdded = 'true';
    exportBtn.addEventListener('click', exportTimeEntries);
  }
}

/**
 * Render time tracking UI
 */
function renderTimeTracking(): void {
  renderSummary();
  renderWeeklyChart();
  renderEntriesTable();
}

/**
 * Render summary cards
 */
function renderSummary(): void {
  const container = document.getElementById('time-tracking-summary');
  if (!container) return;

  // Calculate totals
  const totalMinutes = currentEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const billableMinutes = currentEntries
    .filter((e) => e.is_billable)
    .reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalBillable = currentEntries
    .filter((e) => e.is_billable && e.hourly_rate)
    .reduce((sum, e) => sum + (e.duration_minutes / 60) * (e.hourly_rate || 0), 0);

  // This week's hours
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekMinutes = currentEntries
    .filter((e) => new Date(e.date) >= startOfWeek)
    .reduce((sum, e) => sum + e.duration_minutes, 0);

  container.innerHTML = `
    <div class="time-summary-card">
      <div class="time-summary-value">${formatDuration(totalMinutes)}</div>
      <div class="time-summary-label">Total Hours</div>
    </div>
    <div class="time-summary-card">
      <div class="time-summary-value">${formatDuration(thisWeekMinutes)}</div>
      <div class="time-summary-label">This Week</div>
    </div>
    <div class="time-summary-card">
      <div class="time-summary-value">${formatDuration(billableMinutes)}</div>
      <div class="time-summary-label">Billable Hours</div>
    </div>
    <div class="time-summary-card">
      <div class="time-summary-value">$${totalBillable.toFixed(2)}</div>
      <div class="time-summary-label">Billable Amount</div>
    </div>
  `;
}

/**
 * Format duration in minutes to readable format
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Render weekly chart
 */
function renderWeeklyChart(): void {
  const container = document.getElementById('time-weekly-chart-container');
  if (!container) return;

  // Destroy existing chart
  if (weeklyChart) {
    weeklyChart.destroy();
    weeklyChart = null;
  }

  // Get last 7 days
  const days: WeeklyData[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dateStr = date.toISOString().split('T')[0];
    const dayMinutes = currentEntries
      .filter((e) => e.date.startsWith(dateStr))
      .reduce((sum, e) => sum + e.duration_minutes, 0);

    days.push({
      day: dayNames[date.getDay()],
      hours: Math.round((dayMinutes / 60) * 10) / 10
    });
  }

  weeklyChart = createBarChart(
    'time-weekly-chart-container',
    days.map((d) => ({
      label: d.day,
      value: d.hours,
      color: 'var(--app-color-primary)'
    })),
    {
      showValues: true,
      barHeight: 20
    }
  );
}

/**
 * Render entries table
 */
function renderEntriesTable(): void {
  const container = document.getElementById('time-entries-list');
  if (!container) return;

  if (currentEntries.length === 0) {
    container.innerHTML = '<div class="time-entries-empty">No time entries yet.</div>';
    return;
  }

  // Sort by date, most recent first
  const sortedEntries = [...currentEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  container.innerHTML = `
    <div class="data-table-container">
      <div class="data-table-scroll-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col" class="date-col">Date</th>
              <th scope="col" class="name-col">Description</th>
              <th scope="col" class="name-col">Task</th>
              <th scope="col" class="type-col">Duration</th>
              <th scope="col" class="status-col">Billable</th>
              <th scope="col" class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="time-entries-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
            ${sortedEntries.map((entry) => renderEntryRow(entry)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Initialize keyboard navigation for time entries table
  initTableKeyboardNav({
    tableSelector: '#time-entries-table-body',
    rowSelector: 'tr[data-entry-id]',
    onRowSelect: (row) => {
      const editBtn = row.querySelector('.btn-edit-entry') as HTMLButtonElement;
      if (editBtn) editBtn.click();
    },
    focusClass: 'row-focused',
    selectedClass: 'row-selected'
  });

  // Add click handlers for edit/delete
  container.querySelectorAll('.btn-edit-entry').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const entryId = parseInt((e.target as HTMLElement).dataset.entryId || '0');
      const entry = currentEntries.find((en) => en.id === entryId);
      if (entry) showEditTimeModal(entry);
    });
  });

  container.querySelectorAll('.btn-delete-entry').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const entryId = parseInt((e.target as HTMLElement).dataset.entryId || '0');
      await deleteTimeEntry(entryId);
    });
  });
}

/**
 * Render a single entry row
 */
function renderEntryRow(entry: TimeEntry): string {
  return `
    <tr data-entry-id="${entry.id}">
      <td class="date-cell" data-label="Date">${formatDate(entry.date)}</td>
      <td class="name-cell" data-label="Description">${SanitizationUtils.escapeHtml(entry.description)}</td>
      <td class="name-cell" data-label="Task">${entry.task_title ? SanitizationUtils.escapeHtml(entry.task_title) : '-'}</td>
      <td class="type-cell" data-label="Duration">${formatDuration(entry.duration_minutes)}</td>
      <td class="status-cell" data-label="Billable">
        <span class="time-entry-billable ${entry.is_billable ? 'yes' : 'no'}">
          ${entry.is_billable ? 'Yes' : 'No'}
        </span>
      </td>
      <td class="actions-cell" data-label="Actions">
        ${renderActionsCell([
    createAction('edit', entry.id, {
      className: 'btn-edit-entry',
      dataAttrs: { 'entry-id': entry.id },
      ariaLabel: 'Edit entry'
    }),
    createAction('delete', entry.id, {
      className: 'btn-delete-entry',
      dataAttrs: { 'entry-id': entry.id },
      ariaLabel: 'Delete entry'
    })
  ])}
      </td>
    </tr>
  `;
}

/**
 * Show log time modal
 */
export async function showLogTimeModal(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const result = await multiPromptDialog({
    title: 'Log Time',
    fields: [
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        placeholder: 'What did you work on?'
      },
      { name: 'hours', label: 'Hours', type: 'number', placeholder: '0', defaultValue: '0' },
      { name: 'minutes', label: 'Minutes', type: 'number', placeholder: '0', defaultValue: '0' },
      { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today },
      {
        name: 'isBillable',
        label: 'Billable',
        type: 'select',
        defaultValue: 'true',
        options: [
          { value: 'true', label: 'Yes - Billable' },
          { value: 'false', label: 'No - Non-billable' }
        ]
      },
      {
        name: 'hourlyRate',
        label: 'Hourly Rate ($)',
        type: 'number',
        placeholder: 'Leave blank for default'
      }
    ],
    confirmText: 'Log Time',
    cancelText: 'Cancel'
  });

  if (!result) return;

  const hours = parseInt(result.hours) || 0;
  const minutes = parseInt(result.minutes) || 0;
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes === 0) {
    alertError('Please enter a duration');
    return;
  }

  try {
    const response = await apiPost(`/api/projects/${currentProjectId}/time-entries`, {
      description: result.description,
      duration_minutes: totalMinutes,
      date: result.date,
      is_billable: result.isBillable === 'true',
      hourly_rate: result.hourlyRate ? parseFloat(result.hourlyRate) : null
    });

    if (response.ok) {
      alertSuccess('Time logged successfully!');
      await loadTimeEntries();
      renderTimeTracking();
    } else {
      alertError('Failed to log time');
    }
  } catch (error) {
    logger.error(' Error logging time:', error);
    alertError('Error logging time');
  }
}

/**
 * Show edit time modal
 */
async function showEditTimeModal(entry: TimeEntry): Promise<void> {
  const hours = Math.floor(entry.duration_minutes / 60);
  const minutes = entry.duration_minutes % 60;

  const result = await multiPromptDialog({
    title: 'Edit Time Entry',
    fields: [
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        defaultValue: entry.description
      },
      { name: 'hours', label: 'Hours', type: 'number', defaultValue: hours.toString() },
      { name: 'minutes', label: 'Minutes', type: 'number', defaultValue: minutes.toString() },
      {
        name: 'date',
        label: 'Date',
        type: 'date',
        required: true,
        defaultValue: entry.date.split('T')[0]
      },
      {
        name: 'isBillable',
        label: 'Billable',
        type: 'select',
        defaultValue: entry.is_billable ? 'true' : 'false',
        options: [
          { value: 'true', label: 'Yes - Billable' },
          { value: 'false', label: 'No - Non-billable' }
        ]
      },
      {
        name: 'hourlyRate',
        label: 'Hourly Rate ($)',
        type: 'number',
        defaultValue: entry.hourly_rate?.toString() || ''
      }
    ],
    confirmText: 'Save Changes',
    cancelText: 'Cancel'
  });

  if (!result) return;

  const newHours = parseInt(result.hours) || 0;
  const newMinutes = parseInt(result.minutes) || 0;
  const totalMinutes = newHours * 60 + newMinutes;

  if (totalMinutes === 0) {
    alertError('Please enter a duration');
    return;
  }

  try {
    const response = await apiPut(`/api/projects/${currentProjectId}/time-entries/${entry.id}`, {
      description: result.description,
      duration_minutes: totalMinutes,
      date: result.date,
      is_billable: result.isBillable === 'true',
      hourly_rate: result.hourlyRate ? parseFloat(result.hourlyRate) : null
    });

    if (response.ok) {
      alertSuccess('Time entry updated!');
      await loadTimeEntries();
      renderTimeTracking();
    } else {
      alertError('Failed to update time entry');
    }
  } catch (error) {
    logger.error(' Error updating time entry:', error);
    alertError('Error updating time entry');
  }
}

/**
 * Delete time entry
 */
async function deleteTimeEntry(entryId: number): Promise<void> {
  const confirmed = await confirmDanger(
    'Are you sure you want to delete this time entry?',
    'Delete Entry'
  );

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/projects/${currentProjectId}/time-entries/${entryId}`);

    if (response.ok) {
      alertSuccess('Time entry deleted');
      await loadTimeEntries();
      renderTimeTracking();
    } else {
      alertError('Failed to delete time entry');
    }
  } catch (error) {
    logger.error(' Error deleting time entry:', error);
    alertError('Error deleting time entry');
  }
}

/**
 * Export time entries to CSV using shared utility
 */
function exportTimeEntries(): void {
  if (currentEntries.length === 0) {
    alertError('No time entries to export');
    return;
  }

  // Create custom config with project-specific filename
  const config = {
    ...TIME_ENTRIES_EXPORT_CONFIG,
    filename: `time_entries_project_${currentProjectId}`
  };

  exportDataToCsv(currentEntries, config);
  showToast('Time entries exported!', 'success');
}

/**
 * Cleanup module
 */
export function cleanup(): void {
  if (weeklyChart) {
    weeklyChart.destroy();
    weeklyChart = null;
  }
  currentProjectId = null;
  currentEntries = [];
}

/**
 * Cleanup function called when leaving the time tracking tab
 * Unmounts React components if they were mounted
 */
export function cleanupTimeTrackingTab(): void {
  if (reactTableMounted && unmountTimeTrackingPanel) {
    unmountTimeTrackingPanel();
    reactTableMounted = false;
    reactMountContainer = null;
  }
}
