/**
 * ===============================================
 * SIMPLE CHART COMPONENT
 * ===============================================
 * @file src/components/chart-simple.ts
 *
 * Lightweight chart components without external dependencies.
 * Used for: Analytics dashboard, quick stats
 */

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export interface LineChartData {
  label: string;
  value: number;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)  }M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)  }K`;
  return num.toString();
}

/**
 * Create a simple horizontal bar chart
 */
export function createBarChart(
  containerId: string,
  data: BarChartData[],
  options: {
    maxValue?: number;
    showValues?: boolean;
    barHeight?: number;
    defaultColor?: string;
  } = {}
): { refresh: (data: BarChartData[]) => void; destroy: () => void } {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[BarChart] Container not found:', containerId);
    return { refresh: () => {}, destroy: () => {} };
  }

  const opts = {
    maxValue: options.maxValue || Math.max(...data.map(d => d.value)) || 100,
    showValues: options.showValues !== false,
    barHeight: options.barHeight || 24,
    defaultColor: options.defaultColor || 'var(--app-color-primary)'
  };

  function render(chartData: BarChartData[]): void {
    if (!container) return;
    const maxVal = Math.max(...chartData.map(d => d.value), opts.maxValue);

    container.innerHTML = chartData.map(item => {
      const percentage = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
      return `
        <div class="bar-chart-item">
          <div class="bar-chart-label">${escapeHtml(item.label)}</div>
          <div class="bar-chart-bar-wrapper">
            <div
              class="bar-chart-bar"
              style="width: ${percentage}%; height: ${opts.barHeight}px; background-color: ${item.color || opts.defaultColor}"
            ></div>
            ${opts.showValues ? `<span class="bar-chart-value">${formatNumber(item.value)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  render(data);

  return {
    refresh: (newData: BarChartData[]) => render(newData),
    destroy: () => { if (container) container.innerHTML = ''; }
  };
}

/**
 * Create a simple donut/pie chart using SVG
 */
export function createPieChart(
  containerId: string,
  data: PieChartData[],
  options: {
    size?: number;
    strokeWidth?: number;
    showLegend?: boolean;
    showLabels?: boolean;
  } = {}
): { refresh: (data: PieChartData[]) => void; destroy: () => void } {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[PieChart] Container not found:', containerId);
    return { refresh: () => {}, destroy: () => {} };
  }

  const opts = {
    size: options.size || 160,
    strokeWidth: options.strokeWidth || 30,
    showLegend: options.showLegend !== false,
    showLabels: options.showLabels || false
  };

  function render(chartData: PieChartData[]): void {
    if (!container) return;
    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      container.innerHTML = '<div class="pie-chart-empty">No data</div>';
      return;
    }

    const radius = (opts.size - opts.strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    const segments = chartData.map(item => {
      const percentage = item.value / total;
      const strokeDasharray = `${percentage * circumference} ${circumference}`;
      const strokeDashoffset = -currentOffset * circumference;
      currentOffset += percentage;

      return `
        <circle
          cx="${opts.size / 2}"
          cy="${opts.size / 2}"
          r="${radius}"
          fill="none"
          stroke="${item.color}"
          stroke-width="${opts.strokeWidth}"
          stroke-dasharray="${strokeDasharray}"
          stroke-dashoffset="${strokeDashoffset}"
          transform="rotate(-90 ${opts.size / 2} ${opts.size / 2})"
        />
      `;
    }).join('');

    let html = `
      <div class="pie-chart-wrapper">
        <svg width="${opts.size}" height="${opts.size}" class="pie-chart-svg">
          ${segments}
        </svg>
    `;

    if (opts.showLegend) {
      html += `
        <div class="pie-chart-legend">
          ${chartData.map(item => {
    const percentage = ((item.value / total) * 100).toFixed(1);
    return `
              <div class="pie-chart-legend-item">
                <span class="pie-chart-legend-color" style="background-color: ${item.color}"></span>
                <span class="pie-chart-legend-label">${escapeHtml(item.label)}</span>
                <span class="pie-chart-legend-value">${percentage}%</span>
              </div>
            `;
  }).join('')}
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  render(data);

  return {
    refresh: (newData: PieChartData[]) => render(newData),
    destroy: () => { if (container) container.innerHTML = ''; }
  };
}

/**
 * Create a simple sparkline
 */
export function createSparkline(
  containerId: string,
  data: number[],
  options: {
    width?: number;
    height?: number;
    color?: string;
    fillOpacity?: number;
  } = {}
): { refresh: (data: number[]) => void; destroy: () => void } {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[Sparkline] Container not found:', containerId);
    return { refresh: () => {}, destroy: () => {} };
  }

  const opts = {
    width: options.width || 100,
    height: options.height || 30,
    color: options.color || 'var(--app-color-primary)',
    fillOpacity: options.fillOpacity || 0.2
  };

  function render(chartData: number[]): void {
    if (!container) return;
    if (chartData.length === 0) {
      container.innerHTML = '';
      return;
    }

    const minVal = Math.min(...chartData);
    const maxVal = Math.max(...chartData);
    const range = maxVal - minVal || 1;
    const padding = 2;

    const points = chartData.map((value, i) => {
      const x = (i / (chartData.length - 1)) * (opts.width - padding * 2) + padding;
      const y = opts.height - padding - ((value - minVal) / range) * (opts.height - padding * 2);
      return `${x},${y}`;
    }).join(' ');

    // Create fill path
    const firstX = padding;
    const lastX = (chartData.length - 1) / (chartData.length - 1) * (opts.width - padding * 2) + padding;
    const fillPath = `M${firstX},${opts.height} L${points} L${lastX},${opts.height} Z`;

    container.innerHTML = `
      <svg width="${opts.width}" height="${opts.height}" class="sparkline-svg">
        <path
          d="${fillPath}"
          fill="${opts.color}"
          fill-opacity="${opts.fillOpacity}"
        />
        <polyline
          points="${points}"
          fill="none"
          stroke="${opts.color}"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  render(data);

  return {
    refresh: (newData: number[]) => render(newData),
    destroy: () => { if (container) container.innerHTML = ''; }
  };
}

/**
 * Create a KPI card with value and change indicator
 */
export function createKPICard(
  containerId: string,
  config: {
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon?: string;
    color?: string;
  }
): { update: (value: string | number, change?: number) => void; destroy: () => void } {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[KPICard] Container not found:', containerId);
    return { update: () => {}, destroy: () => {} };
  }

  function render(value: string | number, change?: number): void {
    if (!container) return;
    const changeClass = change !== undefined ? (change >= 0 ? 'positive' : 'negative') : '';
    const changeIcon = change !== undefined ? (change >= 0 ? '↑' : '↓') : '';
    const changeValue = change !== undefined ? `${Math.abs(change).toFixed(1)  }%` : '';

    container.innerHTML = `
      <div class="kpi-card" ${config.color ? `style="border-top-color: ${config.color}"` : ''}>
        ${config.icon ? `<div class="kpi-card-icon">${config.icon}</div>` : ''}
        <div class="kpi-card-content">
          <span class="kpi-card-value">${typeof value === 'number' ? formatNumber(value) : value}</span>
          <span class="kpi-card-label">${escapeHtml(config.label)}</span>
        </div>
        ${change !== undefined ? `
          <div class="kpi-card-change ${changeClass}">
            <span class="kpi-card-change-icon">${changeIcon}</span>
            <span class="kpi-card-change-value">${changeValue}</span>
            ${config.changeLabel ? `<span class="kpi-card-change-label">${escapeHtml(config.changeLabel)}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  render(config.value, config.change);

  return {
    update: (value: string | number, change?: number) => render(value, change),
    destroy: () => { if (container) container.innerHTML = ''; }
  };
}

/**
 * Get CSS for all chart components
 */
export function getChartStyles(): string {
  return `
    /* Bar Chart */
    .bar-chart-item {
      margin-bottom: var(--portal-spacing-sm);
    }

    .bar-chart-label {
      font-size: 0.75rem;
      color: var(--portal-text-secondary);
      margin-bottom: 4px;
    }

    .bar-chart-bar-wrapper {
      display: flex;
      align-items: center;
      gap: var(--portal-spacing-sm);
    }

    .bar-chart-bar {
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .bar-chart-value {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--portal-text-primary);
      min-width: 40px;
    }

    /* Pie Chart */
    .pie-chart-wrapper {
      display: flex;
      align-items: center;
      gap: var(--portal-spacing-lg);
    }

    .pie-chart-svg {
      flex-shrink: 0;
    }

    .pie-chart-legend {
      display: flex;
      flex-direction: column;
      gap: var(--portal-spacing-xs);
    }

    .pie-chart-legend-item {
      display: flex;
      align-items: center;
      gap: var(--portal-spacing-sm);
    }

    .pie-chart-legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .pie-chart-legend-label {
      font-size: 0.75rem;
      color: var(--portal-text-secondary);
      flex: 1;
    }

    .pie-chart-legend-value {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--portal-text-primary);
    }

    .pie-chart-empty {
      text-align: center;
      color: var(--portal-text-secondary);
      padding: var(--portal-spacing-lg);
    }

    /* Sparkline */
    .sparkline-svg {
      display: block;
    }

    /* KPI Card */
    .kpi-card {
      display: flex;
      align-items: center;
      gap: var(--portal-spacing-md);
      padding: var(--portal-spacing-md);
      background: var(--portal-bg-dark);
      border-radius: var(--portal-radius-md);
      border-top: 3px solid var(--app-color-primary);
    }

    .kpi-card-icon {
      font-size: 1.5rem;
      color: var(--portal-text-secondary);
    }

    .kpi-card-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .kpi-card-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--portal-text-primary);
      line-height: 1.2;
    }

    .kpi-card-label {
      font-size: 0.75rem;
      color: var(--portal-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-card-change {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .kpi-card-change.positive {
      color: var(--status-active);
    }

    .kpi-card-change.negative {
      color: var(--status-cancelled);
    }

    .kpi-card-change-label {
      color: var(--portal-text-secondary);
      font-weight: 400;
    }

    @media (max-width: 768px) {
      .pie-chart-wrapper {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;
}
