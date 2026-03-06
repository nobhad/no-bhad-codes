/**
 * ApprovalsPanel
 * Client-facing panel showing pending approvals (ad-hoc requests, document requests, etc.)
 * Fetches from API_ENDPOINTS.APPROVALS_PENDING
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { formatDate } from '@react/utils/formatDate';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('ApprovalsPanel');

// ============================================================================
// TYPES
// ============================================================================

interface ApprovalItem {
  id: number;
  type: string;
  title: string;
  requester: string;
  date: string;
  status: 'pending' | 'approved' | 'declined';
}

export interface ApprovalsPanelProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// STATUS BADGE MAP
// ============================================================================

const STATUS_CLASS_MAP: Record<string, string> = {
  pending: 'status-badge status-badge-warning',
  approved: 'status-badge status-badge-active',
  declined: 'status-badge status-badge-danger'
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ApprovalsPanel({ getAuthToken, showNotification }: ApprovalsPanelProps) {
  const containerRef = useFadeIn();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.APPROVALS_PENDING, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load approvals');
      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setApprovals((payload.approvals as ApprovalItem[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load approvals';
      logger.error('Failed to load approvals:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  async function handleRespond(approvalId: number, action: 'approve' | 'decline') {
    try {
      const response = await fetch(buildEndpoint.approvalRespond(approvalId), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error(`Failed to ${action} request`);

      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      showNotification?.(
        `Request ${action === 'approve' ? 'approved' : 'declined'} successfully`,
        'success'
      );
    } catch (err) {
      logger.error(`Failed to ${action} approval ${approvalId}:`, err);
      showNotification?.(`Failed to ${action} request`, 'error');
    }
  }

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading approvals..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={fetchApprovals} />;
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="tw-section">
      <div className="perf-header">
        <h2 className="heading perf-heading">Pending Approvals</h2>
        <button className="btn btn-secondary" onClick={fetchApprovals}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          message="You have no items awaiting your approval."
        />
      ) : (
        <div className="tw-panel">
          <div className="analytics-table-container">
            <table className="tw-table">
              <thead>
                <tr>
                  <th className="tw-table-header">Type</th>
                  <th className="tw-table-header">Title</th>
                  <th className="tw-table-header">Requester</th>
                  <th className="tw-table-header">Date</th>
                  <th className="tw-table-header">Status</th>
                  <th className="tw-table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((item) => (
                  <tr key={item.id} className="tw-table-row">
                    <td className="tw-table-cell">{item.type}</td>
                    <td className="tw-table-cell">{item.title}</td>
                    <td className="tw-table-cell">{item.requester}</td>
                    <td className="tw-table-cell">{formatDate(item.date)}</td>
                    <td className="tw-table-cell">
                      <span className={STATUS_CLASS_MAP[item.status] || 'status-badge'}>
                        {item.status}
                      </span>
                    </td>
                    <td className="tw-table-cell">
                      {item.status === 'pending' && (
                        <div className="btn-group">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRespond(item.id, 'approve')}
                            aria-label={`Approve ${item.title}`}
                          >
                            <CheckCircle className="btn-icon-left" />
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRespond(item.id, 'decline')}
                            aria-label={`Decline ${item.title}`}
                          >
                            <XCircle className="btn-icon-left" />
                            Decline
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalsPanel;
