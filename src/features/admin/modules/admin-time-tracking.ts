/**
 * ===============================================
 * ADMIN TIME TRACKING MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-time-tracking.ts
 *
 * Time entry management for projects.
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { confirmDanger, alertSuccess, alertError, multiPromptDialog } from '../../../utils/confirm-dialog';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createBarChart } from '../../../components/chart-simple';
import { exportToCsv, TIME_ENTRIES_EXPORT_CONFIG } from '../../../utils/table-export';
import { showToast } from '../../../utils/toast-notifications';

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
 * Initialize time tracking module for a project
 */
export async function initTimeTrackingModule(projectId: number): Promise<void> {
  currentProjectId = projectId;
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
    console.error('[TimeTracking] Error loading time entries:', error);
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
  const billableMinutes = currentEntries.filter(e => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalBillable = currentEntries
    .filter(e => e.is_billable && e.hourly_rate)
    .reduce((sum, e) => sum + (e.duration_minutes / 60) * (e.hourly_rate || 0), 0);

  // This week's hours
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekMinutes = currentEntries
    .filter(e => new Date(e.date) >= startOfWeek)
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
      .filter(e => e.date.startsWith(dateStr))
      .reduce((sum, e) => sum + e.duration_minutes, 0);

    days.push({
      day: dayNames[date.getDay()],
      hours: Math.round(dayMinutes / 60 * 10) / 10
    });
  }

  weeklyChart = createBarChart('time-weekly-chart-container', days.map(d => ({
    label: d.day,
    value: d.hours,
    color: 'var(--app-color-primary)'
  })), {
    showValues: true,
    barHeight: 20
  });
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
  const sortedEntries = [...currentEntries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  container.innerHTML = `
    <table class="time-entries-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Task</th>
          <th>Duration</th>
          <th>Billable</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sortedEntries.map(entry => renderEntryRow(entry)).join('')}
      </tbody>
    </table>
  `;

  // Add click handlers for edit/delete
  container.querySelectorAll('.btn-edit-entry').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const entryId = parseInt((e.target as HTMLElement).dataset.entryId || '0');
      const entry = currentEntries.find(en => en.id === entryId);
      if (entry) showEditTimeModal(entry);
    });
  });

  container.querySelectorAll('.btn-delete-entry').forEach(btn => {
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
    <tr>
      <td>${formatDate(entry.date)}</td>
      <td>${SanitizationUtils.escapeHtml(entry.description)}</td>
      <td>${entry.task_title ? SanitizationUtils.escapeHtml(entry.task_title) : '-'}</td>
      <td class="time-entry-duration">${formatDuration(entry.duration_minutes)}</td>
      <td>
        <span class="time-entry-billable ${entry.is_billable ? 'yes' : 'no'}">
          ${entry.is_billable ? 'Yes' : 'No'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="icon-btn btn-edit-entry" data-entry-id="${entry.id}" title="Edit" aria-label="Edit entry">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger btn-delete-entry" data-entry-id="${entry.id}" title="Delete" aria-label="Delete entry">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
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
      { name: 'description', label: 'Description', type: 'text', required: true, placeholder: 'What did you work on?' },
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
      { name: 'hourlyRate', label: 'Hourly Rate ($)', type: 'number', placeholder: 'Leave blank for default' }
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
    console.error('[TimeTracking] Error logging time:', error);
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
      { name: 'description', label: 'Description', type: 'text', required: true, defaultValue: entry.description },
      { name: 'hours', label: 'Hours', type: 'number', defaultValue: hours.toString() },
      { name: 'minutes', label: 'Minutes', type: 'number', defaultValue: minutes.toString() },
      { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: entry.date.split('T')[0] },
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
      { name: 'hourlyRate', label: 'Hourly Rate ($)', type: 'number', defaultValue: entry.hourly_rate?.toString() || '' }
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
    console.error('[TimeTracking] Error updating time entry:', error);
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
    console.error('[TimeTracking] Error deleting time entry:', error);
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

  exportToCsv(currentEntries as unknown as Record<string, unknown>[], config);
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
