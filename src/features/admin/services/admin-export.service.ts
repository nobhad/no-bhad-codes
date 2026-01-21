/**
 * ===============================================
 * ADMIN EXPORT SERVICE
 * ===============================================
 * @file src/features/admin/services/admin-export.service.ts
 *
 * Data export functionality for admin dashboard.
 * Handles analytics, visitors, and performance exports.
 */

import { createLogger } from '../../../utils/logging';
import type { PerformanceMetrics, PerformanceAlert } from '../../../services/performance-service';

const logger = createLogger('AdminExportService');

// ============================================
// Types
// ============================================

export type ExportType = 'analytics' | 'visitors' | 'performance' | 'leads' | 'contacts' | 'projects';

interface PerformanceMetricDisplay {
  value: string;
  status: string;
}

interface PerformanceMetricsDisplay {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts?: string[];
}

interface PerformanceReport {
  score: number;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

interface ExportData {
  exportDate: string;
  [key: string]: unknown;
}

// ============================================
// Admin Export Service
// ============================================

class AdminExportService {
  /**
   * Export data of specified type
   */
  async exportData(type: ExportType): Promise<void> {
    try {
      let data: ExportData;
      let filename: string;

      switch (type) {
      case 'analytics':
        data = await this.getAnalyticsExport();
        filename = `analytics-${this.getDateString()}.json`;
        break;
      case 'visitors':
        data = await this.getVisitorsExport();
        filename = `visitors-${this.getDateString()}.json`;
        break;
      case 'performance':
        data = await this.getPerformanceExport();
        filename = `performance-${this.getDateString()}.json`;
        break;
      case 'leads':
        data = await this.getLeadsExport();
        filename = `leads-${this.getDateString()}.json`;
        break;
      case 'contacts':
        data = await this.getContactsExport();
        filename = `contacts-${this.getDateString()}.json`;
        break;
      case 'projects':
        data = await this.getProjectsExport();
        filename = `projects-${this.getDateString()}.json`;
        break;
      default:
        logger.error('Unknown export type', { type });
        throw new Error(`Export type '${type}' is not supported`);
      }

      this.downloadJson(data, filename);
      logger.info('Export completed', { type, filename });
    } catch (error) {
      logger.error('Export failed', { type, error });
      throw error;
    }
  }

  /**
   * Export data as CSV
   */
  async exportCsv(type: ExportType, data: Record<string, unknown>[]): Promise<void> {
    if (!data.length) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Handle strings with commas or quotes
          if (typeof value === 'string') {
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
          }
          return String(value ?? '');
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const filename = `${type}-${this.getDateString()}.csv`;

    this.downloadFile(csvContent, filename, 'text/csv');
    logger.info('CSV export completed', { type, filename, rows: data.length });
  }

  /**
   * Get analytics data for export
   */
  private async getAnalyticsExport(): Promise<ExportData> {
    try {
      const eventsJson = sessionStorage.getItem('nbw_tracking_events');
      const events = eventsJson ? JSON.parse(eventsJson) : [];

      const pageViews = events.filter((e: Record<string, unknown>) => 'title' in e);
      const interactions = events.filter((e: Record<string, unknown>) => 'type' in e && e.type !== 'page_view');

      return {
        exportDate: new Date().toISOString(),
        summary: {
          totalEvents: events.length,
          pageViews: pageViews.length,
          interactions: interactions.length
        },
        pageViews: pageViews,
        interactions: interactions,
        rawEvents: events
      };
    } catch (error) {
      logger.error('Failed to get analytics export data', { error });
      return {
        exportDate: new Date().toISOString(),
        error: 'Failed to retrieve analytics data'
      };
    }
  }

  /**
   * Get visitors data for export
   */
  private async getVisitorsExport(): Promise<ExportData> {
    try {
      const eventsJson = sessionStorage.getItem('nbw_tracking_events');
      const events = eventsJson ? JSON.parse(eventsJson) : [];

      // Group by session ID
      const sessionMap = new Map<string, Record<string, unknown>[]>();
      events.forEach((event: Record<string, unknown>) => {
        const sessionId = event.sessionId as string;
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, []);
        }
        sessionMap.get(sessionId)?.push(event);
      });

      const visitors = Array.from(sessionMap.entries()).map(([sessionId, sessionEvents]) => {
        const firstEvent = sessionEvents[0];
        const lastEvent = sessionEvents[sessionEvents.length - 1];

        return {
          sessionId,
          eventCount: sessionEvents.length,
          firstSeen: firstEvent.timestamp,
          lastSeen: lastEvent.timestamp,
          pagesVisited: sessionEvents.filter((e: Record<string, unknown>) => 'title' in e).length,
          userAgent: firstEvent.userAgent || 'Unknown'
        };
      });

      return {
        exportDate: new Date().toISOString(),
        summary: {
          totalVisitors: visitors.length,
          totalSessions: sessionMap.size
        },
        visitors: visitors
      };
    } catch (error) {
      logger.error('Failed to get visitors export data', { error });
      return {
        exportDate: new Date().toISOString(),
        error: 'Failed to retrieve visitors data'
      };
    }
  }

  /**
   * Get performance data for export
   */
  private async getPerformanceExport(): Promise<ExportData> {
    try {
      const metrics = await this.getPerformanceMetrics();

      return {
        exportDate: new Date().toISOString(),
        metrics: metrics,
        webVitals: {
          lcp: metrics.lcp,
          fid: metrics.fid,
          cls: metrics.cls,
          ttfb: metrics.ttfb
        },
        score: metrics.score,
        grade: metrics.grade
      };
    } catch (error) {
      logger.error('Failed to get performance export data', { error });
      return {
        exportDate: new Date().toISOString(),
        error: 'Failed to retrieve performance data'
      };
    }
  }

  /**
   * Get leads data for export (placeholder - would fetch from API)
   */
  private async getLeadsExport(): Promise<ExportData> {
    return {
      exportDate: new Date().toISOString(),
      leads: []
    };
  }

  /**
   * Get contacts data for export (placeholder - would fetch from API)
   */
  private async getContactsExport(): Promise<ExportData> {
    return {
      exportDate: new Date().toISOString(),
      contacts: []
    };
  }

  /**
   * Get projects data for export (placeholder - would fetch from API)
   */
  private async getProjectsExport(): Promise<ExportData> {
    return {
      exportDate: new Date().toISOString(),
      projects: []
    };
  }

  /**
   * Get performance metrics (tries various sources)
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
    try {
      // Try to get data from the main app's services via parent window
      if (window.opener?.NBW_DEBUG?.getPerformanceReport) {
        return (await window.opener.NBW_DEBUG.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
      }

      // Try current window
      if (window.NBW_DEBUG?.getPerformanceReport) {
        return (await window.NBW_DEBUG.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
      }

      // Try to access services directly from container
      const { container } = await import('../../../core/container');
      const performanceService = (await container.resolve('PerformanceService')) as {
        generateReport?: () => PerformanceReport;
      };

      if (performanceService?.generateReport) {
        const report = performanceService.generateReport();
        return this.formatPerformanceReport(report);
      }
    } catch (error) {
      logger.warn('Could not get live performance data', { error });
    }

    // Fallback
    return this.getDefaultMetrics();
  }

  /**
   * Format a performance report into display format
   */
  private formatPerformanceReport(report: PerformanceReport): PerformanceMetricsDisplay {
    return {
      lcp: {
        value: report.metrics.lcp ? `${Math.round(report.metrics.lcp)}ms` : 'N/A',
        status: this.getVitalStatus('lcp', report.metrics.lcp)
      },
      fid: {
        value: report.metrics.fid ? `${Math.round(report.metrics.fid)}ms` : 'N/A',
        status: this.getVitalStatus('fid', report.metrics.fid)
      },
      cls: {
        value: report.metrics.cls ? report.metrics.cls.toFixed(3) : 'N/A',
        status: this.getVitalStatus('cls', report.metrics.cls)
      },
      ttfb: {
        value: report.metrics.ttfb ? `${Math.round(report.metrics.ttfb)}ms` : 'N/A',
        status: this.getVitalStatus('ttfb', report.metrics.ttfb)
      },
      bundleSize: {
        total: report.metrics.bundleSize
          ? `${Math.round(report.metrics.bundleSize / 1024)} KB`
          : 'N/A',
        main: 'N/A',
        vendor: 'N/A'
      },
      score: report.score || 0,
      grade: this.getGradeFromScore(report.score || 0),
      alerts: (report.alerts || []).map((alert) => alert.message)
    };
  }

  /**
   * Get default metrics when data is unavailable
   */
  private getDefaultMetrics(): PerformanceMetricsDisplay {
    return {
      lcp: { value: 'N/A', status: 'unknown' },
      fid: { value: 'N/A', status: 'unknown' },
      cls: { value: 'N/A', status: 'unknown' },
      ttfb: { value: 'N/A', status: 'unknown' },
      bundleSize: {
        total: 'N/A',
        main: 'N/A',
        vendor: 'N/A'
      },
      score: 0,
      grade: 'N/A',
      alerts: ['Unable to load performance data']
    };
  }

  /**
   * Get Core Web Vital status
   */
  private getVitalStatus(metric: string, value?: number): string {
    if (!value) return 'unknown';

    switch (metric) {
    case 'lcp':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'fid':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    case 'cls':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'ttfb':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    default:
      return 'unknown';
    }
  }

  /**
   * Get grade from score
   */
  private getGradeFromScore(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get current date string for filenames
   */
  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Download JSON data as file
   */
  private downloadJson(data: ExportData, filename: string): void {
    const content = JSON.stringify(data, null, 2);
    this.downloadFile(content, filename, 'application/json');
  }

  /**
   * Download content as file
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
export const adminExportService = new AdminExportService();
export default adminExportService;
