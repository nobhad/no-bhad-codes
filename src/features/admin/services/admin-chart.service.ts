/**
 * ===============================================
 * ADMIN CHART SERVICE
 * ===============================================
 * @file src/features/admin/services/admin-chart.service.ts
 *
 * Chart.js integration for admin dashboard.
 * Handles chart creation, updates, and destruction.
 */

import { getChartColor, getChartColorWithAlpha } from '../../../config/constants';
import { createLogger } from '../../../utils/logging';

const logger = createLogger('AdminChartService');

// ============================================
// Types
// ============================================

type ChartType = 'line' | 'bar' | 'doughnut' | 'pie';

interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  borderWidth?: number;
  tension?: number;
  fill?: boolean;
}

interface ChartConfig {
  type: ChartType;
  labels: string[];
  datasets: ChartDataset[];
  options?: Record<string, unknown>;
}

// Dynamic Chart.js loader
let ChartJS: typeof import('chart.js').Chart | null = null;

async function loadChartJS(): Promise<typeof import('chart.js').Chart> {
  if (!ChartJS) {
    const chartModule = await import('chart.js');
    chartModule.Chart.register(...chartModule.registerables);
    ChartJS = chartModule.Chart;
  }
  return ChartJS;
}

// ============================================
// Admin Chart Service
// ============================================

class AdminChartService {
  private charts: Map<string, { destroy: () => void }> = new Map();

  /**
   * Create or update a chart
   */
  async createChart(containerId: string, config: ChartConfig): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      logger.warn('Chart container not found', { containerId });
      return;
    }

    // Load Chart.js dynamically
    const Chart = await loadChartJS();

    // Destroy existing chart
    this.destroyChart(containerId);

    // Create canvas
    container.innerHTML = '<canvas></canvas>';
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create chart
    const chart = new Chart(ctx, {
      type: config.type,
      data: {
        labels: config.labels,
        datasets: config.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...config.options
      }
    });

    this.charts.set(containerId, chart);
    logger.debug('Chart created', { containerId, type: config.type });
  }

  /**
   * Create visitors line chart
   */
  async createVisitorsChart(containerId: string, data?: {
    labels: string[];
    visitors: number[];
    pageViews: number[];
  }): Promise<void> {
    const chartData = data || {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      visitors: [120, 190, 150, 220, 180, 250, 210],
      pageViews: [300, 450, 380, 520, 420, 600, 480]
    };

    await this.createChart(containerId, {
      type: 'line',
      labels: chartData.labels,
      datasets: [
        {
          label: 'Visitors',
          data: chartData.visitors,
          borderColor: getChartColor('PRIMARY'),
          backgroundColor: getChartColorWithAlpha('PRIMARY', 0.1),
          tension: 0.4,
          fill: true
        },
        {
          label: 'Page Views',
          data: chartData.pageViews,
          borderColor: getChartColor('DARK'),
          backgroundColor: getChartColorWithAlpha('DARK', 0.1),
          tension: 0.4,
          fill: true
        }
      ],
      options: {
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: getChartColorWithAlpha('DARK', 0.1)
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  /**
   * Create traffic sources doughnut chart
   */
  async createSourcesChart(containerId: string, data?: {
    labels: string[];
    values: number[];
  }): Promise<void> {
    const chartData = data || {
      labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
      values: [35, 30, 20, 10, 5]
    };

    await this.createChart(containerId, {
      type: 'doughnut',
      labels: chartData.labels,
      datasets: [
        {
          label: 'Traffic Sources',
          data: chartData.values,
          backgroundColor: [
            getChartColor('PRIMARY'),
            getChartColor('DARK'),
            getChartColor('GRAY_600'),
            getChartColor('GRAY_400'),
            getChartColor('GRAY_300')
          ],
          borderColor: getChartColor('WHITE'),
          borderWidth: 2
        }
      ],
      options: {
        plugins: {
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          }
        }
      }
    });
  }

  /**
   * Create leads status bar chart
   */
  async createLeadsChart(containerId: string, data: {
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
  }): Promise<void> {
    await this.createChart(containerId, {
      type: 'bar',
      labels: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
      datasets: [
        {
          label: 'Leads by Status',
          data: [data.new, data.contacted, data.qualified, data.converted, data.lost],
          backgroundColor: [
            getChartColor('PRIMARY'),
            getChartColorWithAlpha('PRIMARY', 0.8),
            getChartColorWithAlpha('PRIMARY', 0.6),
            getChartColor('SUCCESS'),
            getChartColor('DANGER')
          ],
          borderWidth: 0
        }
      ],
      options: {
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  /**
   * Create project status pie chart
   */
  async createProjectsChart(containerId: string, data: {
    planning: number;
    in_progress: number;
    review: number;
    completed: number;
    on_hold: number;
  }): Promise<void> {
    await this.createChart(containerId, {
      type: 'pie',
      labels: ['Planning', 'In Progress', 'Review', 'Completed', 'On Hold'],
      datasets: [
        {
          label: 'Projects by Status',
          data: [data.planning, data.in_progress, data.review, data.completed, data.on_hold],
          backgroundColor: [
            getChartColor('GRAY_400'),
            getChartColor('PRIMARY'),
            getChartColorWithAlpha('PRIMARY', 0.7),
            getChartColor('SUCCESS'),
            getChartColor('WARNING')
          ],
          borderColor: getChartColor('WHITE'),
          borderWidth: 2
        }
      ],
      options: {
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          }
        }
      }
    });
  }

  /**
   * Update chart data
   */
  async updateChartData(containerId: string, labels: string[], datasets: ChartDataset[]): Promise<void> {
    const chart = this.charts.get(containerId) as { data: { labels: string[]; datasets: ChartDataset[] }; update: () => void } | undefined;
    if (!chart) {
      logger.warn('Chart not found for update', { containerId });
      return;
    }

    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update();
    logger.debug('Chart updated', { containerId });
  }

  /**
   * Destroy a specific chart
   */
  destroyChart(containerId: string): void {
    const chart = this.charts.get(containerId);
    if (chart) {
      chart.destroy();
      this.charts.delete(containerId);
      logger.debug('Chart destroyed', { containerId });
    }
  }

  /**
   * Destroy all charts
   */
  destroyAllCharts(): void {
    this.charts.forEach((chart, id) => {
      chart.destroy();
      logger.debug('Chart destroyed', { containerId: id });
    });
    this.charts.clear();
  }

  /**
   * Check if chart exists
   */
  hasChart(containerId: string): boolean {
    return this.charts.has(containerId);
  }

  /**
   * Get chart instance
   */
  getChart(containerId: string): { destroy: () => void } | undefined {
    return this.charts.get(containerId);
  }
}

// Singleton instance
export const adminChartService = new AdminChartService();
export default adminChartService;
