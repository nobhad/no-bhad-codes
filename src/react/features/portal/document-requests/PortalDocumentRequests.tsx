/**
 * PortalDocumentRequests
 * Main document requests view for the client portal
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { useFadeIn } from '@react/hooks/useGsap';
import { DocumentRequestCard, type DocumentRequest } from './DocumentRequestCard';

export interface PortalDocumentRequestsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface DocumentRequestSummary {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  rejected: number;
}

interface ApiResponse {
  success?: boolean;
  requests?: DocumentRequest[];
  error?: string;
}

/**
 * Custom hook for fetching document requests
 */
function useDocumentRequests(getAuthToken?: () => string | null) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/document-requests/my-requests', {
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch document requests');
      }

      const data: ApiResponse = await response.json();

      if (data.requests) {
        setRequests(data.requests);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('[useDocumentRequests] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document requests');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    isLoading,
    error,
    refetch: fetchRequests
  };
}

/**
 * Calculate summary statistics from requests
 */
function calculateSummary(requests: DocumentRequest[]): DocumentRequestSummary {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    submitted: requests.filter(r => r.status === 'submitted').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };
}

/**
 * PortalDocumentRequests Component
 */
export function PortalDocumentRequests({
  getAuthToken,
  showNotification
}: PortalDocumentRequestsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const { requests, isLoading, error, refetch } = useDocumentRequests(getAuthToken);
  const summary = calculateSummary(requests);

  // Handle upload success
  const handleUploadSuccess = useCallback((requestId: number) => {
    // Refetch to get updated status
    refetch();
  }, [refetch]);

  // Loading state
  if (isLoading) {
    return (
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading document requests...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  // Separate requests by action needed
  const actionNeeded = requests.filter(r => r.status === 'pending' || r.status === 'rejected');
  const inReview = requests.filter(r => r.status === 'submitted');
  const completed = requests.filter(r => r.status === 'approved');

  return (
    <div ref={containerRef} className="tw-section">
      {/* Summary Cards */}
      <div className="tw-grid-stats">
        <div className="tw-stat-card">
          <span className="tw-stat-label">Total</span>
          <span className="tw-stat-value">{summary.total}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Pending</span>
          <span className="tw-stat-value">{summary.pending + summary.rejected}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">In Review</span>
          <span className="tw-stat-value">{summary.submitted}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Approved</span>
          <span className="tw-stat-value">{summary.approved}</span>
        </div>
      </div>

      {/* Empty State */}
      {requests.length === 0 && (
        <div className="tw-empty-state">
          <FileText className="tw-h-8 tw-w-8" />
          <p>No document requests yet.</p>
          <p className="tw-text-xs">Requests will appear here when your project team needs documents from you.</p>
        </div>
      )}

      {/* Action Needed Section */}
      {actionNeeded.length > 0 && (
        <div>
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
            <h2 className="tw-section-title">Action Needed</h2>
            <span className="tw-badge">{actionNeeded.length}</span>
          </div>
          <div className="tw-section">
            {actionNeeded.map(request => (
              <DocumentRequestCard
                key={request.id}
                request={request}
                onUploadSuccess={handleUploadSuccess}
                getAuthToken={getAuthToken}
                showNotification={showNotification}
              />
            ))}
          </div>
        </div>
      )}

      {/* In Review Section */}
      {inReview.length > 0 && (
        <div>
          <h2 className="tw-section-title tw-mb-2">In Review</h2>
          <div className="tw-section">
            {inReview.map(request => (
              <DocumentRequestCard
                key={request.id}
                request={request}
                onUploadSuccess={handleUploadSuccess}
                getAuthToken={getAuthToken}
                showNotification={showNotification}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {completed.length > 0 && (
        <div>
          <h2 className="tw-section-title tw-mb-2">Completed</h2>
          <div className="tw-section">
            {completed.map(request => (
              <DocumentRequestCard
                key={request.id}
                request={request}
                onUploadSuccess={handleUploadSuccess}
                getAuthToken={getAuthToken}
                showNotification={showNotification}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
