/**
 * ApprovalsTable
 * Client-facing panel showing pending approvals (ad-hoc requests, document requests, etc.)
 * Fetches from API_ENDPOINTS.APPROVALS_PENDING
 */

import * as React from 'react';
import { useMemo } from 'react';
import { CheckCircle, XCircle, RefreshCw, Inbox } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatDate } from '@react/utils/formatDate';
import { useListFetch } from '@react/factories/useDataFetch';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost } from '@/utils/api-client';

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

  async function handleRespond(approvalId: number, action: 'approve' | 'decline') {
    try {
      const response = await apiPost(buildEndpoint.approvalRespond(approvalId), { action });
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

  const COLUMN_COUNT = 6;

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <div className="perf-header">
        <h2 className="heading perf-heading">Pending Approvals</h2>
        <button className="btn btn-secondary" onClick={refetch}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      <PortalTable className="data-table">
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead>Type</PortalTableHead>
            <PortalTableHead>Title</PortalTableHead>
            <PortalTableHead>Requester</PortalTableHead>
            <PortalTableHead className="date-col">Date</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={COLUMN_COUNT} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={COLUMN_COUNT} rows={5} />
          ) : approvals.length === 0 ? (
            <PortalTableEmpty
              colSpan={COLUMN_COUNT}
              icon={<Inbox />}
              message="You have no items awaiting your approval."
            />
          ) : (
            approvals.map((item) => (
              <PortalTableRow key={item.id}>
                <PortalTableCell>{item.type}</PortalTableCell>
                <PortalTableCell>{item.title}</PortalTableCell>
                <PortalTableCell>{item.requester}</PortalTableCell>
                <PortalTableCell className="date-col">{formatDate(item.date)}</PortalTableCell>
                <PortalTableCell className="status-col">
                  <span className={STATUS_CLASS_MAP[item.status] || 'status-badge'}>
                    {item.status}
                  </span>
                </PortalTableCell>
                <PortalTableCell className="col-actions">
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
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </div>
  );
}

export default ApprovalsTable;
