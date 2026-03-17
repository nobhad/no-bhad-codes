/**
 * ===============================================
 * AUTOMATION DETAIL PANEL
 * ===============================================
 * @file src/react/features/admin/automations/AutomationDetailPanel.tsx
 *
 * Detail view for a single automation. Shows overview info,
 * action summary, status toggle, recent run history, and
 * buttons to edit, run now, or delete.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Zap,
  Play,
  Pencil,
  Trash2,
  RefreshCw,
  Power,
  PowerOff,
  Inbox,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { formatDate } from '@react/utils/formatDate';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalFetch } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';
import type { Automation, AutomationRun } from './types';
import {
  ACTION_TYPE_LABELS,
  TRIGGER_EVENT_GROUPS
} from './types';
import { AutomationBuilder } from './AutomationBuilder';

const logger = createLogger('AutomationDetailPanel');

// ============================================================================
// CONSTANTS
// ============================================================================

const RECENT_RUNS_LIMIT = 20;

const RUN_STATUS_CONFIG: Record<string, { label: string; variant: string; icon: React.ComponentType<{ className?: string }> }> = {
  running: { label: 'Running', variant: 'active', icon: RefreshCw },
  completed: { label: 'Completed', variant: 'completed', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'cancelled', icon: XCircle },
  cancelled: { label: 'Cancelled', variant: 'pending', icon: AlertCircle }
};

/** Flat lookup for trigger event labels */
const TRIGGER_EVENT_LABELS: Record<string, string> = TRIGGER_EVENT_GROUPS.reduce(
  (acc, group) => {
    group.events.forEach((evt) => {
      acc[evt.value] = evt.label;
    });
    return acc;
  },
  {} as Record<string, string>
);

// ============================================================================
// PROPS
// ============================================================================

export interface AutomationDetailPanelProps {
  automationId: number;
  onBack: () => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AutomationDetailPanel({
  automationId,
  onBack,
  onNavigate: _onNavigate,
  getAuthToken,
  showNotification
}: AutomationDetailPanelProps) {
  const containerRef = useFadeIn();
  const { portalFetch } = usePortalFetch({ getAuthToken });

  // ---- State ----
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // ---- Data loading ----

  const loadAutomation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await portalFetch<Automation>(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}`
      );
      setAutomation(data);
    } catch (err) {
      logger.error('Error loading automation:', err);
      setError(formatErrorMessage(err, 'Failed to load automation'));
    } finally {
      setIsLoading(false);
    }
  }, [automationId, portalFetch]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const data = await portalFetch<AutomationRun[]>(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}/runs?limit=${RECENT_RUNS_LIMIT}`
      );
      setRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('Error loading automation runs:', err);
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [automationId, portalFetch]);

  useEffect(() => {
    loadAutomation();
    loadRuns();
  }, [loadAutomation, loadRuns]);

  // ---- Actions ----

  const handleToggleActive = useCallback(async () => {
    if (!automation) return;
    const endpoint = automation.isActive ? 'deactivate' : 'activate';
    setIsToggling(true);
    try {
      await portalFetch(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}/${endpoint}`,
        { method: 'PUT' }
      );
      showNotification?.(
        `Automation ${automation.isActive ? 'deactivated' : 'activated'}`,
        'success'
      );
      await loadAutomation();
    } catch (err) {
      logger.error('Error toggling automation status:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to update automation'),
        'error'
      );
    } finally {
      setIsToggling(false);
    }
  }, [automation, automationId, portalFetch, showNotification, loadAutomation]);

  const handleRunNow = useCallback(async () => {
    setIsRunning(true);
    try {
      await portalFetch(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}/run`,
        { method: 'POST' }
      );
      showNotification?.('Automation triggered', 'success');
      await loadRuns();
    } catch (err) {
      logger.error('Error triggering automation:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to trigger automation'),
        'error'
      );
    } finally {
      setIsRunning(false);
    }
  }, [automationId, portalFetch, showNotification, loadRuns]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this automation? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await portalFetch(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}`,
        { method: 'DELETE' }
      );
      showNotification?.('Automation deleted', 'success');
      onBack();
    } catch (err) {
      logger.error('Error deleting automation:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to delete automation'),
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  }, [automationId, portalFetch, showNotification, onBack]);

  const handleBuilderSave = useCallback(() => {
    setShowBuilder(false);
    loadAutomation();
  }, [loadAutomation]);

  // ---- Derived data ----

  const triggerLabel = useMemo(() => {
    if (!automation) return '';
    return TRIGGER_EVENT_LABELS[automation.triggerEvent] || automation.triggerEvent;
  }, [automation]);

  // ---- Builder mode ----
  if (showBuilder) {
    return (
      <AutomationBuilder
        automationId={automationId}
        onSave={handleBuilderSave}
        onCancel={() => setShowBuilder(false)}
        getAuthToken={getAuthToken}
        showNotification={showNotification}
      />
    );
  }

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div
        className="portal-card"
        style={{ padding: 'var(--spacing-6)', textAlign: 'center' }}
      >
        <RefreshCw
          className="icon-md loading-spin"
          style={{ color: 'var(--app-color-text-muted)', marginBottom: 'var(--spacing-2)' }}
        />
        <p className="text-muted">Loading automation...</p>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !automation) {
    return (
      <div className="portal-card" style={{ padding: 'var(--spacing-6)' }}>
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="icon-md" style={{ color: 'var(--app-color-danger)' }} />
          <p>{error || 'Automation not found'}</p>
          <button type="button" className="btn-secondary" onClick={onBack}>
            <ArrowLeft className="icon-xs" /> Back
          </button>
        </div>
      </div>
    );
  }

  // ---- Main render ----

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={onBack}
            title="Back to list"
            style={{ padding: '4px 8px' }}
          >
            <ArrowLeft className="icon-xs" />
          </button>
          <Zap className="icon-sm" style={{ color: 'var(--app-color-primary)' }} />
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>
              {automation.name}
            </h2>
            {automation.description && (
              <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                {automation.description}
              </p>
            )}
          </div>
        </div>
        <div className="action-group">
          <button
            type="button"
            className="btn-secondary flex items-center gap-1"
            onClick={() => setShowBuilder(true)}
            title="Edit automation"
          >
            <Pencil className="icon-xs" />
            Edit
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1"
            onClick={handleRunNow}
            disabled={isRunning}
            title="Run this automation now"
          >
            {isRunning ? (
              <RefreshCw className="icon-xs loading-spin" />
            ) : (
              <Play className="icon-xs" />
            )}
            Run Now
          </button>
          <button
            type="button"
            className="btn-danger flex items-center gap-1"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete automation"
          >
            {isDeleting ? (
              <RefreshCw className="icon-xs loading-spin" />
            ) : (
              <Trash2 className="icon-xs" />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="portal-card">
        <div className="portal-card-header">
          <span className="cell-title">Overview</span>
          <div className="action-group">
            <StatusBadge
              status={automation.isActive ? 'completed' : 'pending'}
              size="sm"
            >
              {automation.isActive ? 'Active' : 'Inactive'}
            </StatusBadge>
            <button
              type="button"
              className="btn-secondary flex items-center gap-1"
              onClick={handleToggleActive}
              disabled={isToggling}
              title={automation.isActive ? 'Deactivate' : 'Activate'}
              style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
            >
              {isToggling ? (
                <RefreshCw className="icon-xs loading-spin" />
              ) : automation.isActive ? (
                <PowerOff className="icon-xs" />
              ) : (
                <Power className="icon-xs" />
              )}
              {automation.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="flex flex-col gap-3">
            {/* Trigger */}
            <div className="flex flex-col gap-1">
              <span className="field-label">Trigger Event</span>
              <span>{triggerLabel}</span>
            </div>

            {/* Conditions */}
            {automation.triggerConditions && automation.triggerConditions.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="field-label">Conditions</span>
                {automation.triggerConditions.map((cond, idx) => (
                  <span key={idx} className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {(cond.field as string)} {(cond.operator as string)} {String(cond.value)}
                  </span>
                ))}
              </div>
            )}

            {/* Actions summary */}
            <div className="flex flex-col gap-1">
              <span className="field-label">
                Actions ({automation.actions.length})
              </span>
              {automation.actions.length === 0 ? (
                <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  No actions configured
                </span>
              ) : (
                <div className="flex flex-col gap-1">
                  {automation.actions
                    .sort((a, b) => a.actionOrder - b.actionOrder)
                    .map((action, idx) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-2"
                        style={{ fontSize: 'var(--font-size-sm)' }}
                      >
                        <span
                          className="text-muted"
                          style={{ fontWeight: 600, minWidth: '20px' }}
                        >
                          {idx + 1}.
                        </span>
                        <span>{ACTION_TYPE_LABELS[action.actionType] || action.actionType}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="flex gap-6">
              <div className="flex flex-col gap-1">
                <span className="field-label">Total Runs</span>
                <span>{automation.runCount}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="field-label">Last Run</span>
                <span>{automation.lastRunAt ? formatDate(automation.lastRunAt) : 'Never'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="field-label">Created</span>
                <span>{formatDate(automation.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="portal-card">
        <div className="portal-card-header">
          <span className="cell-title">Recent Runs</span>
          <button
            type="button"
            className="btn-secondary flex items-center gap-1"
            onClick={loadRuns}
            disabled={runsLoading}
            style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
          >
            <RefreshCw className={`icon-xs${runsLoading ? ' loading-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="card-body">
          {runsLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
              <RefreshCw
                className="icon-sm loading-spin"
                style={{ color: 'var(--app-color-text-muted)' }}
              />
            </div>
          ) : runs.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2"
              style={{ padding: 'var(--spacing-4)', color: 'var(--app-color-text-muted)' }}
            >
              <Inbox className="icon-md" />
              <p className="text-muted">No runs yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Table header */}
              <div
                className="flex items-center gap-3"
                style={{
                  padding: 'var(--spacing-1) var(--spacing-2)',
                  borderBottom: '1px solid var(--app-color-border)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--app-color-text-muted)',
                  textTransform: 'uppercase'
                }}
              >
                <span style={{ flex: 1 }}>Status</span>
                <span style={{ flex: 2 }}>Trigger Entity</span>
                <span style={{ flex: 2 }}>Started</span>
                <span style={{ flex: 2 }}>Completed</span>
              </div>

              {/* Rows */}
              {runs.map((run) => {
                const statusInfo = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.cancelled;
                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-3"
                    style={{
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      borderBottom: '1px solid var(--app-color-border)',
                      fontSize: 'var(--font-size-sm)'
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      <StatusBadge
                        status={statusInfo.variant as 'completed' | 'pending' | 'active' | 'cancelled'}
                        size="sm"
                      >
                        {statusInfo.label}
                      </StatusBadge>
                    </span>
                    <span style={{ flex: 2 }} className="text-muted">
                      {run.triggerEntityType} #{run.triggerEntityId}
                    </span>
                    <span style={{ flex: 2 }}>
                      <div className="flex items-center gap-1">
                        <Clock
                          className="icon-xs"
                          style={{ color: 'var(--app-color-text-muted)' }}
                        />
                        {formatDate(run.startedAt)}
                      </div>
                    </span>
                    <span style={{ flex: 2 }}>
                      {run.completedAt ? formatDate(run.completedAt) : (
                        <span className="text-muted">In progress</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
