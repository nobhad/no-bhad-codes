/**
 * PortalViewLayout
 * Shared wrapper for all portal React views.
 * Provides consistent container, fade-in animation, and loading/error handling.
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState, ErrorState } from './EmptyState';

// ============================================
// TYPES
// ============================================

export interface PortalViewLayoutProps {
  /** View content */
  children: React.ReactNode;
  /** Show loading spinner instead of content */
  isLoading?: boolean;
  /** Error message to display instead of content */
  error?: string | null;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Loading message override */
  loadingMessage?: string;
  /** Additional className on the outer container */
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

/**
 * PortalViewLayout — standard wrapper for all portal views.
 *
 * Handles:
 * - `portal-main-container` div with GSAP fade-in
 * - Centralized loading state via LoadingState
 * - Centralized error state via ErrorState with retry
 *
 * @example
 * <PortalViewLayout isLoading={isLoading} error={error} onRetry={refetch}>
 *   <StatsRow>...</StatsRow>
 *   <PortalTable>...</PortalTable>
 * </PortalViewLayout>
 */
export function PortalViewLayout({
  children,
  isLoading = false,
  error = null,
  onRetry,
  loadingMessage,
  className
}: PortalViewLayoutProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  if (isLoading) {
    return <LoadingState message={loadingMessage} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div ref={containerRef} className={cn('portal-main-container tw-section', className)}>
      {children}
    </div>
  );
}
