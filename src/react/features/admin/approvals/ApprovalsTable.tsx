/**
 * ApprovalsTable
 * Client-facing panel showing pending approvals (ad-hoc requests, document requests, etc.)
 * Fetches from API_ENDPOINTS.APPROVALS_PENDING
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { formatDate } from '@react/utils/formatDate';
import { useListFetch } from '@react/factories/useDataFetch';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

const logger = createLogger('ApprovalsTable');

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

export interface ApprovalsTableProps {
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

export function ApprovalsTable({ getAuthToken, showNotification }: ApprovalsTableProps) {
  const containerRef = useFadeIn();

  const { data, isLoading, error, refetch, setData } = useListFetch<ApprovalItem>({
    endpoint: API_ENDPOINTS.APPROVALS_PENDING,
    getAuthToken,
    itemsKey: 'approvals'
  });
  const approvals = useMemo(() => data?.items ?? [], [data]);

  // Auth headers helper (kept for mutation calls)
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

  async function handleRespond(approvalId: number, action: 'approve' | 'decline') {
    try {
      const response = await fetch(buildEndpoint.approvalRespond(approvalId), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error(`Failed to ${action} request`);

      setData((prev) => prev ? { ...prev, items: prev.items.filter((a) => a.id !== approvalId) } : prev);
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
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      <div className="perf-header">
        <h2 className="heading perf-heading">Pending Approvals</h2>
        <button className="btn btn-secondary" onClick={refetch}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          message="You have no items awaiting your approval."
        />
      ) : (
        <div className="panel">
          <div className="analytics-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-header">Type</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Requester</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((item) => (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell">{item.type}</td>
                    <td className="table-cell">{item.title}</td>
                    <td className="table-cell">{item.requester}</td>
                    <td className="table-cell">{formatDate(item.date)}</td>
                    <td className="table-cell">
                      <span className={STATUS_CLASS_MAP[item.status] || 'status-badge'}>
                        {item.status}
                      </span>
                    </td>
                    <td className="table-cell">
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

export default ApprovalsTable;
