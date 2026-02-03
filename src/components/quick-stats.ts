/**
 * ===============================================
 * QUICK STATS (REUSABLE)
 * ===============================================
 * @file src/components/quick-stats.ts
 *
 * Renders the .quick-stats grid of stat cards. Use in admin and client
 * portal so markup and behavior are shared (shared CSS: portal-cards.css).
 */

export interface QuickStatItem {
  number: string;
  label: string;
  /** If set, card is clickable and navigates to this tab */
  dataTab?: string;
  /** If set, used as data-filter for table filtering */
  dataFilter?: string;
  /** If set, used as data-table for table context */
  dataTable?: string;
}

/**
 * Create the .quick-stats grid DOM. Mount into a tab or content area.
 */
export function createQuickStats(items: QuickStatItem[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'quick-stats';
  wrap.setAttribute('aria-live', 'polite');

  items.forEach((item) => {
    const isButton = Boolean(item.dataTab || item.dataFilter);
    const el = isButton ? document.createElement('button') : document.createElement('div');
    el.className = 'stat-card stat-card-clickable portal-shadow';
    if (isButton) {
      (el as HTMLButtonElement).type = 'button';
      if (item.dataTab) el.setAttribute('data-tab', item.dataTab);
      if (item.dataFilter) el.setAttribute('data-filter', item.dataFilter);
      if (item.dataTable) el.setAttribute('data-table', item.dataTable);
    }
    const num = document.createElement('span');
    num.className = 'stat-number';
    num.textContent = item.number;
    const label = document.createElement('span');
    label.className = 'stat-label';
    label.textContent = item.label;
    el.appendChild(num);
    el.appendChild(label);
    wrap.appendChild(el);
  });

  return wrap;
}
