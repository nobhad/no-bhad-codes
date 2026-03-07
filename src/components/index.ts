/**
 * ===============================================
 * COMPONENT SYSTEM REGISTRY
 * ===============================================
 * @file src/components/index.ts
 *
 * Central registry for all active components.
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

// Empty/loading/error state renderers
export {
  createEmptyState,
  renderEmptyState,
  createLoadingState,
  renderLoadingState,
  createErrorState,
  renderErrorState
} from './empty-state';
export type { EmptyStateOptions, LoadingStateOptions, ErrorStateOptions } from './empty-state';

// Status badge
export {
  createStatusBadge,
  getStatusBadgeHTML,
  createStatusDot,
  getStatusDotHTML
} from './status-badge';
export type { StatusBadgeVariant } from './status-badge';

// Icon button
export { createIconButton } from './icon-button';
export type { IconButtonConfig } from './icon-button';

// Password toggle (login pages)
export { initPasswordToggle, initAllPasswordToggles } from './password-toggle';

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
