/**
 * ===============================================
 * TABLE BUILDER (REUSABLE)
 * ===============================================
 * @file src/components/table-builder.ts
 *
 * Reusable table components for admin and client portals.
 * Creates consistent table rows, action cells, and status cells.
 */

import { createIconButton, type IconButtonConfig } from './icon-button';
import { createStatusBadge, createStatusDot, type StatusBadgeVariant } from './status-badge';
import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface TableActionConfig {
  /** SVG icon markup */
  iconSvg: string;
  /** Accessible label */
  label: string;
  /** Click handler */
  onClick: (e: MouseEvent) => void;
  /** Optional tooltip (defaults to label) */
  title?: string;
  /** Additional class names */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Variant for styling (default, danger, warning) */
  variant?: 'default' | 'danger' | 'warning';
}

export interface TableRowConfig {
  /** Unique row ID (used for data-row-id attribute) */
  id: string | number;
  /** Array of cell configurations */
  cells: TableCellConfig[];
  /** Optional additional class names */
  className?: string;
  /** Optional click handler for the row */
  onClick?: (e: MouseEvent) => void;
  /** Data attributes to add to the row */
  dataAttributes?: Record<string, string | number>;
}

export interface TableCellConfig {
  /** Cell content (string, HTMLElement, or HTML string) */
  content: string | HTMLElement;
  /** Optional class names */
  className?: string;
  /** Optional data attributes */
  dataAttributes?: Record<string, string | number>;
  /** If true, content is treated as raw HTML */
  isHTML?: boolean;
  /** Optional column header for mobile stacking */
  header?: string;
}

export interface ActionCellConfig {
  /** Array of action buttons */
  actions: TableActionConfig[];
  /** Optional class names for the cell */
  className?: string;
  /** Optional class names for the actions wrapper */
  wrapperClassName?: string;
}

export interface StatusCellConfig {
  /** Status value (used for variant class) */
  status: string;
  /** Optional display label (defaults to formatted status) */
  label?: string;
  /** Use badge style (default) or dot style */
  style?: 'badge' | 'dot';
  /** Additional class names */
  className?: string;
}

// ===============================================
// TABLE ROW BUILDER
// ===============================================

/**
 * Create a table row element with cells.
 */
export function createTableRow(config: TableRowConfig): HTMLTableRowElement {
  const {
    id,
    cells,
    className = '',
    onClick,
    dataAttributes = {}
  } = config;

  const row = document.createElement('tr');
  row.className = className || '';
  row.setAttribute('data-row-id', String(id));

  // Add data attributes
  Object.entries(dataAttributes).forEach(([key, value]) => {
    row.setAttribute(`data-${key}`, String(value));
  });

  // Add cells
  cells.forEach(cellConfig => {
    const cell = createTableCell(cellConfig);
    row.appendChild(cell);
  });

  // Add click handler
  if (onClick) {
    row.style.cursor = 'pointer';
    row.addEventListener('click', onClick);
  }

  return row;
}

/**
 * Create a single table cell element.
 */
export function createTableCell(config: TableCellConfig): HTMLTableCellElement {
  const {
    content,
    className = '',
    dataAttributes = {},
    isHTML = false,
    header
  } = config;

  const cell = document.createElement('td');
  cell.className = className || '';

  // Add data attributes
  Object.entries(dataAttributes).forEach(([key, value]) => {
    cell.setAttribute(`data-${key}`, String(value));
  });

  // Add mobile header if provided
  if (header) {
    cell.setAttribute('data-label', header);
  }

  // Add content
  if (typeof content === 'string') {
    if (isHTML) {
      cell.innerHTML = content;
    } else {
      cell.textContent = content;
    }
  } else {
    cell.appendChild(content);
  }

  return cell;
}

// ===============================================
// ACTION CELL BUILDER
// ===============================================

/**
 * Create an actions cell with icon buttons.
 */
export function createActionCell(config: ActionCellConfig): HTMLTableCellElement {
  const {
    actions,
    className = 'actions-cell',
    wrapperClassName = 'table-actions'
  } = config;

  const cell = document.createElement('td');
  cell.className = className;

  const wrapper = document.createElement('div');
  wrapper.className = wrapperClassName;

  actions.forEach(action => {
    const variantClass = action.variant === 'danger' ? 'icon-btn-danger'
      : action.variant === 'warning' ? 'icon-btn-warning'
        : '';

    const buttonConfig: IconButtonConfig = {
      iconSvg: action.iconSvg,
      label: action.label,
      title: action.title || action.label,
      onClick: action.onClick,
      className: [variantClass, action.className].filter(Boolean).join(' '),
      disabled: action.disabled
    };

    const button = createIconButton(buttonConfig);
    wrapper.appendChild(button);
  });

  cell.appendChild(wrapper);
  return cell;
}

/**
 * Get HTML string for an actions cell (for use in innerHTML templates).
 */
export function getActionCellHTML(
  actions: Array<{
    iconSvg: string;
    label: string;
    dataAction?: string;
    dataId?: string | number;
    className?: string;
    variant?: 'default' | 'danger' | 'warning';
    disabled?: boolean;
  }>,
  className = 'actions-cell',
  wrapperClassName = 'table-actions'
): string {
  const actionsHTML = actions.map(action => {
    const variantClass = action.variant === 'danger' ? 'icon-btn-danger'
      : action.variant === 'warning' ? 'icon-btn-warning'
        : '';
    const classes = ['icon-btn', variantClass, action.className].filter(Boolean).join(' ');
    const dataAttrs = [
      action.dataAction ? `data-action="${action.dataAction}"` : '',
      action.dataId !== undefined ? `data-id="${action.dataId}"` : '',
      action.disabled ? 'disabled' : ''
    ].filter(Boolean).join(' ');

    return `<button type="button" class="${classes}" aria-label="${escapeHtml(action.label)}" title="${escapeHtml(action.label)}" ${dataAttrs}>
      <span class="icon-btn-svg">${action.iconSvg}</span>
    </button>`;
  }).join('');

  return `<td class="${className}"><div class="${wrapperClassName}">${actionsHTML}</div></td>`;
}

// ===============================================
// STATUS CELL BUILDER
// ===============================================

/**
 * Create a status cell with badge or dot indicator.
 */
export function createStatusCell(config: StatusCellConfig): HTMLTableCellElement {
  const {
    status,
    label,
    style = 'badge',
    className = ''
  } = config;

  const cell = document.createElement('td');
  cell.className = cx('status-cell', className);

  if (style === 'dot') {
    const indicator = createStatusDot(status, { label });
    cell.appendChild(indicator);
  } else {
    const displayLabel = label || formatStatusLabel(status);
    const badge = createStatusBadge(displayLabel, status as StatusBadgeVariant);
    cell.appendChild(badge);
  }

  return cell;
}

/**
 * Get HTML string for a status cell (for use in innerHTML templates).
 */
export function getStatusCellHTML(
  status: string,
  options?: {
    label?: string;
    style?: 'badge' | 'dot';
    className?: string;
  }
): string {
  const { label, style = 'badge', className = '' } = options || {};
  const displayLabel = label || formatStatusLabel(status);
  const variant = variantToClass(status);
  const cellClass = cx('status-cell', className);

  if (style === 'dot') {
    return `<td class="${cellClass}"><span class="status-indicator status-${escapeHtml(variant)}"><span class="status-dot"></span><span class="status-text">${escapeHtml(displayLabel)}</span></span></td>`;
  }

  return `<td class="${cellClass}"><span class="status-badge status-${escapeHtml(variant)}">${escapeHtml(displayLabel)}</span></td>`;
}

// ===============================================
// HELPER FUNCTIONS
// ===============================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function variantToClass(variant: string): string {
  return variant.replace(/_/g, '-').toLowerCase();
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ===============================================
// TABLE PAGINATION
// ===============================================

export interface TablePaginationConfig {
  /** Total number of items */
  total: number;
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Optional class names */
  className?: string;
}

/**
 * Create pagination controls for a table.
 */
export function createTablePagination(config: TablePaginationConfig): HTMLElement {
  const {
    total,
    page,
    perPage,
    onPageChange,
    className = ''
  } = config;

  const totalPages = Math.ceil(total / perPage);
  const startItem = (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, total);

  const container = document.createElement('div');
  container.className = cx('table-pagination', className);

  // Info text
  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent = total > 0 ? `${startItem}-${endItem} of ${total}` : 'No items';
  container.appendChild(info);

  // Navigation buttons
  const nav = document.createElement('div');
  nav.className = 'pagination-nav';

  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'pagination-btn';
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener('click', () => onPageChange(page - 1));
  nav.appendChild(prevBtn);

  // Page indicator
  const pageIndicator = document.createElement('span');
  pageIndicator.className = 'pagination-page';
  pageIndicator.textContent = `Page ${page} of ${totalPages || 1}`;
  nav.appendChild(pageIndicator);

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pagination-btn';
  nextBtn.textContent = 'Next';
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener('click', () => onPageChange(page + 1));
  nav.appendChild(nextBtn);

  container.appendChild(nav);

  return container;
}

// ===============================================
// SORTABLE TABLE HEADER
// ===============================================

export interface SortableHeaderConfig {
  /** Column key for sorting */
  key: string;
  /** Display label */
  label: string;
  /** Current sort key */
  currentSortKey?: string;
  /** Current sort direction */
  currentSortDir?: 'asc' | 'desc';
  /** Callback when header is clicked */
  onSort: (key: string, direction: 'asc' | 'desc') => void;
  /** Additional class names */
  className?: string;
}

/**
 * Create a sortable table header cell.
 */
export function createSortableHeader(config: SortableHeaderConfig): HTMLTableCellElement {
  const {
    key,
    label,
    currentSortKey,
    currentSortDir,
    onSort,
    className = ''
  } = config;

  const th = document.createElement('th');
  th.className = cx('sortable-header', className);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sort-header-btn';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  button.appendChild(labelSpan);

  // Sort indicator
  const isActive = currentSortKey === key;
  if (isActive) {
    const indicator = document.createElement('span');
    indicator.className = 'sort-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = currentSortDir === 'asc' ? ' \u2191' : ' \u2193';
    button.appendChild(indicator);
    th.classList.add('sort-active');
    th.setAttribute('aria-sort', currentSortDir === 'asc' ? 'ascending' : 'descending');
  }

  button.addEventListener('click', () => {
    const newDir = isActive && currentSortDir === 'asc' ? 'desc' : 'asc';
    onSort(key, newDir);
  });

  th.appendChild(button);
  return th;
}
