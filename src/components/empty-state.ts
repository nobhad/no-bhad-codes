/**
 * ===============================================
 * EMPTY STATE (REUSABLE)
 * ===============================================
 * @file src/components/empty-state.ts
 *
 * Renders "no data" / "loading" / empty list message. Use in admin and client
 * portal so empty states look and behave the same.
 *
 * NOTE: This module now uses the factory system internally.
 * For new code, consider importing directly from @/factories.
 */

import {
  createEmptyState as factoryCreateEmptyState,
  createLoadingState as factoryCreateLoadingState,
  createErrorState as factoryCreateErrorState,
  renderEmptyStateInto,
  renderLoadingStateInto,
  renderErrorStateInto,
  renderSkeleton
} from '../factories';

export interface EmptyStateOptions {
  /** Optional class in addition to .empty-state */
  className?: string;
  /** Optional CTA label (renders a button) */
  ctaLabel?: string;
  /** Optional CTA callback (use with ctaLabel) */
  ctaOnClick?: () => void;
  /** Optional role (default "status" for live region) */
  role?: string;
}

export interface LoadingStateOptions {
  /** Optional class in addition to .loading-state */
  className?: string;
  /** Use skeleton loader instead of spinner */
  skeleton?: boolean;
  /** Number of skeleton items (default: 3) */
  skeletonCount?: number;
  /** Skeleton type: 'list', 'cards', 'table' */
  skeletonType?: 'list' | 'cards' | 'table';
  /** Optional aria-label for the loading indicator */
  ariaLabel?: string;
}

export interface ErrorStateOptions {
  /** Optional class in addition to .error-state */
  className?: string;
  /** Retry button label (default: "Try Again") */
  retryLabel?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Optional secondary action label */
  secondaryLabel?: string;
  /** Optional secondary action callback */
  onSecondary?: () => void;
  /** Error type for styling (default: 'general') */
  type?: 'general' | 'network' | 'permission' | 'notfound';
}

/**
 * Create an empty-state element (e.g. "No files yet", "Loading...").
 * Apply shared styles via class .empty-state (see portal/project-detail CSS).
 */
export function createEmptyState(message: string, options: EmptyStateOptions = {}): HTMLElement {
  return factoryCreateEmptyState(message, {
    className: options.className,
    ctaLabel: options.ctaLabel,
    ctaOnClick: options.ctaOnClick,
    role: options.role
  });
}

/**
 * Render empty state into a container (replaces content).
 */
export function renderEmptyState(
  container: HTMLElement,
  message: string,
  options: EmptyStateOptions = {}
): void {
  renderEmptyStateInto(container, message, options);
}

/**
 * Create a loading state element with spinner or skeleton loader.
 * Apply shared styles via class .loading-state.
 */
export function createLoadingState(
  message: string = 'Loading...',
  options: LoadingStateOptions = {}
): HTMLElement {
  return factoryCreateLoadingState(message, {
    className: options.className,
    skeleton: options.skeleton,
    skeletonCount: options.skeletonCount,
    skeletonType: options.skeletonType,
    ariaLabel: options.ariaLabel
  });
}

/**
 * Render loading state into a container (replaces content).
 */
export function renderLoadingState(
  container: HTMLElement,
  message: string = 'Loading...',
  options: LoadingStateOptions = {}
): void {
  renderLoadingStateInto(container, message, options);
}

/**
 * Create an error state element with optional retry button.
 */
export function createErrorState(message: string, options: ErrorStateOptions = {}): HTMLElement {
  return factoryCreateErrorState(message, {
    className: options.className,
    retryLabel: options.retryLabel,
    onRetry: options.onRetry,
    secondaryLabel: options.secondaryLabel,
    onSecondary: options.onSecondary,
    type: options.type
  });
}

/**
 * Render error state into a container (replaces content).
 */
export function renderErrorState(
  container: HTMLElement,
  message: string,
  options: ErrorStateOptions = {}
): void {
  renderErrorStateInto(container, message, options);
}

// Re-export skeleton helper
export { renderSkeleton };
