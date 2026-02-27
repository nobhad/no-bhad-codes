/**
 * ===============================================
 * REACT FACTORY EXPORTS
 * ===============================================
 * @file src/react/factories/index.ts
 *
 * Central export hub for React factory components.
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
// HOOKS
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
// STATUS BADGE
// ============================================

export {
  StatusBadge,
  StatusDot,
  getStatusVariant,
  BADGE_VARIANTS,
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
} from './StatusBadge';

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
