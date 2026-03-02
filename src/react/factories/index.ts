/**
 * ===============================================
 * REACT FACTORY EXPORTS
 * ===============================================
 * @file src/react/factories/index.ts
 *
 * Central export hub for React factory components and hooks.
 *
 * ## Available Factories
 *
 * ### Mount Factories
 * - `createTableMount` - Basic mount/unmount for table components
 * - `createMountWrapper` - Full-featured mount with selector support
 * - `createSimpleMount` - Quick mount for simple components
 *
 * ### Component Factories
 * - `IconButton` - Icon button with action registry
 * - `StatusBadge` - Status display badges
 * - `StateDisplay` - Empty/Loading/Error states
 *
 * ### Hook Factories
 * - `useButtonFactory` - Button rendering utilities
 * - `useTableActions` - Table action rendering
 * - `useConditionalActions` - Conditional action rendering
 * - `useActionHandlers` - Unified action handling
 * - `useBulkAction` - Bulk operation handling
 * - `useDataFetch` - Standardized API fetching
 * - `useCrud` - CRUD operations
 */

// ============================================
// ICON BUTTON
// ============================================

export {
  IconButton,
  ActionButton,
  TableActionButton,
  TableActions,
  getLucideIcon,
  ICON_COMPONENTS
} from './IconButton';

// ============================================
// BUTTON & ACTION HOOKS
// ============================================

export {
  useButtonFactory,
  useIconSize,
  useTableActions,
  useButtonSet,
  useConditionalActions,
  useActionHandlers
} from './useFactory';

// ============================================
// BULK ACTION HOOK
// ============================================

export {
  useBulkAction,
  BULK_ACTION_PRESETS,
  createStatusChangeAction
} from './useBulkAction';

export type {
  BulkOperationResult,
  BulkActionConfig,
  UseBulkActionOptions,
  UseBulkActionReturn,
  SelectionState,
  NotificationFn
} from './useBulkAction';

// ============================================
// DATA FETCH HOOKS
// ============================================

export {
  useDataFetch,
  useListFetch,
  useCrud
} from './useDataFetch';

export type {
  FetchState,
  UseDataFetchOptions,
  UseDataFetchReturn,
  ListFetchResult,
  UseCrudOptions
} from './useDataFetch';

// ============================================
// STATUS BADGE - Re-exported from components/portal
// See src/react/components/portal/StatusBadge.tsx
// ============================================

export {
  StatusBadge,
  getStatusVariant
} from '../components/portal/StatusBadge';

export type { StatusVariant } from '../components/portal/StatusBadge';

// Badge factory utilities
export {
  BADGE_VARIANTS,
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
} from '../../factories/components/badge-factory';

// ============================================
// STATE DISPLAY
// ============================================

export { EmptyState, LoadingState, ErrorState, Skeleton } from './StateDisplay';

// ============================================
// RE-EXPORT FACTORY TYPES & CONSTANTS
// ============================================

export { UI_CONTEXTS, ICON_SIZES, BUTTON_SIZES, CONTEXT_DEFAULTS } from '../../factories/constants';

export type {
  UIContext,
  IconSizeKey,
  ButtonSizeKey,
  ButtonConfig,
  ButtonVariant,
  BadgeVariant
} from '../../factories/types';

export { BUTTON_ACTIONS } from '../../factories/buttons/button-actions';
export { BUTTON_SETS } from '../../factories/buttons/button-sets';

// ============================================
// MOUNT FACTORIES
// ============================================

// Legacy table mount (still widely used)
export { createTableMount } from './createTableMount';
export type { TableMountOptions, TableMountResult } from './createTableMount';

// New streamlined mount wrapper
export { createMountWrapper, createSimpleMount } from './createMountWrapper';
export type {
  BaseMountOptions,
  MountWrapperConfig,
  MountWrapperResult
} from './createMountWrapper';
