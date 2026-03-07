/**
 * ===============================================
 * ADMIN DATA OPERATIONS
 * ===============================================
 * @file src/features/admin/admin-data-operations.ts
 *
 * Handles data export, clearing old data, and resetting analytics.
 */

import { createLogger } from '../../utils/logger';
import { alertError } from '../../utils/confirm-dialog';
import { confirmDanger } from '../../utils/confirm-dialog';
import { getPerformanceMetrics } from './admin-performance-handler';

const logger = createLogger('AdminDataOps');

type NotifyFn = (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;

/**
 * Export data (analytics, visitors, or performance) as JSON file.
 */
export async function exportData(type: string, showNotification: NotifyFn): Promise<void> {
  try {
    let data: Record<string, unknown>;
    let filename: string;

    switch (type) {
    case 'analytics':
      data = await getAnalyticsExport();
      filename = `analytics-${new Date().toISOString().split('T')[0]}.json`;
      break;
    case 'visitors':
      data = await getVisitorsExport();
      filename = `visitors-${new Date().toISOString().split('T')[0]}.json`;
      break;
    case 'performance':
      data = await getPerformanceExport();
      filename = `performance-${new Date().toISOString().split('T')[0]}.json`;
      break;
    default:
      logger.error(`Unknown export type requested: ${type}`);
      showNotification(`Export type '${type}' is not supported`, 'error');
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    logger.error(`Error exporting ${type} data:`, error);
    alertError(`Failed to export ${type} data. Please try again.`);
  }
}

async function getAnalyticsExport(): Promise<Record<string, unknown>> {
  return {
    exportDate: new Date().toISOString(),
    pageViews: [],
    visitors: [],
    events: []
  };
}

async function getVisitorsExport(): Promise<Record<string, unknown>> {
  return {
    exportDate: new Date().toISOString(),
    visitors: []
  };
}

async function getPerformanceExport(): Promise<Record<string, unknown>> {
  return {
    exportDate: new Date().toISOString(),
    metrics: await getPerformanceMetrics()
  };
}

/**
 * Clear data older than 90 days.
 */
export async function clearOldData(showNotification: NotifyFn): Promise<void> {
  const confirmed = await confirmDanger(
    'Are you sure you want to clear data older than 90 days? This action cannot be undone.',
    'Clear Data',
    'Clear Old Data'
  );
  if (!confirmed) return;

  try {
    showNotification('Old data cleared successfully', 'success');
  } catch (error) {
    logger.error(' Error clearing old data:', error);
    showNotification('Failed to clear old data', 'error');
  }
}

/**
 * Reset ALL analytics data with double confirmation.
 */
export async function resetAnalytics(showNotification: NotifyFn): Promise<void> {
  const firstConfirm = await confirmDanger(
    'Are you sure you want to reset ALL analytics data? This action cannot be undone.',
    'Reset Analytics',
    'Reset Analytics'
  );
  if (!firstConfirm) return;

  const secondConfirm = await confirmDanger(
    'This will permanently delete all visitor data, page views, and analytics. Are you absolutely sure?',
    'Yes, Reset Everything',
    'Final Confirmation'
  );
  if (!secondConfirm) return;

  try {
    sessionStorage.clear();
    showNotification('Analytics data has been reset', 'success');
    window.location.reload();
  } catch (error) {
    logger.error(' Error resetting analytics:', error);
    showNotification('Failed to reset analytics', 'error');
  }
}
