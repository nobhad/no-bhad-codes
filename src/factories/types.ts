/**
 * ===============================================
 * FACTORY TYPES
 * ===============================================
 * @file src/factories/types.ts
 *
 * Shared TypeScript interfaces for the UI factory system.
 */

import { UI_CONTEXTS, ICON_SIZES, BUTTON_SIZES } from './constants';

// ============================================
// CORE TYPES
// ============================================

export type UIContext = (typeof UI_CONTEXTS)[keyof typeof UI_CONTEXTS];
export type IconSizeKey = keyof typeof ICON_SIZES;
export type ButtonSizeKey = keyof typeof BUTTON_SIZES;

// ============================================
// ICON TYPES
// ============================================

export interface IconConfig {
  /** Icon name from the registry */
  name: string;
  /** Size key or explicit pixel value */
  size?: IconSizeKey | number;
  /** Additional CSS class */
  className?: string;
  /** Aria label for accessibility (icons with meaning) */
  ariaLabel?: string;
  /** Whether to hide from screen readers (default: true for decorative icons) */
  ariaHidden?: boolean;
}

export interface IconDefinition {
  /** SVG path data (contents inside the <svg> tag) */
  path: string;
  /** Icon category for organization */
  category: IconCategory;
  /** Alternative names for this icon */
  aliases?: string[];
}

export type IconCategory =
  | 'navigation'
  | 'action'
  | 'status'
  | 'file'
  | 'communication'
  | 'media'
  | 'interface'
  | 'data';

// ============================================
// BUTTON TYPES
// ============================================

export type ButtonVariant = 'default' | 'danger' | 'success' | 'warning' | 'primary';

export interface ButtonActionDefinition {
  /** Icon name from the registry */
  icon: string;
  /** Default tooltip title */
  title: string;
  /** Default aria-label */
  ariaLabel: string;
  /** Default button variant */
  variant?: ButtonVariant;
}

export interface ButtonConfig {
  /** Action type from BUTTON_ACTIONS */
  action: string;
  /** UI context for sizing */
  context?: UIContext;
  /** Data attribute value (e.g., row ID) */
  dataId?: string | number;
  /** Additional data attributes */
  dataAttrs?: Record<string, string | number | boolean>;
  /** Custom title override */
  title?: string;
  /** Custom aria-label override */
  ariaLabel?: string;
  /** Additional CSS class */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Condition to show button (default: true) */
  show?: boolean;
  /** Button variant override */
  variant?: ButtonVariant;
}

export interface ButtonGroupConfig {
  /** UI context for sizing and layout */
  context: UIContext;
  /** Button configurations */
  buttons: ButtonConfig[];
  /** Custom wrapper class */
  wrapperClass?: string;
}

// ============================================
// BADGE TYPES
// ============================================

export type BadgeVariant =
  | 'active'
  | 'pending'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'healthy'
  | 'at-risk'
  | 'critical'
  | 'signed'
  | 'not-signed'
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | string;

export interface BadgeConfig {
  /** Status value */
  status: string;
  /** Custom label (overrides auto-formatted label) */
  label?: string;
  /** Display in uppercase */
  uppercase?: boolean;
  /** Additional CSS class */
  className?: string;
}

export interface DotConfig extends BadgeConfig {
  /** Use dot indicator style instead of badge */
  useDot?: boolean;
}

// ============================================
// STATE TYPES
// ============================================

export interface EmptyStateConfig {
  /** Message to display */
  message: string;
  /** Additional CSS class */
  className?: string;
  /** CTA button label */
  ctaLabel?: string;
  /** CTA button callback */
  ctaOnClick?: () => void;
  /** ARIA role (default: 'status') */
  role?: string;
}

export interface LoadingStateConfig {
  /** Message to display */
  message?: string;
  /** Additional CSS class */
  className?: string;
  /** Use skeleton loader instead of spinner */
  skeleton?: boolean;
  /** Number of skeleton items */
  skeletonCount?: number;
  /** Skeleton type */
  skeletonType?: 'list' | 'cards' | 'table';
  /** Aria label */
  ariaLabel?: string;
}

export interface ErrorStateConfig {
  /** Error message to display */
  message: string;
  /** Additional CSS class */
  className?: string;
  /** Retry button label */
  retryLabel?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Secondary action label */
  secondaryLabel?: string;
  /** Secondary action callback */
  onSecondary?: () => void;
  /** Error type for styling */
  type?: 'general' | 'network' | 'permission' | 'notfound';
}
