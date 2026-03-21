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

const UTILIZATION_THRESHOLD_WARNING = 0.6;
const UTILIZATION_THRESHOLD_DANGER = 0.8;

function getUtilizationColor(percent: number): string {
  if (percent >= UTILIZATION_THRESHOLD_DANGER) return 'var(--status-danger)';
  if (percent >= UTILIZATION_THRESHOLD_WARNING) return 'var(--status-warning)';
  return 'var(--status-success)';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

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
      <div className="portal-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Loading retainers...</p>
      </div>
    );
  }

  if (error) {
    return <div className="portal-card"><p className="form-error-message">{error}</p></div>;
  }

  return (
    <div className="subsection">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Retainers</h2>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => showNotification?.('Create retainer from the project detail page', 'info')}
        >
          <Plus size={16} /> New Retainer
        </button>
      </div>

      {retainers.length === 0 ? (
        <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="text-muted">No retainers yet</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--app-color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Client</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Project</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Monthly</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Utilization</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {retainers.map((r) => {
                const utilPercent = r.currentPeriod?.totalAvailable
                  ? (r.currentPeriod.usedHours / r.currentPeriod.totalAvailable)
                  : 0;

                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--app-color-border)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{r.clientName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{r.projectName}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{r.retainerType.replace('_', ' ')}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{formatCurrency(r.monthlyAmount)}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={{
                        color: STATUS_COLORS[r.status] || 'var(--app-color-text-muted)',
                        fontWeight: 500,
                        textTransform: 'capitalize'
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', minWidth: 120 }}>
                      {r.currentPeriod?.totalAvailable ? (
                        <div>
                          <div style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'var(--app-color-border)',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(utilPercent * 100, 100)}%`,
                              backgroundColor: getUtilizationColor(utilPercent),
                              borderRadius: 3
                            }} />
                          </div>
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {r.currentPeriod.usedHours}h / {r.currentPeriod.totalAvailable}h
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {r.status === 'active' && (
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleAction(r.id, 'pause')}
                            disabled={actionLoading === r.id}
                          >
                            <Pause size={12} />
                          </button>
                        )}
                        {r.status === 'paused' && (
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleAction(r.id, 'resume')}
                            disabled={actionLoading === r.id}
                          >
                            <Play size={12} />
                          </button>
                        )}
                        {['active', 'paused'].includes(r.status) && (
                          <button
                            className="btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
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
