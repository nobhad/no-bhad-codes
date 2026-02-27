/**
 * ===============================================
 * UI FACTORY SYSTEM
 * ===============================================
 * @file src/factories/index.ts
 *
 * Central export hub for all factory modules.
 * Import everything from this file for clean imports.
 *
 * @example
 * import { renderButton, renderBadge, ICON_SIZES } from '@/factories';
 */

// ============================================
// CONSTANTS & TYPES
// ============================================

export {
  UI_CONTEXTS,
  ICON_SIZES,
  BUTTON_SIZES,
  CONTEXT_DEFAULTS,
  SVG_ATTRS
} from './constants';

export type {
  UIContext,
  IconSizeKey,
  ButtonSizeKey,
  IconConfig,
  IconDefinition,
  IconCategory,
  ButtonVariant,
  ButtonActionDefinition,
  ButtonConfig,
  ButtonGroupConfig,
  BadgeVariant,
  BadgeConfig,
  DotConfig,
  EmptyStateConfig,
  LoadingStateConfig,
  ErrorStateConfig
} from './types';

// ============================================
// ICON FACTORY
// ============================================

export {
  renderIcon,
  getIconSvg,
  createIconElement,
  getIconWithSize,
  resolveIconSize,
  getLucideComponentName,
  LUCIDE_ICON_MAP,
  ICON_REGISTRY,
  getIconDefinition,
  getAllIconNames,
  getIconsByCategory
} from './icons/icon-factory';

// ============================================
// BUTTON FACTORY
// ============================================

export {
  renderButton,
  renderButtons,
  renderButtonGroup,
  renderActionsCell,
  renderButtonSet,
  createButton,
  createButtons,
  createButtonGroup,
  createAction,
  conditionalAction,
  BUTTON_ACTIONS,
  getButtonAction,
  isValidAction,
  BUTTON_SETS,
  getButtonSet,
  applyContextToSet
} from './buttons/button-factory';

export type { ButtonActionType } from './buttons/button-actions';
export type { ButtonSetName } from './buttons/button-sets';

// ============================================
// BADGE FACTORY
// ============================================

export {
  renderBadge,
  renderDot,
  getStatusBadgeHTML,
  getStatusDotHTML,
  createBadge,
  createStatusBadge,
  createDot,
  createStatusDot,
  BADGE_VARIANTS,
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
} from './components/badge-factory';

// ============================================
// STATE FACTORY
// ============================================

export {
  renderEmptyState,
  createEmptyState,
  renderEmptyStateInto,
  renderLoadingState,
  createLoadingState,
  renderLoadingStateInto,
  renderErrorState,
  createErrorState,
  renderErrorStateInto,
  renderSkeleton,
  createSkeleton
} from './components/state-factory';
