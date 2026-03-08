/**
 * ===============================================
 * STATE DISPLAY (REACT FACTORY)
 * ===============================================
 * @file src/react/factories/StateDisplay.tsx
 *
 * React components for displaying empty, loading, and error states.
 * Uses the factory system for consistent styling.
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';
import { AlertTriangle, WifiOff, Lock, SearchX } from 'lucide-react';

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface EmptyStateProps {
  /** Message to display */
  message: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** CTA button label */
  ctaLabel?: string;
  /** CTA button click handler */
  onCtaClick?: () => void;
  /** Additional className */
  className?: string;
  /** Children for custom content */
  children?: React.ReactNode;
}

/**
 * EmptyState - Display when there's no data.
 *
 * @example
 * <EmptyState
 *   message="No clients found"
 *   icon={<Inbox />}
 *   ctaLabel="Add Client"
 *   onCtaClick={() => openModal()}
 * />
 */
export function EmptyState({
  message,
  icon,
  ctaLabel,
  onCtaClick,
  className,
  children
}: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)} role="status" aria-live="polite">
      {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
      <p>{message}</p>
      {children}
      {ctaLabel && onCtaClick && (
        <button
          type="button"
          className="btn btn-secondary empty-state-cta"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ============================================
// LOADING STATE COMPONENT
// ============================================

interface LoadingStateProps {
  /** Message to display */
  message?: string;
  /** Use skeleton loader instead of spinner */
  skeleton?: boolean;
  /** Number of skeleton items */
  skeletonCount?: number;
  /** Skeleton type */
  skeletonType?: 'list' | 'cards' | 'table';
  /** Additional className */
  className?: string;
}

/**
 * LoadingState - Display while loading data.
 *
 * @example
 * <LoadingState message="Loading clients..." />
 * <LoadingState skeleton skeletonType="table" skeletonCount={5} />
 */
export function LoadingState({
  message = 'Loading...',
  skeleton = false,
  skeletonCount = 3,
  skeletonType = 'list',
  className
}: LoadingStateProps) {
  if (skeleton) {
    return (
      <div
        className={cn('loading-state loading-state--skeleton', className)}
        role="status"
        aria-live="polite"
        aria-label={message}
      >
        <div className={`skeleton-container skeleton-${skeletonType}`} aria-hidden="true">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonItem key={`skeleton-${i}`} type={skeletonType} />
          ))}
        </div>
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div
      className={cn('loading-state', className)}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className="loading-spinner" aria-hidden="true" />
      <p className="loading-message">{message}</p>
    </div>
  );
}

// Skeleton item helper
function SkeletonItem({ type }: { type: 'list' | 'cards' | 'table' }) {
  switch (type) {
  case 'cards':
    return (
      <div className="skeleton-item">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--text" />
        <div className="skeleton-line skeleton-line--text skeleton-line--short" />
      </div>
    );
  case 'table':
    return (
      <div className="skeleton-item">
        <div className="skeleton-line skeleton-line--full" />
      </div>
    );
  default:
    return (
      <div className="skeleton-item">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--text" />
      </div>
    );
  }
}

// ============================================
// ERROR STATE COMPONENT
// ============================================

interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Error type for icon selection */
  type?: 'general' | 'network' | 'permission' | 'notfound';
  /** Retry button label */
  retryLabel?: string;
  /** Retry button click handler */
  onRetry?: () => void;
  /** Secondary action label */
  secondaryLabel?: string;
  /** Secondary action click handler */
  onSecondary?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * ErrorState - Display when an error occurs.
 *
 * @example
 * <ErrorState
 *   message="Failed to load clients"
 *   type="network"
 *   retryLabel="Try Again"
 *   onRetry={refetch}
 * />
 */
export function ErrorState({
  message,
  type = 'general',
  retryLabel = 'Try Again',
  onRetry,
  secondaryLabel,
  onSecondary,
  className
}: ErrorStateProps) {
  const Icon = getErrorIcon(type);

  return (
    <div className={cn('error-state', `error-state--${type}`, className)} role="alert">
      <div className="error-state-icon" aria-hidden="true">
        <Icon />
      </div>
      <p className="error-state-message">{message}</p>
      {(onRetry || onSecondary) && (
        <div className="error-state-actions">
          {onRetry && (
            <button
              type="button"
              className="btn btn-primary error-state-retry"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              className="btn btn-secondary error-state-secondary"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Error icon helper
function getErrorIcon(type: 'general' | 'network' | 'permission' | 'notfound') {
  switch (type) {
  case 'network':
    return WifiOff;
  case 'permission':
    return Lock;
  case 'notfound':
    return SearchX;
  default:
    return AlertTriangle;
  }
}

// ============================================
// SKELETON LOADER COMPONENT
// ============================================

interface SkeletonProps {
  /** Skeleton type */
  type?: 'list' | 'cards' | 'table';
  /** Number of skeleton items */
  count?: number;
  /** Additional className */
  className?: string;
}

/**
 * Skeleton - Standalone skeleton loader.
 *
 * @example
 * <Skeleton type="table" count={10} />
 */
export function Skeleton({
  type = 'list',
  count = 3,
  className
}: SkeletonProps) {
  return (
    <LoadingState
      skeleton
      skeletonType={type}
      skeletonCount={count}
      className={className}
    />
  );
}
