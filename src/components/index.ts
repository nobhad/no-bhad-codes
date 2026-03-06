/**
 * ===============================================
 * COMPONENT SYSTEM REGISTRY
 * ===============================================
 * @file src/components/index.ts
 *
 * Central registry for all active components.
 * Dead/unused components have been removed.
 */

// State components
export * from './state-components';

// Component system (used by main site DI container)
export { componentStore, ComponentUtils } from './component-store';
export type { ComponentDefinition, ComponentInstance } from './component-store';
export { BaseComponent } from './base-component';
export type {
  ComponentProps,
  ComponentState,
  ComponentTemplate,
  ComponentHooks
} from './base-component';

// Consent banner (main site)
export { ConsentBanner } from './consent-banner';
export type { ConsentBannerProps, ConsentBannerState } from './consent-banner';
export { createConsentBanner } from './create-consent-banner';

// Core active components
export {
  createEmptyState,
  renderEmptyState,
  createLoadingState,
  renderLoadingState,
  createErrorState,
  renderErrorState
} from './empty-state';
export type { EmptyStateOptions, LoadingStateOptions, ErrorStateOptions } from './empty-state';

export {
  createStatusBadge,
  getStatusBadgeHTML,
  createStatusDot,
  getStatusDotHTML
} from './status-badge';
export type { StatusBadgeVariant } from './status-badge';

export { createIconButton } from './icon-button';
export type { IconButtonConfig } from './icon-button';

export {
  createTableDropdown,
  getStatusLabel,
  LEAD_STATUS_OPTIONS,
  CONTACT_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS
} from './table-dropdown';
export type { TableDropdownOption, TableDropdownConfig } from './table-dropdown';

export { createPortalModal } from './portal-modal';
export type { PortalModalConfig, PortalModalInstance } from './portal-modal';

export { getPortalCheckboxHTML } from './portal-checkbox';
export type { PortalCheckboxConfig } from './portal-checkbox';

export { initPasswordToggle, initAllPasswordToggles } from './password-toggle';

export { createSecondarySidebar, SECONDARY_TAB_ICONS } from './secondary-sidebar';
export type {
  SecondaryTab,
  SecondarySidebarConfig,
  SecondarySidebarController
} from './secondary-sidebar';

export { renderBreadcrumbs } from './breadcrumbs';
export type { BreadcrumbItem } from './breadcrumbs';

// Bulk action utilities
export {
  createBulkActionToolbar,
  createHeaderCheckbox,
  createRowCheckbox,
  setupBulkSelectionHandlers,
  resetSelection,
  getSelectionState,
  getSelectedIds,
  createArchiveAction,
  createDeleteAction,
  createStatusUpdateAction
} from '../utils/table-bulk-actions';
export type { BulkAction, BulkActionConfig, BulkSelectionState } from '../utils/table-bulk-actions';

// Focus trap utilities
export {
  createFocusTrap,
  removeFocusTrap,
  hasFocusTrap,
  manageFocusTrap
} from '../utils/focus-trap';

// Loading state utilities
export {
  getTableLoadingRow,
  getContainerLoadingHTML,
  getInlineLoadingHTML,
  getTableEmptyRow,
  getContainerEmptyHTML,
  showTableEmpty,
  showTableLoading,
  showContainerLoading,
  showContainerEmpty,
  getListSkeletonHTML,
  getCardSkeletonHTML,
  getChartSkeletonHTML,
  withLoading
} from '../utils/loading-utils';

// Button loading utilities
export { setButtonLoading, clearButtonLoading, withButtonLoading } from '../utils/button-loading';

/**
 * ComponentRegistry placeholder for future component system expansion
 */
export class ComponentRegistry {
  // Methods to be implemented as needed
}
