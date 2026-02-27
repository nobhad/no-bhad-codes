/**
 * ===============================================
 * TABLE ACTION BUTTONS - Centralized Configuration
 * ===============================================
 * @file src/components/table-action-buttons.ts
 *
 * Single source of truth for all table action buttons.
 * Tables declare which actions they need, this module
 * renders them consistently.
 */

import { ICONS } from '../constants/icons';

// ============================================
// BUTTON DEFINITIONS
// ============================================

/**
 * All available table action button types.
 * Each button has a consistent icon and title.
 */
export const TABLE_ACTIONS = {
  // View/Navigation
  view: { icon: ICONS.EYE, title: 'View', ariaLabel: 'View' },
  preview: { icon: ICONS.EYE, title: 'Preview', ariaLabel: 'Preview' },

  // Edit/Modify
  edit: { icon: ICONS.EDIT, title: 'Edit', ariaLabel: 'Edit' },

  // Delete/Remove
  delete: { icon: ICONS.TRASH, title: 'Delete', ariaLabel: 'Delete' },
  remove: { icon: ICONS.X, title: 'Remove', ariaLabel: 'Remove' },

  // Send/Share
  send: { icon: ICONS.SEND, title: 'Send', ariaLabel: 'Send' },
  remind: { icon: ICONS.BELL, title: 'Send reminder', ariaLabel: 'Send reminder' },

  // Approve/Reject
  approve: { icon: ICONS.CIRCLE_CHECK, title: 'Approve', ariaLabel: 'Approve' },
  reject: { icon: ICONS.CIRCLE_X, title: 'Reject', ariaLabel: 'Reject' },
  'start-review': { icon: ICONS.CHECK_SQUARE, title: 'Start review', ariaLabel: 'Start review' },

  // Download/Export
  download: { icon: ICONS.DOWNLOAD, title: 'Download', ariaLabel: 'Download' },
  export: { icon: ICONS.DOWNLOAD, title: 'Export', ariaLabel: 'Export' },

  // Convert/Transform
  convert: { icon: ICONS.ROCKET, title: 'Convert', ariaLabel: 'Convert' },
  'convert-client': { icon: ICONS.USER_PLUS, title: 'Convert to Client', ariaLabel: 'Convert to Client' },
  'convert-project': { icon: ICONS.ROCKET, title: 'Convert to Project', ariaLabel: 'Convert to Project' },
  'convert-invoice': { icon: ICONS.RECEIPT, title: 'Convert to Invoice', ariaLabel: 'Convert to Invoice' },

  // Status/Toggle
  toggle: { icon: ICONS.EYE, title: 'Toggle', ariaLabel: 'Toggle' },
  enable: { icon: ICONS.EYE, title: 'Enable', ariaLabel: 'Enable' },
  disable: { icon: ICONS.EYE_OFF, title: 'Disable', ariaLabel: 'Disable' },
  'mark-paid': { icon: ICONS.CIRCLE_CHECK, title: 'Mark as Paid', ariaLabel: 'Mark as Paid' },

  // Archive/Restore/Expire
  archive: { icon: ICONS.ARCHIVE, title: 'Archive', ariaLabel: 'Archive' },
  restore: { icon: ICONS.ROTATE_CCW, title: 'Restore', ariaLabel: 'Restore' },
  expire: { icon: ICONS.CLOCK, title: 'Expire', ariaLabel: 'Expire' },

  // Workflow
  steps: { icon: ICONS.LIST, title: 'Manage steps', ariaLabel: 'Manage steps' },
  history: { icon: ICONS.LIST, title: 'View History', ariaLabel: 'View History' },

  // Other
  copy: { icon: ICONS.COPY, title: 'Copy', ariaLabel: 'Copy' },
  refresh: { icon: ICONS.REFRESH, title: 'Refresh', ariaLabel: 'Refresh' },
  add: { icon: ICONS.PLUS, title: 'Add', ariaLabel: 'Add' },
  test: { icon: ICONS.SEND, title: 'Send Test', ariaLabel: 'Send test' },
  versions: { icon: ICONS.LIST, title: 'Version History', ariaLabel: 'View version history' },
} as const;

export type TableActionType = keyof typeof TABLE_ACTIONS;

// ============================================
// BUTTON CONFIGURATION
// ============================================

export interface TableActionConfig {
  /** Action type from TABLE_ACTIONS */
  action: TableActionType;
  /** Data attribute value (e.g., row ID) */
  dataId?: string | number;
  /** Additional data attributes */
  dataAttrs?: Record<string, string | number | boolean>;
  /** Custom title override */
  title?: string;
  /** Custom aria-label override */
  ariaLabel?: string;
  /** Additional CSS class (for JS targeting only, not styling) */
  className?: string;
  /** Condition to show button (default: true) */
  show?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render a single table action button.
 */
export function renderActionButton(config: TableActionConfig): string {
  const { action, dataId, dataAttrs = {}, title, ariaLabel, className, show = true, disabled = false } = config;

  if (!show) return '';

  const def = TABLE_ACTIONS[action];
  if (!def) {
    console.warn(`Unknown table action: ${action}`);
    return '';
  }

  const buttonTitle = title ?? def.title;
  const buttonAriaLabel = ariaLabel ?? def.ariaLabel;

  // Build data attributes
  const dataAttrStr = Object.entries({
    'data-action': action,
    ...(dataId !== undefined ? { 'data-id': dataId } : {}),
    ...Object.fromEntries(
      Object.entries(dataAttrs).map(([k, v]) => [`data-${k}`, v])
    ),
  })
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  const classNames = ['icon-btn', className].filter(Boolean).join(' ');
  const disabledAttr = disabled ? 'disabled' : '';

  return `<button type="button" class="${classNames}" ${dataAttrStr} title="${buttonTitle}" aria-label="${buttonAriaLabel}" ${disabledAttr}>${def.icon}</button>`;
}

/**
 * Render multiple table action buttons.
 * Returns HTML string for the actions cell content.
 */
export function renderActionButtons(configs: TableActionConfig[]): string {
  return configs.map(renderActionButton).filter(Boolean).join('');
}

/**
 * Render a complete table actions cell.
 */
export function renderActionsCell(configs: TableActionConfig[]): string {
  const buttons = renderActionButtons(configs);
  if (!buttons) return '';
  return `<div class="table-actions">${buttons}</div>`;
}

// ============================================
// PREDEFINED BUTTON SETS
// ============================================

/**
 * Common button sets for different entity types.
 * Use these as starting points and customize as needed.
 */
export const COMMON_ACTION_SETS = {
  /** View, Edit, Delete */
  crud: (id: string | number) => [
    { action: 'view' as const, dataId: id },
    { action: 'edit' as const, dataId: id },
    { action: 'delete' as const, dataId: id },
  ],

  /** View, Delete */
  viewDelete: (id: string | number) => [
    { action: 'view' as const, dataId: id },
    { action: 'delete' as const, dataId: id },
  ],

  /** Edit, Delete */
  editDelete: (id: string | number) => [
    { action: 'edit' as const, dataId: id },
    { action: 'delete' as const, dataId: id },
  ],

  /** Preview, Download, Delete (files) */
  fileActions: (id: string | number, canPreview = true, canDelete = true) => [
    { action: 'preview' as const, dataId: id, show: canPreview },
    { action: 'download' as const, dataId: id },
    { action: 'delete' as const, dataId: id, show: canDelete },
  ],

  /** Restore, Delete (deleted items) */
  deletedItemActions: (id: string | number) => [
    { action: 'restore' as const, dataId: id },
    { action: 'delete' as const, dataId: id, title: 'Delete Permanently', ariaLabel: 'Delete permanently' },
  ],
};

// ============================================
// HELPER FOR CREATING CUSTOM BUTTONS
// ============================================

/**
 * Create a custom action button config with type safety.
 */
export function createAction(
  action: TableActionType,
  dataId?: string | number,
  options?: Partial<Omit<TableActionConfig, 'action' | 'dataId'>>
): TableActionConfig {
  return { action, dataId, ...options };
}

/**
 * Create conditional action that only shows when condition is true.
 */
export function conditionalAction(
  condition: boolean,
  action: TableActionType,
  dataId?: string | number,
  options?: Partial<Omit<TableActionConfig, 'action' | 'dataId' | 'show'>>
): TableActionConfig {
  return { action, dataId, show: condition, ...options };
}
