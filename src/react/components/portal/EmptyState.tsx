/**
 * EmptyState Components for Portal
 * Re-exports factory components with portal-specific presets
 */

import * as React from 'react';
import { Search, FolderOpen, Inbox } from 'lucide-react';
import {
  EmptyState as FactoryEmptyState,
  ErrorState as FactoryErrorState,
  LoadingState as FactoryLoadingState,
  Skeleton
} from '@react/factories';

// Re-export factory components for convenience
export { FactoryEmptyState as EmptyState };
export { FactoryErrorState as ErrorState };
export { FactoryLoadingState as LoadingState };
export { Skeleton };

// Also export the base EmptyStateProps for consumers
export interface EmptyStateProps {
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
 * Preset empty states for common portal scenarios
 */
export function EmptyStateNoResults({
  searchQuery,
  onClear,
  className
}: {
  searchQuery?: string;
  onClear?: () => void;
  className?: string;
}) {
  const message = searchQuery
    ? `No results found for "${searchQuery}". Try adjusting your search or filters.`
    : 'No results found. Try adjusting your search or filters.';

  return (
    <FactoryEmptyState
      icon={<Search className="icon-lg" />}
      message={message}
      ctaLabel={onClear ? 'Clear filters' : undefined}
      onCtaClick={onClear}
      className={className}
    />
  );
}

export function EmptyStateNoFiles({
  onUpload,
  className
}: {
  onUpload?: () => void;
  className?: string;
}) {
  return (
    <FactoryEmptyState
      icon={<FolderOpen className="icon-lg" />}
      message="No files yet. Upload files to get started."
      ctaLabel={onUpload ? 'Upload files' : undefined}
      onCtaClick={onUpload}
      className={className}
    />
  );
}

export function EmptyStateNoData({
  entityName = 'items',
  className
}: {
  entityName?: string;
  className?: string;
}) {
  return (
    <FactoryEmptyState
      icon={<Inbox className="icon-lg" />}
      message={`No ${entityName} to display at this time.`}
      className={className}
    />
  );
}

export function EmptyStateError({
  error,
  onRetry,
  className
}: {
  error?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <FactoryErrorState
      message={error || 'An error occurred while loading the data.'}
      type="general"
      retryLabel="Try again"
      onRetry={onRetry}
      className={className}
    />
  );
}
