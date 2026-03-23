/**
 * ===============================================
 * RETAINERS TABLE
 * ===============================================
 * @file src/react/features/admin/retainers/RetainersTable.tsx
 *
 * Admin table for managing retainer agreements.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Plus, Pause, Play, XCircle, Loader2 } from 'lucide-react';
import { usePortalData, usePortalFetch } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { formatCurrency } from '@/utils/format-utils';
import { getUtilizationColor } from '@react/utils/utilization';

// ============================================================================
// TYPES
// ============================================================================

interface Retainer {
  id: number;
  clientName: string;
  projectName: string;
  retainerType: string;
  status: string;
  monthlyAmount: number;
  monthlyHours: number | null;
  billingDay: number;
  currentPeriod?: {
    usedHours: number;
    totalAvailable: number | null;
  } | null;
}

interface RetainersTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--status-success)',
  paused: 'var(--status-warning)',
  cancelled: 'var(--status-danger)',
  expired: 'var(--color-text-tertiary)'
};

const UTILIZATION_BAR_HEIGHT = 6;
const UTILIZATION_BAR_RADIUS = 3;
const UTILIZATION_MIN_WIDTH = 120;

// ============================================================================
// COMPONENT
// ============================================================================

export function RetainersTable({
  getAuthToken,
  showNotification
}: RetainersTableProps) {
  const { data, isLoading, error, refetch } = usePortalData<{ retainers: Retainer[] }>({
    getAuthToken,
    url: API_ENDPOINTS.RETAINERS,
    transform: (raw) => raw as { retainers: Retainer[] }
  });

  const { portalFetch } = usePortalFetch({ getAuthToken });
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const retainers = data?.retainers || [];

  const handleAction = useCallback(async (id: number, action: string) => {
    setActionLoading(id);
    try {
      await portalFetch(`${API_ENDPOINTS.RETAINERS}/${id}/${action}`, { method: 'POST' });
      showNotification?.(`Retainer ${action}d`, 'success');
      refetch();
    } catch {
      showNotification?.(`Failed to ${action} retainer`, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [portalFetch, showNotification, refetch]);

  if (isLoading) {
    return (
      <div className="portal-card text-center" style={{ padding: 'var(--spacing-6)' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
        <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>Loading retainers...</p>
      </div>
    );
  }

  if (error) {
    return <div className="portal-card"><p className="form-error-message">{error}</p></div>;
  }

  return (
    <div className="subsection">
      <div className="data-table-header">
        <h2 style={{ margin: 0 }}>Retainers</h2>
        <button
          className="btn-primary"
          onClick={() => showNotification?.('Create retainer from the project detail page', 'info')}
        >
          <Plus size={16} /> New Retainer
        </button>
      </div>

      {retainers.length === 0 ? (
        <div className="portal-card text-center" style={{ padding: 'var(--space-4)' }}>
          <p className="text-muted">No retainers yet</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Type</th>
                <th>Monthly</th>
                <th>Status</th>
                <th>Utilization</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {retainers.map((r) => {
                const utilPercent = r.currentPeriod?.totalAvailable
                  ? (r.currentPeriod.usedHours / r.currentPeriod.totalAvailable)
                  : 0;

                return (
                  <tr key={r.id}>
                    <td>{r.clientName}</td>
                    <td>{r.projectName}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.retainerType.replace('_', ' ')}</td>
                    <td className="font-medium">{formatCurrency(r.monthlyAmount, { showCents: true })}</td>
                    <td>
                      <span style={{
                        color: STATUS_COLORS[r.status] || 'var(--app-color-text-muted)',
                        textTransform: 'capitalize'
                      }} className="font-medium">
                        {r.status}
                      </span>
                    </td>
                    <td style={{ minWidth: UTILIZATION_MIN_WIDTH }}>
                      {r.currentPeriod?.totalAvailable ? (
                        <div>
                          <div style={{
                            height: UTILIZATION_BAR_HEIGHT,
                            borderRadius: UTILIZATION_BAR_RADIUS,
                            backgroundColor: 'var(--app-color-border)',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(utilPercent * 100, 100)}%`,
                              backgroundColor: getUtilizationColor(utilPercent),
                              borderRadius: UTILIZATION_BAR_RADIUS
                            }} />
                          </div>
                          <span className="text-muted text-xs">
                            {r.currentPeriod.usedHours}h / {r.currentPeriod.totalAvailable}h
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                    <td>
                      <div className="action-group">
                        {r.status === 'active' && (
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => handleAction(r.id, 'pause')}
                            disabled={actionLoading === r.id}
                          >
                            <Pause size={12} />
                          </button>
                        )}
                        {r.status === 'paused' && (
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => handleAction(r.id, 'resume')}
                            disabled={actionLoading === r.id}
                          >
                            <Play size={12} />
                          </button>
                        )}
                        {['active', 'paused'].includes(r.status) && (
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => handleAction(r.id, 'cancel')}
                            disabled={actionLoading === r.id}
                          >
                            <XCircle size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
