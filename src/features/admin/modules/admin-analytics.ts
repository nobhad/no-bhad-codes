/**
 * ===============================================
 * ADMIN ANALYTICS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-analytics.ts
 *
 * Analytics and performance tracking for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { Chart, registerables } from 'chart.js';
import { getChartColor, getChartColorWithAlpha } from '../../../config/constants';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import type {
  PerformanceMetricsDisplay,
  AnalyticsData,
  AnalyticsDataItem,
  RawVisitorData,
  AdminDashboardContext
} from '../admin-types';
import { formatDateTime, formatCurrencyCompact } from '../../../utils/format-utils';
import { showTableLoading, getChartSkeletonHTML } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { multiPromptDialog, alertDialog, confirmDialog } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { loadLeadAnalytics, loadScoringRules } from './admin-leads';
import { loadAdHocAnalytics } from './admin-ad-hoc-analytics';

// Register Chart.js components
Chart.register(...registerables);

const charts: Map<string, Chart> = new Map();

export async function loadAnalyticsCharts(ctx: AdminDashboardContext): Promise<void> {
  // Setup event listeners for analytics controls
  setupAnalyticsEventListeners();

  // Load all analytics charts in parallel
  await Promise.all([
    loadBusinessKPIs(),
    loadRevenueChart(),
    loadProjectStatusChart(),
    loadLeadFunnel(),
    loadSavedReports(),
    loadScheduledReports(),
    loadMetricAlerts(),
    loadVisitorsChart(),
    loadSourcesChart(),
    loadAnalyticsSummary(),
    loadLeadAnalytics(),
    loadScoringRules(),
    loadAdHocAnalytics(ctx)
  ]);
}

// =====================================================
// EVENT LISTENER SETUP
// =====================================================

let analyticsListenersInitialized = false;

function setupAnalyticsEventListeners(): void {
  if (analyticsListenersInitialized) return;
  analyticsListenersInitialized = true;

  // Analytics Sub-Tab Switching
  setupAnalyticsSubtabs();

  // Create Report button
  const createReportBtn = document.getElementById('create-report-btn');
  if (createReportBtn) {
    createReportBtn.addEventListener('click', showCreateReportDialog);
  }

  // Create Alert button
  const createAlertBtn = document.getElementById('create-alert-btn');
  if (createAlertBtn) {
    createAlertBtn.addEventListener('click', showCreateAlertDialog);
  }
}

/**
 * Setup analytics sub-tab navigation
 */
function setupAnalyticsSubtabs(): void {
  const subtabButtons = document.querySelectorAll('.analytics-subtab');
  const subtabContents = document.querySelectorAll('.analytics-subtab-content');

  if (subtabButtons.length === 0) return;

  subtabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-subtab');
      if (!targetTab) return;

      // Update button states
      subtabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content visibility
      subtabContents.forEach(content => {
        const contentId = content.id;
        if (contentId === `analytics-subtab-${targetTab}`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
}

// =====================================================
// BUSINESS KPI FUNCTIONS
// =====================================================

async function loadBusinessKPIs(): Promise<void> {
  try {
    // Load all KPI data in parallel
    const [revenueRes, pipelineRes, projectsRes] = await Promise.all([
      apiFetch('/api/analytics/quick/revenue'),
      apiFetch('/api/analytics/quick/pipeline'),
      apiFetch('/api/analytics/quick/projects')
    ]);

    // Process revenue KPI
    // Backend returns: { data: [...], summary: { total_revenue, total_invoices, avg_invoice } }
    if (revenueRes.ok) {
      const revenueData = await revenueRes.json();
      const totalRevenue = revenueData.summary?.total_revenue || 0;
      updateElement('kpi-revenue-value', formatCurrencyCompact(totalRevenue));

      const changeEl = document.getElementById('kpi-revenue-change');
      if (changeEl) {
        // Calculate month-over-month if we have monthly data
        const monthlyData = revenueData.data || [];
        let change = 0;
        if (monthlyData.length >= 2) {
          const currentMonth = monthlyData[monthlyData.length - 1]?.total_revenue || 0;
          const previousMonth = monthlyData[monthlyData.length - 2]?.total_revenue || 0;
          if (previousMonth > 0) {
            change = ((currentMonth - previousMonth) / previousMonth) * 100;
          }
        }
        const changeValue = changeEl.querySelector('.change-value');
        if (changeValue) {
          changeValue.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        }
        changeEl.className = `kpi-card-change ${change >= 0 ? 'positive' : 'negative'}`;
      }
    }

    // Process pipeline KPI
    // Backend returns: { data: [...], summary: { total_leads, total_pipeline_value, won_count } }
    if (pipelineRes.ok) {
      const pipelineData = await pipelineRes.json();
      const totalValue = pipelineData.summary?.total_pipeline_value || 0;
      const totalLeads = pipelineData.summary?.total_leads || 0;
      updateElement('kpi-pipeline-value', formatCurrencyCompact(totalValue));

      const countEl = document.getElementById('kpi-pipeline-count');
      if (countEl) {
        const countValue = countEl.querySelector('.change-value');
        if (countValue) {
          countValue.textContent = String(totalLeads);
        }
      }
    }

    // Process projects KPI
    // Backend returns: { data: [...], summary: { total_projects, active_projects, completed_projects, total_hours } }
    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      const activeProjects = projectsData.summary?.active_projects || 0;
      const totalProjects = projectsData.summary?.total_projects || 0;
      const completedProjects = projectsData.summary?.completed_projects || 0;
      updateElement('kpi-projects-value', String(activeProjects));

      const completionEl = document.getElementById('kpi-projects-completion');
      if (completionEl) {
        const completionValue = completionEl.querySelector('.change-value');
        if (completionValue) {
          // Calculate completion rate as completed / total * 100
          const completionRate = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;
          completionValue.textContent = `${completionRate}%`;
        }
      }
    }

    // Load outstanding invoices from invoices endpoint
    // Backend returns: { success, invoices: [{ amount_total, ... }], total, limit, offset }
    try {
      const invoicesRes = await apiFetch('/api/invoices/search?status=sent,overdue');
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        const invoices = invoicesData.invoices || [];
        // Use amount_total (snake_case from backend)
        const outstandingTotal = invoices.reduce((sum: number, inv: { amount_total?: number }) =>
          sum + (inv.amount_total || 0), 0);
        updateElement('kpi-invoices-value', formatCurrencyCompact(outstandingTotal));

        const countEl = document.getElementById('kpi-invoices-count');
        if (countEl) {
          const countValue = countEl.querySelector('.change-value');
          if (countValue) {
            countValue.textContent = String(invoices.length);
          }
        }
      }
    } catch (e) {
      console.warn('[AdminAnalytics] Could not load invoice KPIs:', e);
    }

  } catch (error) {
    console.error('[AdminAnalytics] Error loading business KPIs:', error);
  }
}

async function loadRevenueChart(): Promise<void> {
  const canvas = document.getElementById('revenue-chart') as HTMLCanvasElement;
  if (!canvas) return;

  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Revenue by month chart');

  // Show skeleton while loading
  const chartContainer = canvas.parentElement;
  if (chartContainer) {
    canvas.style.display = 'none';
    const skeleton = document.createElement('div');
    skeleton.className = 'chart-skeleton-wrapper';
    skeleton.innerHTML = getChartSkeletonHTML();
    chartContainer.appendChild(skeleton);
  }

  // Destroy existing chart
  if (charts.has('revenue')) {
    charts.get('revenue')?.destroy();
  }

  let labels: string[] = [];
  let data: number[] = [];

  try {
    const response = await apiFetch('/api/analytics/quick/revenue?days=180');
    if (response.ok) {
      const result = await response.json();
      // Backend returns { data: [{ month, invoice_count, total_revenue, avg_invoice }], summary }
      if (result.data && result.data.length > 0) {
        // Take last 6 months
        const monthlyData = result.data.slice(-6);
        labels = monthlyData.map((m: { month: string }) => {
          const date = new Date(`${m.month}-01`);
          return date.toLocaleDateString('en-US', { month: 'short' });
        });
        data = monthlyData.map((m: { total_revenue?: number }) => m.total_revenue || 0);
      }
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load revenue chart data:', error);
  }

  // If no data, show placeholder months
  if (labels.length === 0) {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
      data.push(0);
    }
  }

  // Remove skeleton and show canvas
  if (chartContainer) {
    const skeleton = chartContainer.querySelector('.chart-skeleton-wrapper');
    if (skeleton) skeleton.remove();
    canvas.style.display = '';
  }

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: getChartColorWithAlpha('PRIMARY', 0.7),
        borderColor: getChartColor('PRIMARY'),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `$${(context.raw as number).toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: getChartColor('TEXT'),
            callback: (value) => `$${(value as number / 1000).toFixed(0)}k`
          },
          grid: { color: getChartColor('GRID') }
        },
        x: {
          ticks: { color: getChartColor('TEXT') },
          grid: { color: getChartColor('GRID') }
        }
      }
    }
  });

  charts.set('revenue', chart);
}

async function loadProjectStatusChart(): Promise<void> {
  const canvas = document.getElementById('project-status-chart') as HTMLCanvasElement;
  if (!canvas) return;

  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Project status distribution chart');

  // Show skeleton while loading
  const chartContainer = canvas.parentElement;
  if (chartContainer) {
    canvas.style.display = 'none';
    const skeleton = document.createElement('div');
    skeleton.className = 'chart-skeleton-wrapper';
    skeleton.innerHTML = getChartSkeletonHTML();
    chartContainer.appendChild(skeleton);
  }

  // Destroy existing chart
  if (charts.has('projectStatus')) {
    charts.get('projectStatus')?.destroy();
  }

  let labels: string[] = ['Active', 'Completed', 'On Hold', 'Pending'];
  let data: number[] = [0, 0, 0, 0];
  const colors = [
    getChartColor('PRIMARY'),
    getChartColor('SUCCESS'),
    getChartColor('WARNING'),
    getChartColor('QUATERNARY')
  ];

  try {
    const response = await apiFetch('/api/analytics/quick/projects');
    if (response.ok) {
      const result = await response.json();
      // Backend returns { data: [...], summary: { total_projects, active_projects, completed_projects, total_hours } }
      if (result.summary) {
        const summary = result.summary;
        const active = summary.active_projects || 0;
        const completed = summary.completed_projects || 0;
        const total = summary.total_projects || 0;
        // Calculate other statuses from data if available, or derive from total
        const other = Math.max(0, total - active - completed);
        labels = ['Active', 'Completed', 'Other'];
        data = [active, completed, other];
      }
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load project status chart data:', error);
  }

  // Remove skeleton and show canvas
  if (chartContainer) {
    const skeleton = chartContainer.querySelector('.chart-skeleton-wrapper');
    if (skeleton) skeleton.remove();
    canvas.style.display = '';
  }

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: getChartColor('TEXT') }
        }
      }
    }
  });

  charts.set('projectStatus', chart);
}

async function loadLeadFunnel(): Promise<void> {
  try {
    const response = await apiFetch('/api/analytics/quick/pipeline');
    if (!response.ok) return;

    const data = await response.json();
    const byStage = data.byStage || {};

    // Update funnel stages
    updateElement('funnel-new', String(byStage.new || byStage.pending || 0));
    updateElement('funnel-contacted', String(byStage.contacted || 0));
    updateElement('funnel-qualified', String(byStage.qualified || 0));
    updateElement('funnel-proposal', String(byStage.proposal_sent || byStage.proposal || 0));
    updateElement('funnel-won', String(byStage.won || byStage.converted || 0));

    // Update conversion stats
    const conversionRate = data.conversionRate || 0;
    updateElement('funnel-conversion-rate', `Conversion Rate: ${conversionRate.toFixed(1)}%`);

    const avgValue = data.avgDealValue || 0;
    updateElement('funnel-avg-value', `Avg Deal Value: ${formatCurrencyCompact(avgValue)}`);

  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load lead funnel:', error);
  }
}

async function loadSavedReports(): Promise<void> {
  const container = document.getElementById('saved-reports-list');
  if (!container) return;

  try {
    const response = await apiFetch('/api/analytics/reports');
    if (!response.ok) {
      container.innerHTML = '<div class="report-empty">Could not load reports</div>';
      return;
    }

    const data = await response.json();
    const reports = data.reports || [];

    if (reports.length === 0) {
      container.innerHTML = '<div class="report-empty">No saved reports yet. Create your first report to get started.</div>';
      return;
    }

    container.innerHTML = reports.slice(0, 5).map((report: {
      id: number;
      name: string;
      type: string;
      last_run_at?: string;
      is_favorite?: boolean;
    }) => `
      <div class="report-item" data-report-id="${report.id}">
        <div class="report-info">
          <span class="report-name">${report.is_favorite ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ' : ''}${escapeHtml(report.name)}</span>
          <span class="report-meta">${report.type} ${report.last_run_at ? `• Last run: ${formatDateTime(report.last_run_at)}` : ''}</span>
        </div>
        <div class="report-actions">
          <button class="btn btn-secondary btn-sm run-report-btn" data-report-id="${report.id}" title="Run Report">Run</button>
          <button class="btn btn-outline btn-sm schedule-report-btn" data-report-id="${report.id}" data-report-name="${escapeHtml(report.name)}" title="Schedule Report">Schedule</button>
          <button class="btn btn-danger btn-sm delete-report-btn" data-report-id="${report.id}" title="Delete Report">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners for run buttons
    container.querySelectorAll('.run-report-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reportId = (e.currentTarget as HTMLElement).dataset.reportId;
        if (reportId) {
          await runReport(parseInt(reportId, 10));
        }
      });
    });

    // Add event listeners for schedule buttons
    container.querySelectorAll('.schedule-report-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reportId = (e.currentTarget as HTMLElement).dataset.reportId;
        const reportName = (e.currentTarget as HTMLElement).dataset.reportName;
        if (reportId) {
          await showScheduleReportDialog(parseInt(reportId, 10), reportName || 'Report');
        }
      });
    });

    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-report-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reportId = (e.currentTarget as HTMLElement).dataset.reportId;
        if (reportId) {
          await deleteReport(parseInt(reportId, 10));
        }
      });
    });

  } catch (error) {
    console.error('[AdminAnalytics] Error loading saved reports:', error);
    container.innerHTML = '<div class="report-empty">Error loading reports</div>';
  }
}

async function showScheduleReportDialog(reportId: number, reportName: string): Promise<void> {
  const result = await multiPromptDialog({
    title: `Schedule: ${reportName}`,
    fields: [
      {
        name: 'frequency',
        label: 'Frequency',
        type: 'select',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' }
        ],
        required: true
      },
      {
        name: 'email',
        label: 'Delivery Email',
        type: 'text',
        placeholder: 'email@example.com'
      }
    ],
    confirmText: 'Create Schedule',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPost(`/api/analytics/reports/${reportId}/schedules`, {
      frequency: result.frequency,
      delivery_email: result.email || null
    });

    if (response.ok) {
      showToast('Report scheduled successfully', 'success');
      await loadScheduledReports();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to schedule report', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error scheduling report:', error);
    showToast('Failed to schedule report', 'error');
  }
}

async function deleteReport(reportId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Report',
    message: 'Are you sure you want to delete this report? This will also delete all associated schedules.',
    danger: true,
    confirmText: 'Delete'
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/analytics/reports/${reportId}`);

    if (response.ok) {
      showToast('Report deleted', 'success');
      await loadSavedReports();
      await loadScheduledReports();
    } else {
      showToast('Failed to delete report', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error deleting report:', error);
    showToast('Failed to delete report', 'error');
  }
}

async function runReport(reportId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/analytics/reports/${reportId}/run`, {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();
      await alertDialog({
        title: 'Report Complete',
        message: `Report executed successfully. ${result.rowCount || 0} rows returned.`,
        type: 'success'
      });
    } else {
      throw new Error('Failed to run report');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error running report:', error);
    showToast('Failed to run report', 'error');
  }
}

// =====================================================
// CREATE REPORT DIALOG
// =====================================================

async function showCreateReportDialog(): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Create New Report',
    fields: [
      {
        name: 'name',
        label: 'Report Name',
        type: 'text',
        placeholder: 'Monthly Revenue Report',
        required: true
      },
      {
        name: 'type',
        label: 'Report Type',
        type: 'select',
        options: [
          { value: 'revenue', label: 'Revenue Report' },
          { value: 'pipeline', label: 'Pipeline Report' },
          { value: 'projects', label: 'Projects Report' },
          { value: 'clients', label: 'Clients Report' },
          { value: 'invoices', label: 'Invoices Report' }
        ],
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        placeholder: 'Optional description'
      }
    ],
    confirmText: 'Create Report',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPost('/api/analytics/reports', {
      name: result.name,
      type: result.type,
      description: result.description || null,
      config: { filters: {}, columns: [] }
    });

    if (response.ok) {
      showToast('Report created successfully', 'success');
      await loadSavedReports();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to create report', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error creating report:', error);
    showToast('Failed to create report', 'error');
  }
}

// =====================================================
// SCHEDULED REPORTS
// =====================================================

async function loadScheduledReports(): Promise<void> {
  const container = document.getElementById('scheduled-reports-list');
  if (!container) return;

  try {
    // Get all reports first to find ones with schedules
    const response = await apiFetch('/api/analytics/reports');
    if (!response.ok) {
      container.innerHTML = '<div class="report-empty">Could not load scheduled reports</div>';
      return;
    }

    const data = await response.json();
    const reports = data.reports || [];

    // Now get schedules for each report (simplified - in production would have a dedicated endpoint)
    const scheduledReports: Array<{
      id: number;
      reportId: number;
      reportName: string;
      frequency: string;
      next_run_at?: string;
      is_active: boolean;
    }> = [];

    for (const report of reports.slice(0, 10)) {
      try {
        const schedRes = await apiFetch(`/api/analytics/reports/${report.id}/schedules`);
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          const schedules = schedData.schedules || [];
          for (const sched of schedules) {
            scheduledReports.push({
              id: sched.id,
              reportId: report.id,
              reportName: report.name,
              frequency: sched.frequency,
              next_run_at: sched.next_run_at,
              is_active: sched.is_active
            });
          }
        }
      } catch {
        // Skip failed schedule fetches
      }
    }

    if (scheduledReports.length === 0) {
      container.innerHTML = '<div class="report-empty">No scheduled reports. Click "Run" on a saved report to schedule it.</div>';
      return;
    }

    container.innerHTML = scheduledReports.map(sched => `
      <div class="report-item" data-schedule-id="${sched.id}">
        <div class="report-info">
          <span class="report-name">${escapeHtml(sched.reportName)}</span>
          <span class="report-meta">${sched.frequency} ${sched.next_run_at ? `• Next run: ${formatDateTime(sched.next_run_at)}` : ''}</span>
        </div>
        <div class="report-actions">
          <button class="icon-btn toggle-schedule-btn" data-schedule-id="${sched.id}" data-active="${sched.is_active}" title="${sched.is_active ? 'Pause' : 'Resume'}" aria-label="${sched.is_active ? 'Pause schedule' : 'Resume schedule'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${sched.is_active
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
}
            </svg>
          </button>
          <button class="icon-btn icon-btn-danger delete-schedule-btn" data-schedule-id="${sched.id}" title="Delete" aria-label="Delete schedule">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.toggle-schedule-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const schedId = (e.currentTarget as HTMLElement).dataset.scheduleId;
        const isActive = (e.currentTarget as HTMLElement).dataset.active === 'true';
        if (schedId) {
          await toggleSchedule(parseInt(schedId, 10), !isActive);
        }
      });
    });

    container.querySelectorAll('.delete-schedule-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const schedId = (e.currentTarget as HTMLElement).dataset.scheduleId;
        if (schedId) {
          await deleteSchedule(parseInt(schedId, 10));
        }
      });
    });

  } catch (error) {
    console.error('[AdminAnalytics] Error loading scheduled reports:', error);
    container.innerHTML = '<div class="report-empty">Error loading scheduled reports</div>';
  }
}

async function toggleSchedule(scheduleId: number, activate: boolean): Promise<void> {
  try {
    const response = await apiPut(`/api/analytics/schedules/${scheduleId}`, {
      is_active: activate
    });

    if (response.ok) {
      showToast(activate ? 'Schedule resumed' : 'Schedule paused', 'success');
      await loadScheduledReports();
    } else {
      showToast('Failed to update schedule', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error toggling schedule:', error);
    showToast('Failed to update schedule', 'error');
  }
}

async function deleteSchedule(scheduleId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Schedule',
    message: 'Are you sure you want to delete this schedule? This cannot be undone.',
    danger: true,
    confirmText: 'Delete'
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/analytics/schedules/${scheduleId}`);

    if (response.ok) {
      showToast('Schedule deleted', 'success');
      await loadScheduledReports();
    } else {
      showToast('Failed to delete schedule', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error deleting schedule:', error);
    showToast('Failed to delete schedule', 'error');
  }
}

// =====================================================
// METRIC ALERTS
// =====================================================

async function loadMetricAlerts(): Promise<void> {
  const container = document.getElementById('metric-alerts-list');
  if (!container) return;

  try {
    const response = await apiFetch('/api/analytics/alerts');
    if (!response.ok) {
      container.innerHTML = '<div class="report-empty">Could not load alerts</div>';
      return;
    }

    const data = await response.json();
    const alerts = data.alerts || [];

    if (alerts.length === 0) {
      container.innerHTML = '<div class="report-empty">No metric alerts configured. Create an alert to get notified when metrics cross thresholds.</div>';
      return;
    }

    container.innerHTML = alerts.map((alert: {
      id: number;
      name: string;
      metric: string;
      condition: string;
      threshold: number;
      is_active: boolean;
      last_triggered_at?: string;
    }) => `
      <div class="report-item alert-item" data-alert-id="${alert.id}">
        <div class="report-info">
          <span class="report-name">
            ${alert.is_active ? '' : '<span class="badge badge-muted">Paused</span> '}
            ${escapeHtml(alert.name)}
          </span>
          <span class="report-meta">
            ${formatMetricName(alert.metric)} ${alert.condition} ${formatThreshold(alert.metric, alert.threshold)}
            ${alert.last_triggered_at ? `• Last triggered: ${formatDateTime(alert.last_triggered_at)}` : ''}
          </span>
        </div>
        <div class="report-actions">
          <button class="icon-btn toggle-alert-btn" data-alert-id="${alert.id}" data-active="${alert.is_active}" title="${alert.is_active ? 'Pause' : 'Resume'}" aria-label="${alert.is_active ? 'Pause alert' : 'Resume alert'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${alert.is_active
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
}
            </svg>
          </button>
          <button class="icon-btn icon-btn-danger delete-alert-btn" data-alert-id="${alert.id}" title="Delete" aria-label="Delete alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.toggle-alert-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const alertId = (e.currentTarget as HTMLElement).dataset.alertId;
        const isActive = (e.currentTarget as HTMLElement).dataset.active === 'true';
        if (alertId) {
          await toggleAlert(parseInt(alertId, 10), !isActive);
        }
      });
    });

    container.querySelectorAll('.delete-alert-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const alertId = (e.currentTarget as HTMLElement).dataset.alertId;
        if (alertId) {
          await deleteAlert(parseInt(alertId, 10));
        }
      });
    });

  } catch (error) {
    console.error('[AdminAnalytics] Error loading metric alerts:', error);
    container.innerHTML = '<div class="report-empty">Error loading alerts</div>';
  }
}

function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    'revenue': 'Revenue',
    'pipeline_value': 'Pipeline Value',
    'active_projects': 'Active Projects',
    'outstanding_invoices': 'Outstanding Invoices',
    'conversion_rate': 'Conversion Rate',
    'avg_deal_value': 'Avg Deal Value'
  };
  return names[metric] || metric.replace(/_/g, ' ');
}

function formatThreshold(metric: string, value: number): string {
  if (metric.includes('rate')) {
    return `${value}%`;
  }
  if (metric.includes('revenue') || metric.includes('value') || metric.includes('invoices')) {
    return formatCurrencyCompact(value);
  }
  return String(value);
}

async function showCreateAlertDialog(): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Create Metric Alert',
    fields: [
      {
        name: 'name',
        label: 'Alert Name',
        type: 'text',
        placeholder: 'Revenue dropped alert',
        required: true
      },
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'revenue', label: 'Revenue' },
          { value: 'pipeline_value', label: 'Pipeline Value' },
          { value: 'active_projects', label: 'Active Projects' },
          { value: 'outstanding_invoices', label: 'Outstanding Invoices' },
          { value: 'conversion_rate', label: 'Conversion Rate' }
        ],
        required: true
      },
      {
        name: 'condition',
        label: 'Condition',
        type: 'select',
        options: [
          { value: 'above', label: 'Above' },
          { value: 'below', label: 'Below' },
          { value: 'equals', label: 'Equals' },
          { value: 'change', label: 'Changes by %' }
        ],
        required: true
      },
      {
        name: 'threshold',
        label: 'Threshold Value',
        type: 'text',
        placeholder: '10000',
        required: true
      }
    ],
    confirmText: 'Create Alert',
    cancelText: 'Cancel'
  });

  if (!result) return;

  const threshold = parseFloat(result.threshold);
  if (isNaN(threshold)) {
    showToast('Invalid threshold value', 'error');
    return;
  }

  try {
    const response = await apiPost('/api/analytics/alerts', {
      name: result.name,
      metric: result.metric,
      condition: result.condition,
      threshold
    });

    if (response.ok) {
      showToast('Alert created successfully', 'success');
      await loadMetricAlerts();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to create alert', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error creating alert:', error);
    showToast('Failed to create alert', 'error');
  }
}

async function toggleAlert(alertId: number, activate: boolean): Promise<void> {
  try {
    const response = await apiPut(`/api/analytics/alerts/${alertId}`, {
      is_active: activate
    });

    if (response.ok) {
      showToast(activate ? 'Alert activated' : 'Alert paused', 'success');
      await loadMetricAlerts();
    } else {
      showToast('Failed to update alert', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error toggling alert:', error);
    showToast('Failed to update alert', 'error');
  }
}

async function deleteAlert(alertId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Alert',
    message: 'Are you sure you want to delete this alert? This cannot be undone.',
    danger: true,
    confirmText: 'Delete'
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/analytics/alerts/${alertId}`);

    if (response.ok) {
      showToast('Alert deleted', 'success');
      await loadMetricAlerts();
    } else {
      showToast('Failed to delete alert', 'error');
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error deleting alert:', error);
    showToast('Failed to delete alert', 'error');
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadAnalyticsSummary(): Promise<void> {
  try {
    const response = await apiFetch('/api/analytics/summary?days=30');

    if (!response.ok) {
      // 401 handled by apiFetch, only show defaults for other errors
      if (response.status !== 401) {
        console.warn('[AdminAnalytics] Failed to load analytics summary');
        showOverviewDefaults();
      }
      return;
    }

    const data = await response.json();
    const summary = data.summary || {};

    // Update analytics tab: breakdown (portfolio vs THE BACKEND); same combined data until API supports per-site
    const visitors = formatNumber(summary.unique_visitors || 0);
    const pageviews = formatNumber(summary.total_page_views || 0);
    const sessions = formatDuration(summary.avg_session_duration || 0);
    updateElement('analytics-portfolio-visitors', visitors);
    updateElement('analytics-portfolio-pageviews', pageviews);
    updateElement('analytics-portfolio-sessions', sessions);
    updateElement('analytics-backend-visitors', visitors);
    updateElement('analytics-backend-pageviews', pageviews);
    updateElement('analytics-backend-sessions', sessions);

    // Update overview tab stats
    updateElement('total-visitors', formatNumber(summary.unique_visitors || 0));
    updateElement('page-views', formatNumber(summary.total_page_views || 0));
    updateElement('avg-session', formatDuration(summary.avg_session_duration || 0));

    // Update stat-visitors with today's visitors
    if (data.daily && data.daily.length > 0) {
      const todayVisitors = data.daily[0]?.visitors || 0;
      updateElement('stat-visitors', todayVisitors.toString());
    }

    // Calculate week-over-week changes if we have daily data
    if (data.daily && data.daily.length >= 7) {
      const thisWeek = data.daily.slice(0, 7);
      const lastWeek = data.daily.slice(7, 14);

      if (lastWeek.length > 0) {
        // Visitors change
        const thisWeekVisitors = thisWeek.reduce((sum: number, d: { visitors?: number }) => sum + (d.visitors || 0), 0);
        const lastWeekVisitors = lastWeek.reduce((sum: number, d: { visitors?: number }) => sum + (d.visitors || 0), 0);
        const visitorChange = calculatePercentChange(lastWeekVisitors, thisWeekVisitors);
        updateChangeElement('visitors-change', visitorChange);

        // Page views change
        const thisWeekViews = thisWeek.reduce((sum: number, d: { page_views?: number }) => sum + (d.page_views || 0), 0);
        const lastWeekViews = lastWeek.reduce((sum: number, d: { page_views?: number }) => sum + (d.page_views || 0), 0);
        const viewsChange = calculatePercentChange(lastWeekViews, thisWeekViews);
        updateChangeElement('views-change', viewsChange);

        // Session duration change
        const thisWeekSessions = thisWeek.reduce((sum: number, d: { avg_session?: number }) => sum + (d.avg_session || 0), 0) / thisWeek.length;
        const lastWeekSessions = lastWeek.reduce((sum: number, d: { avg_session?: number }) => sum + (d.avg_session || 0), 0) / lastWeek.length;
        const sessionChange = calculatePercentChange(lastWeekSessions, thisWeekSessions);
        updateChangeElement('session-change', sessionChange);
      }
    } else {
      // No comparison data available
      setChangeText('visitors-change', 'No prior data');
      setChangeText('views-change', 'No prior data');
      setChangeText('session-change', 'No prior data');
    }

  } catch (error) {
    console.error('[AdminAnalytics] Error loading analytics summary:', error);
    showOverviewDefaults();
  }
}

function showOverviewDefaults(): void {
  updateElement('total-visitors', '0');
  updateElement('page-views', '0');
  updateElement('avg-session', '0s');
  updateElement('stat-visitors', '0');
  setChangeText('visitors-change', 'No data');
  setChangeText('views-change', 'No data');
  setChangeText('session-change', 'No data');
  // Analytics tab breakdown (portfolio + THE BACKEND)
  ['portfolio', 'backend'].forEach((site) => {
    updateElement(`analytics-${site}-visitors`, '0');
    updateElement(`analytics-${site}-pageviews`, '0');
    updateElement(`analytics-${site}-sessions`, '-');
  });
}

function setChangeText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    el.className = 'metric-change neutral';
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function calculatePercentChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return Math.round(((newVal - oldVal) / oldVal) * 100);
}

function updateChangeElement(id: string, change: number): void {
  const el = document.getElementById(id);
  if (!el) return;

  const prefix = change >= 0 ? '+' : '';
  el.textContent = `${prefix}${change}%`;
  el.className = `metric-change ${change >= 0 ? 'positive' : 'negative'}`;
}

export async function loadPerformanceData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const perfData = await getPerformanceMetrics();

    // Core Web Vitals
    updateVital('lcp', perfData.lcp);
    updateVital('fid', perfData.fid);
    updateVital('cls', perfData.cls);

    // Performance score
    if (perfData.score !== undefined) {
      updateElement('performance-score', `${Math.round(perfData.score)}/100`);
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error loading performance data:', error);
  }

  // Load bundle stats from API
  try {
    const response = await apiFetch('/api/admin/bundle-stats');

    if (response.ok) {
      const bundleData = await response.json();
      updateElement('total-bundle-size', bundleData.totalFormatted);
      updateElement('js-bundle-size', bundleData.jsFormatted);
      updateElement('css-bundle-size', bundleData.cssFormatted);
    }
    // 401 handled by apiFetch
  } catch (error) {
    console.error('[AdminAnalytics] Error loading bundle stats:', error);
  }
}

export async function loadAnalyticsData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiFetch('/api/analytics/summary?days=30');

    if (!response.ok) {
      if (response.status !== 401) {
        console.warn('[AdminAnalytics] Failed to load analytics data');
        showEmptyStates();
      }
      return;
    }

    const data = await response.json();

    // Popular Pages
    if (data.topPages && data.topPages.length > 0) {
      populateDataList(
        'popular-pages',
        data.topPages.map((p: { url: string; views: number }) => ({
          label: formatPageUrl(p.url),
          value: `${p.views.toLocaleString()} views`
        }))
      );
    } else {
      populateDataList('popular-pages', [{ label: 'No data yet', value: '-' }]);
    }

    // Device Breakdown
    if (data.devices && data.devices.length > 0) {
      const total = data.devices.reduce((sum: number, d: { count: number }) => sum + d.count, 0);
      populateDataList(
        'device-breakdown',
        data.devices.map((d: { device_type: string; count: number }) => ({
          label: capitalizeFirst(d.device_type || 'Unknown'),
          value: `${Math.round((d.count / total) * 100)}%`
        }))
      );
    } else {
      populateDataList('device-breakdown', [{ label: 'No data yet', value: '-' }]);
    }

    // Geographic Distribution (from browsers/referrers as proxy - real geo needs IP lookup)
    if (data.browsers && data.browsers.length > 0) {
      const total = data.browsers.reduce((sum: number, b: { count: number }) => sum + b.count, 0);
      populateDataList(
        'geo-distribution',
        data.browsers.slice(0, 4).map((b: { browser: string; count: number }) => ({
          label: b.browser || 'Unknown',
          value: `${Math.round((b.count / total) * 100)}%`
        }))
      );
    } else {
      populateDataList('geo-distribution', [{ label: 'No data yet', value: '-' }]);
    }

    // Engagement Events
    if (data.topInteractions && data.topInteractions.length > 0) {
      populateDataList(
        'engagement-events',
        data.topInteractions.slice(0, 5).map((i: { event_type: string; element?: string; count: number }) => ({
          label: formatInteractionType(i.event_type, i.element),
          value: i.count.toLocaleString()
        }))
      );
    } else {
      // Show summary stats as engagement if no interactions
      const summary = data.summary || {};
      populateDataList('engagement-events', [
        { label: 'Total Sessions', value: (summary.total_sessions || 0).toLocaleString() },
        { label: 'Bounce Rate', value: `${summary.bounce_rate || 0}%` },
        { label: 'Pages per Session', value: (summary.avg_pages_per_session || 0).toFixed(1) }
      ]);
    }

  } catch (error) {
    console.error('[AdminAnalytics] Error loading analytics data:', error);
    showEmptyStates();
  }
}

function showEmptyStates(): void {
  const emptyData = [{ label: 'No data available', value: '-' }];
  populateDataList('popular-pages', emptyData);
  populateDataList('device-breakdown', emptyData);
  populateDataList('geo-distribution', emptyData);
  populateDataList('engagement-events', emptyData);
}

function formatPageUrl(url: string): string {
  if (!url || url === '/') return 'Homepage';
  // Remove leading slash and clean up
  return url.replace(/^\//, '').replace(/-/g, ' ').replace(/\//g, ' / ') || 'Homepage';
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatInteractionType(type: string, element?: string): string {
  const formatted = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (element && element.length < 20) {
    return `${formatted} (${element})`;
  }
  return formatted;
}

export async function loadVisitorsData(_ctx: AdminDashboardContext): Promise<void> {
  const container = document.getElementById('visitors-table-body');
  if (!container) return;

  // Show loading state
  showTableLoading(container, 6, 'Loading visitor data...');

  try {
    const response = await apiFetch('/api/analytics/sessions?days=7&limit=50');

    if (!response.ok) {
      if (response.status !== 401) {
        showTableError(
          container,
          6,
          `Failed to load visitor data (${response.status})`,
          () => loadVisitorsData(_ctx)
        );
      }
      return;
    }

    const data = await response.json();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      container.innerHTML =
        '<tr><td colspan="6" class="loading-row">No visitor sessions recorded</td></tr>';
      return;
    }

    container.innerHTML = sessions
      .map((session: {
        session_id: string;
        start_time: string;
        total_time_on_site: number;
        page_views: number;
        device_type: string;
        city?: string;
        country?: string;
        browser?: string;
      }) => {
        const startTime = formatDateTime(session.start_time);
        const duration = formatDuration(session.total_time_on_site || 0);
        const location = session.city && session.country
          ? `${session.city}, ${session.country}`
          : session.country || '';

        return `
          <tr>
            <td>${session.session_id.substring(0, 8)}...</td>
            <td>${startTime}</td>
            <td>${duration}</td>
            <td>${session.page_views || 0}</td>
            <td>${capitalizeFirst(session.device_type || 'desktop')}</td>
            <td>${location}</td>
          </tr>
        `;
      })
      .join('');

  } catch (error) {
    console.error('[AdminAnalytics] Error loading visitors data:', error);
    showTableError(
      container,
      6,
      'Network error loading visitor data',
      () => loadVisitorsData(_ctx)
    );
  }
}

async function getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
  // Try to get data from PerformanceService first
  try {
    const { container } = await import('../../../core/container');
    const performanceService = (await container.resolve('PerformanceService')) as {
      generateReport?: () => {
        metrics: { lcp?: number; fid?: number; cls?: number; ttfb?: number; bundleSize?: number };
        score?: number;
      };
    };

    if (performanceService?.generateReport) {
      const report = performanceService.generateReport();
      return {
        lcp: {
          value: report.metrics.lcp ? `${Math.round(report.metrics.lcp)}ms` : 'N/A',
          status: getVitalStatus('lcp', report.metrics.lcp)
        },
        fid: {
          value: report.metrics.fid ? `${Math.round(report.metrics.fid)}ms` : 'N/A',
          status: getVitalStatus('fid', report.metrics.fid)
        },
        cls: {
          value: report.metrics.cls ? report.metrics.cls.toFixed(3) : 'N/A',
          status: getVitalStatus('cls', report.metrics.cls)
        },
        ttfb: {
          value: report.metrics.ttfb ? `${Math.round(report.metrics.ttfb)}ms` : 'N/A',
          status: getVitalStatus('ttfb', report.metrics.ttfb)
        },
        bundleSize: {
          total: report.metrics.bundleSize
            ? `${Math.round(report.metrics.bundleSize / 1024)} KB`
            : 'N/A',
          main: 'N/A',
          vendor: 'N/A'
        },
        score: report.score || 0,
        grade: getGradeFromScore(report.score || 0)
      };
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Could not get performance service data:', error);
  }

  // Try browser Performance API as fallback
  try {
    type NavTiming = { responseStart?: number; requestStart?: number };
    type ResourceTiming = { name: string; transferSize?: number };
    type LCPEntry = { startTime: number };

    const navEntries = performance.getEntriesByType('navigation');
    const navigation = navEntries[0] as NavTiming | undefined;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');

    const ttfb = navigation?.responseStart && navigation?.requestStart
      ? Math.round(navigation.responseStart - navigation.requestStart)
      : undefined;
    const lcp = lcpEntries.length > 0
      ? Math.round((lcpEntries[lcpEntries.length - 1] as LCPEntry).startTime)
      : undefined;

    // Get resource sizes for bundle estimation
    const resources = performance.getEntriesByType('resource') as ResourceTiming[];
    const jsResources = resources.filter(r => r.name.endsWith('.js'));
    const cssResources = resources.filter(r => r.name.endsWith('.css'));

    const jsSize = jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const cssSize = cssResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const totalSize = jsSize + cssSize;

    return {
      lcp: {
        value: lcp ? `${lcp}ms` : 'N/A',
        status: getVitalStatus('lcp', lcp)
      },
      fid: {
        value: 'N/A', // FID requires user interaction
        status: 'unknown'
      },
      cls: {
        value: 'N/A', // CLS requires PerformanceObserver
        status: 'unknown'
      },
      ttfb: {
        value: ttfb ? `${ttfb}ms` : 'N/A',
        status: getVitalStatus('ttfb', ttfb)
      },
      bundleSize: {
        total: totalSize > 0 ? `${Math.round(totalSize / 1024)} KB` : 'N/A',
        main: jsSize > 0 ? `${Math.round(jsSize / 1024)} KB` : 'N/A',
        vendor: cssSize > 0 ? `${Math.round(cssSize / 1024)} KB` : 'N/A'
      },
      score: lcp && ttfb ? calculatePerformanceScore(lcp, ttfb) : 0,
      grade: lcp && ttfb ? getGradeFromScore(calculatePerformanceScore(lcp, ttfb)) : 'N/A'
    };
  } catch (error) {
    console.warn('[AdminAnalytics] Could not get browser performance data:', error);
  }

  // No data available
  return {
    lcp: { value: 'N/A', status: 'unknown' },
    fid: { value: 'N/A', status: 'unknown' },
    cls: { value: 'N/A', status: 'unknown' },
    ttfb: { value: 'N/A', status: 'unknown' },
    bundleSize: { total: 'N/A', main: 'N/A', vendor: 'N/A' },
    score: 0,
    grade: 'N/A'
  };
}

function calculatePerformanceScore(lcp: number, ttfb: number): number {
  // Simple scoring based on Core Web Vitals thresholds
  let score = 100;

  // LCP scoring (good < 2500ms, needs improvement < 4000ms)
  if (lcp > 4000) score -= 30;
  else if (lcp > 2500) score -= 15;

  // TTFB scoring (good < 800ms, needs improvement < 1800ms)
  if (ttfb > 1800) score -= 20;
  else if (ttfb > 800) score -= 10;

  return Math.max(0, score);
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  try {
    const { container } = await import('../../../core/container');
    const visitorService = (await container.resolve('VisitorTrackingService')) as {
      exportData?: () => Promise<RawVisitorData>;
    };

    if (visitorService?.exportData) {
      const data = await visitorService.exportData();
      return formatAnalyticsData(data);
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Could not get live analytics data:', error);
  }

  return {};
}

function formatAnalyticsData(rawData: RawVisitorData): AnalyticsData {
  const pageViews = rawData.pageViews || [];
  const sessions = rawData.sessions || [];
  const interactions = rawData.interactions || [];

  // Calculate popular pages
  const popularPages = calculatePopularPages(pageViews);

  // Calculate device breakdown from user agents
  const deviceBreakdown = calculateDeviceBreakdown(sessions);

  // Calculate geographic distribution from timezones
  const geoDistribution = calculateGeoDistribution(sessions);

  // Calculate engagement events
  const engagementEvents = calculateEngagementEvents(sessions, interactions);

  return {
    popularPages: popularPages.length > 0 ? popularPages : undefined,
    deviceBreakdown: deviceBreakdown.length > 0 ? deviceBreakdown : undefined,
    geoDistribution: geoDistribution.length > 0 ? geoDistribution : undefined,
    engagementEvents: engagementEvents.length > 0 ? engagementEvents : undefined
  };
}

function calculatePopularPages(pageViews: { url: string; timestamp: number }[]): AnalyticsDataItem[] {
  const pageCounts = new Map<string, number>();
  pageViews.forEach((pv) => {
    const url = pv.url || '/';
    pageCounts.set(url, (pageCounts.get(url) || 0) + 1);
  });

  return Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({
      label: formatPageLabel(url),
      value: `${count.toLocaleString()} views`
    }));
}

function formatPageLabel(url: string): string {
  if (url === '/' || url === '') return 'Homepage';
  // Remove leading slash and format
  const path = url.replace(/^\//, '').replace(/-/g, ' ');
  // Capitalize first letter of each word
  return path
    .split('/')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');
}

function calculateDeviceBreakdown(sessions: { userAgent?: string; screenResolution?: string }[]): AnalyticsDataItem[] {
  if (sessions.length === 0) return [];

  const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };

  sessions.forEach((session) => {
    const device = detectDeviceType(session.userAgent, session.screenResolution);
    deviceCounts[device]++;
  });

  const total = sessions.length;
  const breakdown: AnalyticsDataItem[] = [];

  if (deviceCounts.desktop > 0) {
    breakdown.push({
      label: 'Desktop',
      value: `${Math.round((deviceCounts.desktop / total) * 100)}%`
    });
  }
  if (deviceCounts.mobile > 0) {
    breakdown.push({
      label: 'Mobile',
      value: `${Math.round((deviceCounts.mobile / total) * 100)}%`
    });
  }
  if (deviceCounts.tablet > 0) {
    breakdown.push({
      label: 'Tablet',
      value: `${Math.round((deviceCounts.tablet / total) * 100)}%`
    });
  }

  return breakdown.sort((a, b) => {
    const aVal = parseInt(String(a.value).replace('%', ''), 10);
    const bVal = parseInt(String(b.value).replace('%', ''), 10);
    return bVal - aVal;
  });
}

function detectDeviceType(
  userAgent?: string,
  screenResolution?: string
): 'desktop' | 'mobile' | 'tablet' {
  if (!userAgent) {
    // Fallback to screen resolution if no user agent
    if (screenResolution) {
      const width = parseInt(screenResolution.split('x')[0], 10);
      if (width <= 480) return 'mobile';
      if (width <= 1024) return 'tablet';
    }
    return 'desktop';
  }

  const ua = userAgent.toLowerCase();

  // Check for tablets first (they often contain 'mobile' in UA too)
  if (/ipad|tablet|playbook|silk/i.test(ua) ||
      (/android/i.test(ua) && !/mobile/i.test(ua))) {
    return 'tablet';
  }

  // Check for mobile devices
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function calculateGeoDistribution(sessions: { timezone?: string; language?: string }[]): AnalyticsDataItem[] {
  if (sessions.length === 0) return [];

  const regionCounts = new Map<string, number>();

  sessions.forEach((session) => {
    const region = inferRegionFromTimezone(session.timezone) ||
                   inferRegionFromLanguage(session.language) ||
                   'Unknown';
    regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
  });

  const total = sessions.length;

  return Array.from(regionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([region, count]) => ({
      label: region,
      value: `${Math.round((count / total) * 100)}%`
    }));
}

function inferRegionFromTimezone(timezone?: string): string | null {
  if (!timezone) return null;

  const tz = timezone.toLowerCase();

  // Americas
  if (tz.includes('america/new_york') || tz.includes('america/chicago') ||
      tz.includes('america/denver') || tz.includes('america/los_angeles') ||
      tz.includes('america/phoenix') || tz.includes('est') || tz.includes('pst') ||
      tz.includes('cst') || tz.includes('mst')) {
    return 'United States';
  }
  if (tz.includes('america/toronto') || tz.includes('america/vancouver') ||
      tz.includes('america/montreal')) {
    return 'Canada';
  }
  if (tz.includes('america/mexico')) {
    return 'Mexico';
  }
  if (tz.includes('america/sao_paulo') || tz.includes('america/buenos_aires')) {
    return 'South America';
  }

  // Europe
  if (tz.includes('europe/london') || tz.includes('gmt') || tz.includes('bst')) {
    return 'United Kingdom';
  }
  if (tz.includes('europe/')) {
    return 'Europe';
  }

  // Asia Pacific
  if (tz.includes('asia/tokyo') || tz.includes('asia/seoul')) {
    return 'Asia Pacific';
  }
  if (tz.includes('australia/')) {
    return 'Australia';
  }
  if (tz.includes('asia/')) {
    return 'Asia';
  }

  return null;
}

function inferRegionFromLanguage(language?: string): string | null {
  if (!language) return null;

  const lang = language.toLowerCase().split('-')[0];

  switch (lang) {
  case 'en':
    return 'English Speaking';
  case 'es':
    return 'Spanish Speaking';
  case 'fr':
    return 'French Speaking';
  case 'de':
    return 'German Speaking';
  case 'pt':
    return 'Portuguese Speaking';
  case 'zh':
    return 'China';
  case 'ja':
    return 'Japan';
  case 'ko':
    return 'South Korea';
  default:
    return null;
  }
}

function calculateEngagementEvents(
  sessions: { bounced?: boolean; totalTimeOnSite?: number; pageViews?: number }[],
  interactions: { type: string; timestamp: number }[]
): AnalyticsDataItem[] {
  const events: AnalyticsDataItem[] = [];

  if (sessions.length === 0 && interactions.length === 0) {
    return events;
  }

  // Total sessions
  if (sessions.length > 0) {
    events.push({
      label: 'Total Sessions',
      value: sessions.length.toLocaleString()
    });

    // Bounce rate
    const bouncedSessions = sessions.filter(s => s.bounced === true).length;
    if (bouncedSessions > 0 || sessions.some(s => s.bounced !== undefined)) {
      const bounceRate = Math.round((bouncedSessions / sessions.length) * 100);
      events.push({
        label: 'Bounce Rate',
        value: `${bounceRate}%`
      });
    }

    // Average session duration
    const sessionsWithDuration = sessions.filter(s => typeof s.totalTimeOnSite === 'number');
    if (sessionsWithDuration.length > 0) {
      const totalTime = sessionsWithDuration.reduce((sum, s) => sum + (s.totalTimeOnSite || 0), 0);
      const avgDuration = totalTime / sessionsWithDuration.length;
      events.push({
        label: 'Avg. Session Duration',
        value: formatDuration(avgDuration)
      });
    }

    // Average pages per session
    const sessionsWithPageViews = sessions.filter(s => typeof s.pageViews === 'number');
    if (sessionsWithPageViews.length > 0) {
      const totalPages = sessionsWithPageViews.reduce((sum, s) => sum + (s.pageViews || 0), 0);
      const avgPages = totalPages / sessionsWithPageViews.length;
      events.push({
        label: 'Pages per Session',
        value: avgPages.toFixed(1)
      });
    }
  }

  // Group interactions by type
  if (interactions.length > 0) {
    const interactionCounts = new Map<string, number>();
    interactions.forEach((interaction) => {
      const type = interaction.type || 'unknown';
      interactionCounts.set(type, (interactionCounts.get(type) || 0) + 1);
    });

    // Add top interaction types (limited to keep list manageable)
    const topInteractions = Array.from(interactionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topInteractions.forEach(([type, count]) => {
      events.push({
        label: formatInteractionLabel(type),
        value: count.toLocaleString()
      });
    });
  }

  return events;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

function formatInteractionLabel(type: string): string {
  // Convert snake_case or kebab-case to Title Case
  return type
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getVitalStatus(metric: string, value?: number): string {
  if (!value) return 'unknown';

  switch (metric) {
  case 'lcp':
    return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
  case 'fid':
    return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
  case 'cls':
    return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
  default:
    return 'unknown';
  }
}

function getGradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function updateVital(
  metric: string,
  data: { value: string; status: string }
): void {
  const valueEl = document.getElementById(`${metric}-value`);
  const statusEl = document.getElementById(`${metric}-status`);

  if (valueEl) valueEl.textContent = data.value;
  if (statusEl) {
    statusEl.textContent = data.status;
    statusEl.className = `vital-status status-${data.status}`;
  }
}

function updateElement(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function populateDataList(containerId: string, items: AnalyticsDataItem[]): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isEmptyState =
    items.length === 1 && items[0].label === 'No data available' && items[0].value === '-';

  if (isEmptyState) {
    container.innerHTML = '<div class="data-list-empty" aria-live="polite">No data available</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
      <div class="data-item">
        <span class="data-label">${item.label}</span>
        <span class="data-value">${item.value}</span>
      </div>
    `
    )
    .join('');
}

async function loadVisitorsChart(): Promise<void> {
  const canvas = document.getElementById('visitors-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Add accessibility attributes to canvas
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Visitors chart showing daily visitor counts for the past week');

  // Show chart skeleton while loading
  const chartContainer = canvas.parentElement;
  if (chartContainer) {
    canvas.style.display = 'none';
    const skeleton = document.createElement('div');
    skeleton.className = 'chart-skeleton-wrapper';
    skeleton.innerHTML = getChartSkeletonHTML();
    chartContainer.appendChild(skeleton);
  }

  // Destroy existing chart
  if (charts.has('visitors')) {
    charts.get('visitors')?.destroy();
  }

  // Try to fetch real data from API
  let labels: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let data: number[] = [0, 0, 0, 0, 0, 0, 0];

  try {
    const response = await apiFetch('/api/analytics/summary?days=7');

    if (response.ok) {
      const result = await response.json();
      if (result.daily && result.daily.length > 0) {
        // Reverse to get chronological order and take last 7 days
        const dailyData = result.daily.slice(0, 7).reverse();
        labels = dailyData.map((d: { date: string }) => {
          const date = new Date(d.date);
          return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        data = dailyData.map((d: { visitors?: number }) => d.visitors || 0);
      }
    }
    // 401 handled by apiFetch
  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load chart data:', error);
  }

  // Remove skeleton and show canvas
  if (chartContainer) {
    const skeleton = chartContainer.querySelector('.chart-skeleton-wrapper');
    if (skeleton) skeleton.remove();
    canvas.style.display = '';
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Visitors',
          data,
          borderColor: getChartColor('PRIMARY'),
          backgroundColor: getChartColorWithAlpha('PRIMARY', 0.1),
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: getChartColor('TEXT') },
          grid: { color: getChartColor('GRID') }
        },
        x: {
          ticks: { color: getChartColor('TEXT') },
          grid: { color: getChartColor('GRID') }
        }
      }
    }
  });

  charts.set('visitors', chart);
}

async function loadSourcesChart(): Promise<void> {
  const canvas = document.getElementById('sources-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Add accessibility attributes to canvas
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Traffic sources breakdown by category');

  // Show chart skeleton while loading
  const chartContainer = canvas.parentElement;
  if (chartContainer) {
    canvas.style.display = 'none';
    const skeleton = document.createElement('div');
    skeleton.className = 'chart-skeleton-wrapper';
    skeleton.innerHTML = getChartSkeletonHTML();
    chartContainer.appendChild(skeleton);
  }

  if (charts.has('sources')) {
    charts.get('sources')?.destroy();
  }

  // Try to fetch real data from API
  let labels: string[] = ['Direct', 'Search', 'Social', 'Referral'];
  let data: number[] = [0, 0, 0, 0];

  try {
    const response = await apiFetch('/api/analytics/summary?days=30');

    if (response.ok) {
      const result = await response.json();
      if (result.topReferrers && result.topReferrers.length > 0) {
        // Map referrers to categories
        const sources: Record<string, number> = {
          'Direct': 0,
          'Search': 0,
          'Social': 0,
          'Referral': 0
        };

        result.topReferrers.forEach((r: { source: string; count: number }) => {
          const source = r.source.toLowerCase();
          if (source === 'direct' || source === '') {
            sources['Direct'] += r.count;
          } else if (source.includes('google') || source.includes('bing') || source.includes('yahoo') || source.includes('duckduckgo')) {
            sources['Search'] += r.count;
          } else if (source.includes('facebook') || source.includes('twitter') || source.includes('linkedin') || source.includes('instagram') || source.includes('tiktok')) {
            sources['Social'] += r.count;
          } else {
            sources['Referral'] += r.count;
          }
        });

        labels = Object.keys(sources);
        data = Object.values(sources);
      }
    }
    // 401 handled by apiFetch
  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load sources chart data:', error);
  }

  // Remove skeleton and show canvas
  if (chartContainer) {
    const skeleton = chartContainer.querySelector('.chart-skeleton-wrapper');
    if (skeleton) skeleton.remove();
    canvas.style.display = '';
  }

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            getChartColor('PRIMARY'),
            getChartColor('SUCCESS'),
            getChartColor('WARNING'),
            getChartColor('DANGER')
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: getChartColor('TEXT') }
        }
      }
    }
  });

  charts.set('sources', chart);
}

export function destroyCharts(): void {
  charts.forEach((chart) => chart.destroy());
  charts.clear();
}

// Data export functions
export async function exportAnalyticsData(): Promise<Record<string, unknown>> {
  const data = await getAnalyticsData();
  return {
    exportedAt: new Date().toISOString(),
    analytics: data
  };
}

export async function exportPerformanceData(): Promise<Record<string, unknown>> {
  const data = await getPerformanceMetrics();
  return {
    exportedAt: new Date().toISOString(),
    performance: data
  };
}

// ---------------------------------------------------------------------------
// Render icons for dynamic rendering
// ---------------------------------------------------------------------------

const RENDER_ICONS = {
  DOLLAR: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
  ACTIVITY: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
  FOLDER: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  FILE_TEXT: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  CHEVRON_RIGHT: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  INFO: '<svg class="info-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>'
};

// ---------------------------------------------------------------------------
// Dynamic Tab Render
// ---------------------------------------------------------------------------

/**
 * Render the analytics tab structure dynamically
 */
export function renderAnalyticsTab(container: HTMLElement): void {
  container.innerHTML = `
    <!-- Overview Sub-Tab -->
    <div class="analytics-subtab-content active" id="analytics-subtab-overview">
      <h3 class="tab-section-heading">Overview</h3>
      <!-- Business KPI Cards -->
      <div class="card-grid-4" id="business-kpi-section">
        <div class="stat-card" id="kpi-revenue">
          <div class="kpi-card-icon">${RENDER_ICONS.DOLLAR}</div>
          <span class="stat-number" id="kpi-revenue-value">$0</span>
          <span class="stat-label">Revenue MTD</span>
          <div class="kpi-card-change" id="kpi-revenue-change">
            <span class="change-value">-</span>
            <span class="kpi-card-change-label">vs last month</span>
          </div>
        </div>
        <div class="stat-card" id="kpi-pipeline">
          <div class="kpi-card-icon">${RENDER_ICONS.ACTIVITY}</div>
          <span class="stat-number" id="kpi-pipeline-value">$0</span>
          <span class="stat-label">Pipeline Value</span>
          <div class="kpi-card-change" id="kpi-pipeline-count">
            <span class="change-value">-</span>
            <span class="kpi-card-change-label">active leads</span>
          </div>
        </div>
        <div class="stat-card" id="kpi-projects">
          <div class="kpi-card-icon">${RENDER_ICONS.FOLDER}</div>
          <span class="stat-number" id="kpi-projects-value">0</span>
          <span class="stat-label">Active Projects</span>
          <div class="kpi-card-change" id="kpi-projects-completion">
            <span class="change-value">-</span>
            <span class="kpi-card-change-label">avg completion</span>
          </div>
        </div>
        <div class="stat-card" id="kpi-invoices">
          <div class="kpi-card-icon">${RENDER_ICONS.FILE_TEXT}</div>
          <span class="stat-number" id="kpi-invoices-value">$0</span>
          <span class="stat-label">Outstanding Invoices</span>
          <div class="kpi-card-change" id="kpi-invoices-count">
            <span class="change-value">-</span>
            <span class="kpi-card-change-label">invoices pending</span>
          </div>
        </div>
      </div>

      <!-- Lead Funnel -->
      <div class="portal-project-card portal-shadow" id="lead-funnel-section">
        <h3>Lead Conversion Funnel</h3>
        <div class="funnel-container" id="lead-funnel">
          <div class="funnel-stage" data-stage="new">
            <span class="funnel-stage-value" id="funnel-new">0</span>
            <span class="funnel-stage-label">New Leads</span>
          </div>
          <div class="funnel-arrow">${RENDER_ICONS.CHEVRON_RIGHT}</div>
          <div class="funnel-stage" data-stage="contacted">
            <span class="funnel-stage-value" id="funnel-contacted">0</span>
            <span class="funnel-stage-label">Contacted</span>
          </div>
          <div class="funnel-arrow">${RENDER_ICONS.CHEVRON_RIGHT}</div>
          <div class="funnel-stage" data-stage="qualified">
            <span class="funnel-stage-value" id="funnel-qualified">0</span>
            <span class="funnel-stage-label">Qualified</span>
          </div>
          <div class="funnel-arrow">${RENDER_ICONS.CHEVRON_RIGHT}</div>
          <div class="funnel-stage" data-stage="proposal">
            <span class="funnel-stage-value" id="funnel-proposal">0</span>
            <span class="funnel-stage-label">Proposal</span>
          </div>
          <div class="funnel-arrow">${RENDER_ICONS.CHEVRON_RIGHT}</div>
          <div class="funnel-stage funnel-stage-success" data-stage="won">
            <span class="funnel-stage-value" id="funnel-won">0</span>
            <span class="funnel-stage-label">Won</span>
          </div>
        </div>
        <div class="funnel-stats" id="funnel-stats">
          <span class="funnel-stat" id="funnel-conversion-rate">Conversion Rate: -</span>
          <span class="funnel-stat" id="funnel-avg-value">Avg Deal Value: -</span>
        </div>
      </div>
    </div><!-- End Overview Sub-Tab -->

    <!-- Business Sub-Tab -->
    <div class="analytics-subtab-content" id="analytics-subtab-business">
      <h3 class="tab-section-heading">Business</h3>
      <div class="analytics-card-grid">
        <div class="portal-project-card portal-shadow">
          <h3>Revenue by Month</h3>
          <div class="chart-canvas-wrapper" id="revenue-chart-container">
            <canvas id="revenue-chart"></canvas>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>Project Status</h3>
          <div class="chart-canvas-wrapper" id="project-status-chart-container">
            <canvas id="project-status-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Ad Hoc Revenue Widget -->
      <div class="portal-project-card portal-shadow">
        <h3>Ad Hoc Revenue Analytics</h3>
        <div id="ad-hoc-analytics-widget" class="loading-text">Loading ad hoc analytics...</div>
      </div>

      <!-- Lead Analytics & Scoring -->
      <div class="portal-project-card portal-shadow leads-analytics-section" id="leads-analytics-section">
        <h3>Lead Analytics</h3>
        <div class="analytics-columns-2col">
          <div class="analytics-column" id="conversion-funnel-card">
            <span class="field-label">Conversion Funnel</span>
            <div class="funnel-container" id="leads-conversion-funnel">
              <div class="loading-text">Loading funnel data...</div>
            </div>
          </div>
          <div class="analytics-column" id="source-performance-card">
            <span class="field-label">Lead Sources</span>
            <div class="source-list" id="leads-source-performance">
              <div class="loading-text">Loading source data...</div>
            </div>
          </div>
        </div>
        <div class="analytics-column analytics-column-full" id="scoring-rules-card">
          <div class="analytics-column-header">
            <span class="field-label">Scoring Rules</span>
            <button type="button" class="icon-btn" id="add-scoring-rule-btn" title="Add rule" aria-label="Add scoring rule">
              <span class="icon-btn-svg">${RENDER_ICONS.PLUS}</span>
            </button>
          </div>
          <div class="scoring-rules-list" id="scoring-rules-list">
            <div class="loading-text">Loading scoring rules...</div>
          </div>
        </div>
      </div>
    </div><!-- End Business Sub-Tab -->

    <!-- Visitors Sub-Tab -->
    <div class="analytics-subtab-content" id="analytics-subtab-visitors">
      <h3 class="tab-section-heading">Visitors</h3>
      <!-- Site Breakdown -->
      <div class="analytics-card-grid">
        <div class="portal-project-card portal-shadow">
          <h3>Main Portfolio Site</h3>
          <div class="quick-stats analytics-breakdown-stats">
            <div class="stat-card">
              <span class="stat-number" id="analytics-portfolio-visitors">-</span>
              <span class="stat-label">Total Visitors</span>
            </div>
            <div class="stat-card">
              <span class="stat-number" id="analytics-portfolio-pageviews">-</span>
              <span class="stat-label">Page Views</span>
            </div>
            <div class="stat-card">
              <span class="stat-number" id="analytics-portfolio-sessions">-</span>
              <span class="stat-label">Avg. Session</span>
            </div>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>The Backend (Client Portal)</h3>
          <div class="quick-stats analytics-breakdown-stats">
            <div class="stat-card">
              <span class="stat-number" id="analytics-backend-visitors">-</span>
              <span class="stat-label">Total Visitors</span>
            </div>
            <div class="stat-card">
              <span class="stat-number" id="analytics-backend-pageviews">-</span>
              <span class="stat-label">Page Views</span>
            </div>
            <div class="stat-card">
              <span class="stat-number" id="analytics-backend-sessions">-</span>
              <span class="stat-label">Avg. Session</span>
            </div>
          </div>
        </div>
      </div>
      <!-- Legacy IDs for dashboard visitor-stats -->
      <div class="sr-only" aria-hidden="true">
        <span id="analytics-visitors">-</span>
        <span id="analytics-pageviews">-</span>
        <span id="analytics-sessions">-</span>
      </div>

      <!-- Visitor Charts -->
      <div class="analytics-card-grid">
        <div class="portal-project-card portal-shadow">
          <h3>Visitors Over Time</h3>
          <div class="chart-canvas-wrapper">
            <canvas id="visitors-chart"></canvas>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>Traffic Sources</h3>
          <div class="chart-canvas-wrapper">
            <canvas id="sources-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Analytics Data Grid -->
      <div class="analytics-card-grid">
        <div class="portal-project-card portal-shadow">
          <h3>Popular Pages</h3>
          <div class="data-list" id="popular-pages">
            <div class="data-item"><span class="data-label">Loading...</span></div>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>Device Breakdown</h3>
          <div class="data-list" id="device-breakdown">
            <div class="data-item"><span class="data-label">Loading...</span></div>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>Geographic Distribution</h3>
          <div class="data-list" id="geo-distribution">
            <div class="data-item"><span class="data-label">Loading...</span></div>
          </div>
        </div>
        <div class="portal-project-card portal-shadow">
          <h3>Engagement Events</h3>
          <div class="data-list" id="engagement-events">
            <div class="data-item"><span class="data-label">Loading...</span></div>
          </div>
        </div>
      </div>

      <!-- Visitors Table -->
      <div class="visitors-dashboard">
        <div class="admin-table-card portal-shadow">
          <div class="admin-table-header">
            <h3>Recent Sessions</h3>
          </div>
          <div class="admin-table-container">
            <div class="admin-table-scroll-wrapper">
              <table class="admin-table visitors-table">
                <thead>
                  <tr>
                    <th scope="col">Session ID</th>
                    <th scope="col">Started</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Pages</th>
                    <th scope="col">Device</th>
                    <th scope="col">Location</th>
                  </tr>
                </thead>
                <tbody id="visitors-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
                  <tr>
                    <td colspan="6" class="loading-row">Loading visitor data...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div><!-- End Visitors Sub-Tab -->

    <!-- Reports & Alerts Sub-Tab -->
    <div class="analytics-subtab-content" id="analytics-subtab-reports">
      <h3 class="tab-section-heading">Reports & Alerts</h3>
      <!-- Saved Reports Section -->
      <div class="portal-project-card portal-shadow" id="saved-reports-section">
        <div class="section-header-with-actions">
          <h3>Saved Reports</h3>
          <button type="button" class="icon-btn" id="create-report-btn" title="New report" aria-label="Create new report">
            <span class="icon-btn-svg">${RENDER_ICONS.PLUS}</span>
          </button>
        </div>
        <div class="reports-list" id="saved-reports-list">
          <div class="loading-text">Loading reports...</div>
        </div>
      </div>

      <!-- Scheduled Reports Section -->
      <div class="portal-project-card portal-shadow" id="scheduled-reports-section">
        <div class="section-header-with-actions">
          <h3>Scheduled Reports</h3>
        </div>
        <div class="reports-list" id="scheduled-reports-list">
          <div class="loading-text">Loading scheduled reports...</div>
        </div>
      </div>

      <!-- Metric Alerts Section -->
      <div class="portal-project-card portal-shadow" id="metric-alerts-section">
        <div class="section-header-with-actions">
          <h3>Metric Alerts</h3>
          <button type="button" class="icon-btn" id="create-alert-btn" title="New alert" aria-label="Create new metric alert">
            <span class="icon-btn-svg">${RENDER_ICONS.PLUS}</span>
          </button>
        </div>
        <div class="alerts-list" id="metric-alerts-list">
          <div class="loading-text">Loading alerts...</div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="portal-project-card portal-shadow">
        <h3>Core Web Vitals</h3>
        <div class="vitals-grid">
          <div class="vital-card">
            <h4>LCP <span class="info-icon-wrapper" data-tooltip="Largest Contentful Paint - Time until the largest visible element loads.&#10;&#10;Good: <2.5s&#10;Needs Improvement: 2.5-4s&#10;Poor: >4s">${RENDER_ICONS.INFO}</span></h4>
            <div class="vital-value" id="lcp-value">-</div>
            <span class="vital-status" id="lcp-status">-</span>
          </div>
          <div class="vital-card">
            <h4>FID <span class="info-icon-wrapper" data-tooltip="First Input Delay - Time from first interaction to browser response.&#10;&#10;Good: <100ms&#10;Needs Improvement: 100-300ms&#10;Poor: >300ms">${RENDER_ICONS.INFO}</span></h4>
            <div class="vital-value" id="fid-value">-</div>
            <span class="vital-status" id="fid-status">-</span>
          </div>
          <div class="vital-card">
            <h4>CLS <span class="info-icon-wrapper" data-tooltip="Cumulative Layout Shift - Visual stability score measuring unexpected layout shifts.&#10;&#10;Good: <0.1&#10;Needs Improvement: 0.1-0.25&#10;Poor: >0.25">${RENDER_ICONS.INFO}</span></h4>
            <div class="vital-value" id="cls-value">-</div>
            <span class="vital-status" id="cls-status">-</span>
          </div>
          <div class="vital-card">
            <h4>TTFB <span class="info-icon-wrapper" data-tooltip="Time to First Byte - Server response time.&#10;&#10;Good: <800ms&#10;Needs Improvement: 800-1800ms&#10;Poor: >1800ms">${RENDER_ICONS.INFO}</span></h4>
            <div class="vital-value" id="ttfb-value">-</div>
            <span class="vital-status" id="ttfb-status">-</span>
          </div>
        </div>
      </div>

      <!-- Bundle Analysis -->
      <div class="portal-project-card portal-shadow">
        <h3>Bundle Analysis</h3>
        <div class="bundle-info">
          <div class="bundle-item">
            <span>Total Bundle Size</span>
            <span id="total-bundle-size">-</span>
          </div>
          <div class="bundle-item">
            <span>Main JS</span>
            <span id="js-bundle-size">-</span>
          </div>
          <div class="bundle-item">
            <span>Vendor JS</span>
            <span id="css-bundle-size">-</span>
          </div>
          <div class="bundle-item">
            <span>Performance Score</span>
            <span id="performance-score">-</span>
          </div>
        </div>
      </div>
    </div><!-- End Reports & Alerts Sub-Tab -->
  `;

  // Reset initialization flag since DOM was rebuilt
  analyticsListenersInitialized = false;

  // Destroy existing charts since they reference old canvas elements
  destroyCharts();
}
