/**
 * ===============================================
 * TABLE ACTION BUTTONS - DEPRECATED
 * ===============================================
 * @file src/components/table-action-buttons.ts
 *
 * @deprecated This module is deprecated. All admin modules have been
 * migrated to import directly from @/factories.
 *
 * MIGRATION COMPLETED: February 2026
 * - All 16 admin modules now use direct factory imports
 * - This file can be deleted once no external consumers exist
 *
 * DO NOT USE THIS FILE FOR NEW CODE.
 * Instead, import directly from '@/factories':
 *
 * @example
 * // OLD (deprecated):
 * import { renderActionsCell, createAction } from '../components/table-action-buttons';
 *
 * // NEW (preferred):
 * import { renderActionsCell, createAction } from '../factories';
 */

import {
  renderButton as factoryRenderButton,
  renderButtons as factoryRenderButtons,
  renderActionsCell as factoryRenderActionsCell,
  createAction as factoryCreateAction,
  conditionalAction as factoryConditionalAction,
  BUTTON_ACTIONS,
  getButtonSet
} from '../factories';
import type { ButtonConfig } from '../factories/types';

// Re-export BUTTON_ACTIONS as TABLE_ACTIONS for backwards compatibility
export const TABLE_ACTIONS = BUTTON_ACTIONS;

export type TableActionType = keyof typeof BUTTON_ACTIONS;

// ============================================
// BUTTON CONFIGURATION
// ============================================

/**
 * Table action configuration interface.
 * @deprecated Use ButtonConfig from @/factories/types instead.
 */
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
// RENDER FUNCTIONS (using factory internally)
// ============================================

/**
 * Render a single table action button.
 * Uses the factory system internally for consistency.
 */
export function renderActionButton(config: TableActionConfig): string {
  return factoryRenderButton({
    ...config,
    context: 'table'
  } as ButtonConfig);
}

/**
 * Render multiple table action buttons.
 * Returns HTML string for the actions cell content.
 */
export function renderActionButtons(configs: TableActionConfig[]): string {
  return factoryRenderButtons(configs.map((cfg) => ({ ...cfg, context: 'table' }) as ButtonConfig));
}

/**
 * Render a complete table actions cell.
 */
export function renderActionsCell(configs: TableActionConfig[]): string {
  return factoryRenderActionsCell(
    configs.map((cfg) => ({ ...cfg }) as ButtonConfig),
    'table'
  );
}

// ============================================
// PREDEFINED BUTTON SETS
// ============================================

/**
 * Common button sets for different entity types.
 * Uses the factory's BUTTON_SETS for consistency.
 *
 * @deprecated Use getButtonSet() from @/factories instead.
 */
export const COMMON_ACTION_SETS = {
  /** View, Edit, Delete */
  crud: (id: string | number): TableActionConfig[] =>
    getButtonSet('tableCrud', id) as TableActionConfig[],

  /** View, Delete */
  viewDelete: (id: string | number): TableActionConfig[] =>
    getButtonSet('tableViewDelete', id) as TableActionConfig[],

  /** Edit, Delete */
  editDelete: (id: string | number): TableActionConfig[] =>
    getButtonSet('tableEditDelete', id) as TableActionConfig[],

  /** Preview, Download, Delete (files) */
  fileActions: (id: string | number, canPreview = true, canDelete = true): TableActionConfig[] =>
    getButtonSet('tableFile', id, canPreview, canDelete) as TableActionConfig[],

  /** Restore, Delete (deleted items) */
  deletedItemActions: (id: string | number): TableActionConfig[] =>
    getButtonSet('tableDeletedItem', id) as TableActionConfig[]
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
  return factoryCreateAction(action, dataId, options) as TableActionConfig;
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
  return factoryConditionalAction(condition, action, dataId, options) as TableActionConfig;
}
