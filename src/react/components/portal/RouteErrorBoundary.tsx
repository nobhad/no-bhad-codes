/**
 * ===============================================
 * ROUTE ERROR BOUNDARY
 * ===============================================
 * @file src/react/components/portal/RouteErrorBoundary.tsx
 *
 * Route-aware error boundary that wraps the Outlet in PortalLayout.
 * Automatically resets error state when the user navigates to a
 * different route, so a crash in one tab does not block other tabs.
 *
 * Uses the existing ErrorBoundary internally for consistent UI,
 * and adds a navigation-aware reset via useLocation().
 */

import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// LOCATION-AWARE RESET WRAPPER
// ============================================

/**
 * Functional wrapper that resets the class-based error boundary
 * whenever the route location changes. This means navigating
 * away from a crashed tab automatically clears the error.
 */
export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  const location = useLocation();

  // Use location.pathname as the key so the boundary remounts
  // (and resets its error state) on every route change.
  return (
    <RouteErrorBoundaryInner key={location.pathname}>
      {children}
    </RouteErrorBoundaryInner>
  );
}

// ============================================
// CLASS-BASED ERROR BOUNDARY
// ============================================

class RouteErrorBoundaryInner extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[RouteErrorBoundary] Caught error:', error);
      console.error('[RouteErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// FALLBACK UI
// ============================================

interface RouteErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

/**
 * User-friendly error fallback displayed inside the content area.
 * The layout/sidebar remain fully functional.
 */
function RouteErrorFallback({ error, onRetry }: RouteErrorFallbackProps) {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="error-boundary-fallback">
      <div className="error-boundary-content">
        <AlertTriangle className="error-boundary-icon" />
        <h3 className="error-boundary-title">Something went wrong</h3>
        <p className="error-boundary-message">
          This page encountered an unexpected error. You can try again or navigate to another section.
        </p>
        {process.env.NODE_ENV !== 'production' && error && (
          <pre className="error-boundary-details">
            {error.message}
          </pre>
        )}
        <div className="error-boundary-actions">
          <button
            type="button"
            className="error-boundary-retry"
            onClick={onRetry}
          >
            <RefreshCw className="error-boundary-retry-icon" />
            Try Again
          </button>
          <button
            type="button"
            className="error-boundary-retry"
            onClick={handleGoBack}
          >
            <ArrowLeft className="error-boundary-retry-icon" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
