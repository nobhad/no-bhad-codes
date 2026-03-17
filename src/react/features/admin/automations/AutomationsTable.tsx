/**
 * ===============================================
 * AUTOMATIONS TABLE
 * ===============================================
 * @file src/react/features/admin/automations/AutomationsTable.tsx
 *
 * Admin table listing all automations with inline create form,
 * active/inactive toggle, and row-click navigation to detail view.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Zap,
  Inbox,
  Plus,
  RefreshCw,
  Power,
  PowerOff,
  Trash2
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter } from '@react/components/portal/TableFilters';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { formatDate } from '@react/utils/formatDate';
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
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalData } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';
import type { Automation } from './types';
import {
  TRIGGER_EVENT_GROUPS,
  ACTION_TYPE_LABELS
} from './types';

const logger = createLogger('AutomationsTable');

// ============================================================================
// CONSTANTS
// ============================================================================

const TABLE_COL_COUNT = 6;

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

export interface AutomationsTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AutomationsTable({
  getAuthToken,
  showNotification,
  onNavigate
}: AutomationsTableProps) {
  const containerRef = useFadeIn();

  // ---- Data fetch ----
  const {
    data: automations,
    isLoading,
    error,
    refetch,
    portalFetch
  } = usePortalData<Automation[]>({
    getAuthToken,
    url: `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations`,
    transform: (raw) =>
      (raw as Record<string, unknown>).automations as Automation[] || []
  });

  const items = useMemo(() => automations ?? [], [automations]);

  // ---- Search ----
  const [search, setSearch] = useState('');
  const filteredItems = useMemo(() => {
    if (!search) return items;
    const query = search.toLowerCase();
    return items.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.triggerEvent.toLowerCase().includes(query) ||
        (a.description && a.description.toLowerCase().includes(query))
    );
  }, [items, search]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((a) => a.isActive).length;
    const totalRuns = items.reduce((sum, a) => sum + a.runCount, 0);
    return { total, active, totalRuns };
  }, [items]);

  // ---- Create form state ----
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTrigger, setCreateTrigger] = useState<string>(
    TRIGGER_EVENT_GROUPS[0].events[0].value
  );
  const [createDescription, setCreateDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ---- Deleting state ----
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ---- Handlers ----

  const handleToggleActive = useCallback(async (automation: Automation) => {
    const endpoint = automation.isActive ? 'deactivate' : 'activate';
    try {
      await portalFetch(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automation.id}/${endpoint}`,
        { method: 'PUT' }
      );
      showNotification?.(
        `Automation ${automation.isActive ? 'deactivated' : 'activated'}`,
        'success'
      );
      await refetch();
    } catch (err) {
      logger.error('Error toggling automation status:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to update automation'),
        'error'
      );
    }
  }, [portalFetch, showNotification, refetch]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) {
      showNotification?.('Automation name is required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      await portalFetch(`${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations`, {
        method: 'POST',
        body: {
          name: createName.trim(),
          triggerEvent: createTrigger,
          description: createDescription.trim() || undefined,
          actions: []
        }
      });
      showNotification?.('Automation created', 'success');
      setShowCreateForm(false);
      setCreateName('');
      setCreateDescription('');
      setCreateTrigger(TRIGGER_EVENT_GROUPS[0].events[0].value);
      await refetch();
    } catch (err) {
      logger.error('Error creating automation:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to create automation'),
        'error'
      );
    } finally {
      setIsCreating(false);
    }
  }, [createName, createTrigger, createDescription, portalFetch, showNotification, refetch]);

  const handleDelete = useCallback(async (automationId: number) => {
    if (!confirm('Are you sure you want to delete this automation? This action cannot be undone.')) {
      return;
    }

    setDeletingId(automationId);
    try {
      await portalFetch(
        `${API_ENDPOINTS.ADMIN.WORKFLOWS}/automations/${automationId}`,
        { method: 'DELETE' }
      );
      showNotification?.('Automation deleted', 'success');
      await refetch();
    } catch (err) {
      logger.error('Error deleting automation:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to delete automation'),
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  }, [portalFetch, showNotification, refetch]);

  const handleRowClick = useCallback((automation: Automation) => {
    onNavigate?.('automation-detail', String(automation.id));
  }, [onNavigate]);

  const getTriggerLabel = useCallback((triggerEvent: string) =>
    TRIGGER_EVENT_LABELS[triggerEvent] || triggerEvent,
  []);

  // ---- Render ----

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="AUTOMATIONS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'completed' },
            { value: stats.totalRuns, label: 'runs' }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search automations..."
          />
          <IconButton
            action="add"
            onClick={() => setShowCreateForm(true)}
            title="New Automation"
          />
          <IconButton
            action="refresh"
            onClick={refetch}
            title="Refresh"
            loading={isLoading}
          />
        </>
      }
    >
      {/* Inline Create Form */}
      {showCreateForm && (
        <div className="portal-card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <div className="portal-card-header">
            <span className="cell-title">New Automation</span>
          </div>
          <div className="card-body flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="field-label" htmlFor="auto-name">
                Name <span className="form-required">*</span>
              </label>
              <input
                id="auto-name"
                type="text"
                placeholder="Send welcome email, notify on overdue, etc."
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
                className="form-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label" htmlFor="auto-trigger">Trigger Event</label>
              <select
                id="auto-trigger"
                value={createTrigger}
                onChange={(e) => setCreateTrigger(e.target.value)}
                disabled={isCreating}
                className="form-input"
              >
                {TRIGGER_EVENT_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.events.map((evt) => (
                      <option key={evt.value} value={evt.value}>
                        {evt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label" htmlFor="auto-desc">Description</label>
              <textarea
                id="auto-desc"
                placeholder="Brief description of what this automation does..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                disabled={isCreating}
                rows={2}
                className="form-input"
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCreateForm(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <RefreshCw className="icon-xs loading-spin" />
                ) : (
                  <Plus className="icon-xs" />
                )}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead className="name-col">Name</PortalTableHead>
            <PortalTableHead className="category-col">Trigger Event</PortalTableHead>
            <PortalTableHead className="count-col">Actions</PortalTableHead>
            <PortalTableHead className="count-col">Runs</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="date-col">Last Run</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>
        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={TABLE_COL_COUNT} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={TABLE_COL_COUNT} rows={5} />
          ) : filteredItems.length === 0 ? (
            <PortalTableEmpty
              colSpan={TABLE_COL_COUNT}
              icon={<Inbox />}
              message={search ? 'No automations match your search' : 'No automations yet'}
            />
          ) : (
            filteredItems.map((automation) => (
              <PortalTableRow
                key={automation.id}
                clickable
                onClick={() => handleRowClick(automation)}
              >
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Zap className="icon-sm" />
                    <div className="cell-content">
                      <span className="cell-title">{automation.name}</span>
                      {automation.description && (
                        <span className="cell-subtitle">{automation.description}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>{getTriggerLabel(automation.triggerEvent)}</PortalTableCell>
                <PortalTableCell>
                  {automation.actions.length}{' '}
                  <span className="text-muted">
                    {automation.actions.length === 1
                      ? `(${ACTION_TYPE_LABELS[automation.actions[0]?.actionType] || 'action'})`
                      : 'actions'}
                  </span>
                </PortalTableCell>
                <PortalTableCell>{automation.runCount}</PortalTableCell>
                <PortalTableCell className="status-col" onClick={(e) => e.stopPropagation()}>
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
                      onClick={() => handleToggleActive(automation)}
                      title={automation.isActive ? 'Deactivate' : 'Activate'}
                      style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
                    >
                      {automation.isActive ? (
                        <PowerOff className="icon-xs" />
                      ) : (
                        <Power className="icon-xs" />
                      )}
                    </button>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="date-col">
                  {automation.lastRunAt ? formatDate(automation.lastRunAt) : 'Never'}
                </PortalTableCell>
                <PortalTableCell
                  className="col-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="action-group">
                    <button
                      type="button"
                      className="btn-danger flex items-center gap-1"
                      onClick={() => handleDelete(automation.id)}
                      disabled={deletingId === automation.id}
                      title="Delete automation"
                      style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
                    >
                      {deletingId === automation.id ? (
                        <RefreshCw className="icon-xs loading-spin" />
                      ) : (
                        <Trash2 className="icon-xs" />
                      )}
                    </button>
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
