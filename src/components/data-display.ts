/**
 * ===============================================
 * DATA DISPLAY COMPONENTS (REUSABLE)
 * ===============================================
 * @file src/components/data-display.ts
 *
 * Reusable components for displaying data: cards, stats,
 * info rows, progress bars, etc.
 */

import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface CardConfig {
  /** Card variant */
  variant?: 'basic' | 'stats' | 'details' | 'action';
  /** Card header content */
  header?: string | HTMLElement;
  /** Card body content */
  body: string | HTMLElement;
  /** Card footer content */
  footer?: string | HTMLElement;
  /** Expandable card */
  expandable?: boolean;
  /** Initially expanded */
  expanded?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for action cards */
  onClick?: () => void;
}

export interface StatCardConfig {
  /** Label/title */
  label: string;
  /** Main value */
  value: string | number;
  /** Optional change percentage */
  change?: number;
  /** Change is positive */
  changePositive?: boolean;
  /** Trend icon (up/down/neutral) */
  trend?: 'up' | 'down' | 'neutral';
  /** Icon SVG */
  icon?: string;
  /** Additional class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

export interface InfoRowConfig {
  /** Label text */
  label: string;
  /** Value content */
  value: string | HTMLElement;
  /** Show copy button */
  copyable?: boolean;
  /** Value is a link */
  isLink?: boolean;
  /** Link href (if isLink) */
  href?: string;
  /** Additional class names */
  className?: string;
}

export interface ProgressBarConfig {
  /** Current value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label format (default: '{value}%') */
  labelFormat?: string;
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  /** Indeterminate mode */
  indeterminate?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Animated fill */
  animated?: boolean;
}

export interface AlertConfig {
  /** Alert message */
  message: string;
  /** Alert variant */
  variant?: 'info' | 'success' | 'warning' | 'danger';
  /** Optional title */
  title?: string;
  /** Dismissible */
  dismissible?: boolean;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Icon SVG (auto-selected by variant if not provided) */
  icon?: string;
  /** Additional class names */
  className?: string;
}

export interface SpinnerConfig {
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional message */
  message?: string;
  /** Center in container */
  centered?: boolean;
  /** Additional class names */
  className?: string;
}

export interface SkeletonConfig {
  /** Skeleton type */
  type?: 'text' | 'row' | 'card' | 'avatar' | 'image';
  /** Number of lines (for text type) */
  lines?: number;
  /** Width (CSS value) */
  width?: string;
  /** Height (CSS value) */
  height?: string;
  /** Additional class names */
  className?: string;
  /** Animated shimmer */
  animated?: boolean;
}

// ===============================================
// CARD COMPONENT
// ===============================================

/**
 * Create a card container.
 */
export function createCard(config: CardConfig): HTMLElement {
  const {
    variant = 'basic',
    header,
    body,
    footer,
    expandable = false,
    expanded = true,
    className = '',
    onClick
  } = config;

  const card = document.createElement('div');
  card.className = cx(
    'card',
    `card-${variant}`,
    expandable && 'card-expandable',
    !expanded && 'card-collapsed',
    onClick && 'card-clickable',
    className
  );

  if (onClick) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', onClick);
  }

  // Header
  if (header) {
    const headerEl = document.createElement('div');
    headerEl.className = 'card-header';

    if (typeof header === 'string') {
      headerEl.innerHTML = `<h3 class="card-title">${header}</h3>`;
    } else {
      headerEl.appendChild(header);
    }

    if (expandable) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'card-toggle';
      toggleBtn.setAttribute('aria-expanded', String(expanded));
      toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card.classList.toggle('card-collapsed');
        const isExpanded = !card.classList.contains('card-collapsed');
        toggleBtn.setAttribute('aria-expanded', String(isExpanded));
      });

      headerEl.appendChild(toggleBtn);
    }

    card.appendChild(headerEl);
  }

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.className = 'card-body';

  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else {
    bodyEl.appendChild(body);
  }

  card.appendChild(bodyEl);

  // Footer
  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'card-footer';

    if (typeof footer === 'string') {
      footerEl.innerHTML = footer;
    } else {
      footerEl.appendChild(footer);
    }

    card.appendChild(footerEl);
  }

  return card;
}

// ===============================================
// STAT CARD COMPONENT
// ===============================================

/**
 * Create a statistics card with value, label, and optional trend.
 */
export function createStatCard(config: StatCardConfig): HTMLElement {
  const {
    label,
    value,
    change,
    changePositive,
    trend,
    icon,
    className = '',
    onClick
  } = config;

  const card = document.createElement('div');
  card.className = cx('stat-card', onClick && 'stat-card-clickable', className);

  if (onClick) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', onClick);
  }

  // Icon
  if (icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'stat-card-icon';
    iconEl.innerHTML = icon;
    card.appendChild(iconEl);
  }

  // Content
  const content = document.createElement('div');
  content.className = 'stat-card-content';

  const valueEl = document.createElement('div');
  valueEl.className = 'stat-card-value';
  valueEl.textContent = String(value);

  const labelEl = document.createElement('div');
  labelEl.className = 'stat-card-label';
  labelEl.textContent = label;

  content.appendChild(valueEl);
  content.appendChild(labelEl);

  // Change indicator
  if (change !== undefined) {
    const changeEl = document.createElement('div');
    const isPositive = changePositive ?? change >= 0;
    changeEl.className = `stat-card-change ${isPositive ? 'change-positive' : 'change-negative'}`;

    const trendIcon = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '';
    const changeSign = change >= 0 ? '+' : '';
    changeEl.textContent = `${trendIcon} ${changeSign}${change}%`;

    content.appendChild(changeEl);
  }

  card.appendChild(content);

  return card;
}

// ===============================================
// INFO ROW COMPONENT
// ===============================================

/**
 * Create an info row (label + value pair).
 */
export function createInfoRow(config: InfoRowConfig): HTMLElement {
  const {
    label,
    value,
    copyable = false,
    isLink = false,
    href,
    className = ''
  } = config;

  const row = document.createElement('div');
  row.className = cx('info-row', className);

  const labelEl = document.createElement('span');
  labelEl.className = 'info-row-label';
  labelEl.textContent = label;

  const valueWrapper = document.createElement('span');
  valueWrapper.className = 'info-row-value';

  if (typeof value === 'string') {
    if (isLink && href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = value;
      link.className = 'info-row-link';
      valueWrapper.appendChild(link);
    } else {
      valueWrapper.textContent = value;
    }
  } else {
    valueWrapper.appendChild(value);
  }

  if (copyable && typeof value === 'string') {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'info-row-copy';
    copyBtn.setAttribute('aria-label', 'Copy to clipboard');
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    valueWrapper.appendChild(copyBtn);
  }

  row.appendChild(labelEl);
  row.appendChild(valueWrapper);

  return row;
}

/**
 * Create a list of info rows.
 */
export function createInfoList(rows: InfoRowConfig[], twoColumn = false): HTMLElement {
  const list = document.createElement('div');
  list.className = `info-list ${twoColumn ? 'info-list-two-column' : ''}`;

  rows.forEach(rowConfig => {
    list.appendChild(createInfoRow(rowConfig));
  });

  return list;
}

// ===============================================
// PROGRESS BAR COMPONENT
// ===============================================

/**
 * Create a progress bar.
 */
export function createProgressBar(config: ProgressBarConfig): HTMLElement {
  const {
    value,
    max = 100,
    showLabel = true,
    labelFormat = '{value}%',
    variant = 'default',
    indeterminate = false,
    size = 'md',
    className = '',
    animated = true
  } = config;

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const wrapper = document.createElement('div');
  wrapper.className = cx(
    'progress-bar',
    `progress-bar-${variant}`,
    `progress-bar-${size}`,
    indeterminate && 'progress-bar-indeterminate',
    animated && 'progress-bar-animated',
    className
  );

  wrapper.setAttribute('role', 'progressbar');
  wrapper.setAttribute('aria-valuenow', String(value));
  wrapper.setAttribute('aria-valuemin', '0');
  wrapper.setAttribute('aria-valuemax', String(max));

  const track = document.createElement('div');
  track.className = 'progress-bar-track';

  const fill = document.createElement('div');
  fill.className = 'progress-bar-fill';
  if (!indeterminate) {
    fill.style.width = `${percentage}%`;
  }

  track.appendChild(fill);
  wrapper.appendChild(track);

  if (showLabel && !indeterminate) {
    const label = document.createElement('span');
    label.className = 'progress-bar-label';
    label.textContent = labelFormat.replace('{value}', Math.round(percentage).toString());
    wrapper.appendChild(label);
  }

  return wrapper;
}

/**
 * Update a progress bar value.
 */
export function updateProgressBar(progressBar: HTMLElement, value: number, max = 100): void {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const fill = progressBar.querySelector('.progress-bar-fill') as HTMLElement;
  const label = progressBar.querySelector('.progress-bar-label');

  if (fill) {
    fill.style.width = `${percentage}%`;
  }

  if (label) {
    label.textContent = `${Math.round(percentage)}%`;
  }

  progressBar.setAttribute('aria-valuenow', String(value));
}

// ===============================================
// ALERT COMPONENT
// ===============================================

/**
 * Create an inline alert.
 */
export function createAlert(config: AlertConfig): HTMLElement {
  const {
    message,
    variant = 'info',
    title,
    dismissible = false,
    onDismiss,
    icon,
    className = ''
  } = config;

  const alert = document.createElement('div');
  alert.className = cx(
    'alert',
    `alert-${variant}`,
    dismissible && 'alert-dismissible',
    className
  );
  alert.setAttribute('role', 'alert');

  // Icon
  const alertIcon = icon || getAlertIcon(variant);
  const iconEl = document.createElement('span');
  iconEl.className = 'alert-icon';
  iconEl.innerHTML = alertIcon;
  alert.appendChild(iconEl);

  // Content
  const content = document.createElement('div');
  content.className = 'alert-content';

  if (title) {
    const titleEl = document.createElement('strong');
    titleEl.className = 'alert-title';
    titleEl.textContent = title;
    content.appendChild(titleEl);
  }

  const messageEl = document.createElement('span');
  messageEl.className = 'alert-message';
  messageEl.textContent = message;
  content.appendChild(messageEl);

  alert.appendChild(content);

  // Dismiss button
  if (dismissible) {
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'alert-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    dismissBtn.addEventListener('click', () => {
      alert.remove();
      onDismiss?.();
    });

    alert.appendChild(dismissBtn);
  }

  return alert;
}

function getAlertIcon(variant: string): string {
  switch (variant) {
  case 'success':
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  case 'warning':
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  case 'danger':
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  default:
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }
}

// ===============================================
// SPINNER COMPONENT
// ===============================================

/**
 * Create a loading spinner.
 */
export function createSpinner(config: SpinnerConfig = {}): HTMLElement {
  const {
    size = 'md',
    message,
    centered = false,
    className = ''
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx(
    'spinner-wrapper',
    `spinner-${size}`,
    centered && 'spinner-centered',
    className
  );
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  spinner.setAttribute('aria-hidden', 'true');

  wrapper.appendChild(spinner);

  if (message) {
    const messageEl = document.createElement('span');
    messageEl.className = 'spinner-message';
    messageEl.textContent = message;
    wrapper.appendChild(messageEl);
  } else {
    // Screen reader only text
    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = 'Loading...';
    wrapper.appendChild(srText);
  }

  return wrapper;
}

// ===============================================
// SKELETON COMPONENT
// ===============================================

/**
 * Create a skeleton placeholder.
 */
export function createSkeleton(config: SkeletonConfig = {}): HTMLElement {
  const {
    type = 'text',
    lines = 3,
    width,
    height,
    className = '',
    animated = true
  } = config;

  const skeleton = document.createElement('div');
  skeleton.className = cx(
    'skeleton',
    `skeleton-${type}`,
    animated && 'skeleton-animated',
    className
  );
  skeleton.setAttribute('aria-hidden', 'true');

  if (width) skeleton.style.width = width;
  if (height) skeleton.style.height = height;

  if (type === 'text') {
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton-line';
      // Make last line shorter
      if (i === lines - 1) {
        line.style.width = '60%';
      }
      skeleton.appendChild(line);
    }
  } else if (type === 'card') {
    skeleton.innerHTML = `
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-line" style="width: 70%"></div>
        <div class="skeleton-line" style="width: 90%"></div>
        <div class="skeleton-line" style="width: 50%"></div>
      </div>
    `;
  } else if (type === 'avatar') {
    skeleton.innerHTML = '<div class="skeleton-circle"></div>';
  } else if (type === 'row') {
    skeleton.innerHTML = `
      <div class="skeleton-circle" style="width: 40px; height: 40px;"></div>
      <div class="skeleton-content" style="flex: 1;">
        <div class="skeleton-line" style="width: 30%"></div>
        <div class="skeleton-line" style="width: 60%"></div>
      </div>
    `;
  }

  return skeleton;
}

/**
 * Create multiple skeleton items for lists.
 */
export function createSkeletonList(count: number, config: SkeletonConfig = {}): HTMLElement {
  const list = document.createElement('div');
  list.className = 'skeleton-list';

  for (let i = 0; i < count; i++) {
    list.appendChild(createSkeleton(config));
  }

  return list;
}
