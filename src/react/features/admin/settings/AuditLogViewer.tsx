import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData } from '@/utils/api-client';

interface AuditEntry {
  id: number;
  user_email: string | null;
  user_type: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  request_method: string | null;
  request_path: string | null;
  created_at: string;
}

interface AuditLogViewerProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  login: 'Logged in',
  login_failed: 'Login failed',
  logout: 'Logged out',
  setting_updated: 'Setting changed',
  setting_deleted: 'Setting removed',
  business_info_updated: 'Business info updated',
  payment_settings_updated: 'Payment settings updated',
  user_created: 'User created',
  user_updated: 'User updated',
  user_deactivated: 'User deactivated',
  user_reactivated: 'User reactivated',
  status_change: 'Status changed',
  upload: 'Uploaded',
  download: 'Downloaded',
  export: 'Exported',
  email_sent: 'Email sent',
  password_reset: 'Password reset'
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

export function AuditLogViewer({ getAuthToken, showNotification: _showNotification }: AuditLogViewerProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [getAuthToken]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entityType', filterEntity);
      if (filterUser) params.set('userEmail', filterUser);

      const response = await fetch(`${API_ENDPOINTS.ADMIN.AUDIT_LOG}?${params}`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load audit log');
      const result = unwrapApiData<{ data: AuditEntry[]; count: number }>(await response.json());
      setEntries(result.data);
      setTotalCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, page, filterAction, filterEntity, filterUser]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleApplyFilters = () => {
    setPage(0);
    loadLogs();
  };

  const handleClearFilters = () => {
    setFilterAction('');
    setFilterEntity('');
    setFilterUser('');
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = filterAction || filterEntity || filterUser;

  return (
    <TableLayout
      containerRef={containerRef as React.Ref<HTMLDivElement>}
      title="AUDIT LOG"
      stats={
        <TableStats items={[
          { value: totalCount, label: 'entries' },
          { value: `Page ${page + 1}/${totalPages}`, label: '' }
        ]} />
      }
      actions={
        <>
          <button
            className={`config-section-tab ${showFilters ? 'is-active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
          >
            <Filter className="icon-sm" />
          </button>
          <IconButton action="refresh" onClick={loadLogs} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {/* Filters bar */}
      {showFilters && (
        <div className="audit-filters">
          <div className="audit-filter-row">
            <div className="audit-filter-field">
              <label className="config-form-label">
                <Search className="icon-sm" />
                <span>Action</span>
              </label>
              <input
                className="form-input"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                placeholder="e.g. create, update, login"
              />
            </div>
            <div className="audit-filter-field">
              <label className="config-form-label">
                <Search className="icon-sm" />
                <span>Entity Type</span>
              </label>
              <input
                className="form-input"
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                placeholder="e.g. client, project"
              />
            </div>
            <div className="audit-filter-field">
              <label className="config-form-label">
                <Search className="icon-sm" />
                <span>User Email</span>
              </label>
              <input
                className="form-input"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="audit-filter-actions">
              <button className="btn-primary" onClick={handleApplyFilters}>Apply</button>
              {hasFilters && (
                <button className="btn-secondary" onClick={handleClearFilters}>Clear</button>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading audit log..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadLogs} />
      ) : entries.length === 0 ? (
        <div className="team-empty">
          <Search className="icon-lg text-muted" />
          <span>{hasFilters ? 'No entries match your filters' : 'No audit log entries found'}</span>
        </div>
      ) : (
        <div className="audit-content">
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th className="audit-th">Time</th>
                  <th className="audit-th">User</th>
                  <th className="audit-th">Action</th>
                  <th className="audit-th">Entity</th>
                  <th className="audit-th">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="audit-tr">
                    <td className="audit-td audit-td-time">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="audit-td audit-td-user">
                      {entry.user_email || 'System'}
                    </td>
                    <td className="audit-td">
                      <span className={`audit-action-badge audit-action-${entry.action.split('_')[0]}`}>
                        {getActionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="audit-td">
                      <span className="audit-entity-type">{entry.entity_type}</span>
                      {entry.entity_name && (
                        <span className="audit-entity-name"> {entry.entity_name}</span>
                      )}
                    </td>
                    <td className="audit-td audit-td-details">
                      {entry.changes ? (
                        <span className="audit-changes-summary">
                          {Object.keys(entry.changes).length} field(s) changed
                        </span>
                      ) : entry.request_method && entry.request_path ? (
                        <span className="audit-request-info">
                          {entry.request_method} {entry.request_path}
                        </span>
                      ) : (
                        <span className="audit-no-details">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="audit-pagination">
              <button
                className="audit-page-btn"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="icon-sm" />
              </button>
              <span className="audit-page-info">
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="audit-page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="icon-sm" />
              </button>
            </div>
          )}
        </div>
      )}
    </TableLayout>
  );
}
