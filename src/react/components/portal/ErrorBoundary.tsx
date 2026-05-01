/**
 * Error Boundary Component for Portal/Admin React Islands
 * Catches render errors and displays a fallback UI instead of crashing
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Optional fallback component to render on error */
  fallback?: React.ReactNode;
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Component name for error context */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Catches React render errors in child components
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary componentName="FilesManager">
 *   <FilesManager />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <AlertTriangle className="error-boundary-icon" />
            <h3 className="error-boundary-title">Something went wrong</h3>
            <p className="error-boundary-message">
              {this.props.componentName
                ? `The ${this.props.componentName} component encountered an error.`
                : 'This component encountered an error.'}
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre className="error-boundary-details">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              className="error-boundary-retry"
              onClick={this.handleRetry}
            >
              <RefreshCw className="error-boundary-retry-icon" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
