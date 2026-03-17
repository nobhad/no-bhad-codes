/**
 * SequencesTable
 * Admin table for managing email drip sequences.
 * Lists sequences with inline create form and active/inactive toggle.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Mail,
  Inbox,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Power,
  PowerOff,
  Users
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
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SequencesTable');

// ============================================================================
// TYPES
// ============================================================================

interface SequenceStep {
  id: number;
  sequence_id: number;
  step_order: number;
  delay_hours: number;
  email_template_id: number | null;
  subject_override: string | null;
}

interface EmailSequence {
  id: number;
  name: string;
  description: string | null;
  trigger_event: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  steps: SequenceStep[];
  enrollmentCount: number;
  completionRate: number;
}

/** Trigger events available for new sequences */
const TRIGGER_EVENT_OPTIONS = [
  { value: 'client_created', label: 'Client Created' },
  { value: 'project_created', label: 'Project Created' },
  { value: 'project_completed', label: 'Project Completed' },
  { value: 'invoice_sent', label: 'Invoice Sent' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'manual', label: 'Manual Enrollment' }
] as const;

const TABLE_COL_COUNT = 5;

// ============================================================================
// PROPS
// ============================================================================

export interface SequencesTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Toast notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Navigation callback */
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SequencesTable({
  getAuthToken,
  showNotification
}: SequencesTableProps) {
  const containerRef = useFadeIn();

  const {
    data: sequences,
    isLoading,
    error,
    refetch,
    portalFetch
  } = usePortalData<EmailSequence[]>({
    getAuthToken,
    url: API_ENDPOINTS.SEQUENCES,
    transform: (raw) => (raw as Record<string, unknown>).sequences as EmailSequence[] || []
  });

  const items = useMemo(() => sequences ?? [], [sequences]);

  // Search
  const [search, setSearch] = useState('');
  const filteredItems = useMemo(() => {
    if (!search) return items;
    const query = search.toLowerCase();
    return items.filter(
      (seq) =>
        seq.name.toLowerCase().includes(query) ||
        seq.trigger_event.toLowerCase().includes(query) ||
        (seq.description && seq.description.toLowerCase().includes(query))
    );
  }, [items, search]);

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTrigger, setCreateTrigger] = useState<string>(TRIGGER_EVENT_OPTIONS[0].value);
  const [createDescription, setCreateDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((s) => s.is_active).length;
    return { total, active };
  }, [items]);

  // Toggle active/inactive
  const handleToggleActive = useCallback(async (seq: EmailSequence) => {
    try {
      await portalFetch(`${API_ENDPOINTS.SEQUENCES}/${seq.id}`, {
        method: 'PUT',
        body: { isActive: seq.is_active ? false : true }
      });
      showNotification?.(
        `Sequence ${seq.is_active ? 'deactivated' : 'activated'}`,
        'success'
      );
      await refetch();
    } catch (err) {
      logger.error('Error toggling sequence status:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to update sequence'),
        'error'
      );
    }
  }, [portalFetch, showNotification, refetch]);

  // Create new sequence
  const handleCreate = useCallback(async () => {
    if (!createName.trim()) {
      showNotification?.('Sequence name is required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      await portalFetch(API_ENDPOINTS.SEQUENCES, {
        method: 'POST',
        body: {
          name: createName.trim(),
          triggerEvent: createTrigger,
          description: createDescription.trim() || undefined,
          steps: [{ delayHours: 0 }]
        }
      });
      showNotification?.('Sequence created', 'success');
      setShowCreateForm(false);
      setCreateName('');
      setCreateDescription('');
      setCreateTrigger(TRIGGER_EVENT_OPTIONS[0].value);
      await refetch();
    } catch (err) {
      logger.error('Error creating sequence:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to create sequence'),
        'error'
      );
    } finally {
      setIsCreating(false);
    }
  }, [createName, createTrigger, createDescription, portalFetch, showNotification, refetch]);

  const handleRowToggle = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const triggerLabel = useCallback((triggerEvent: string) => {
    const found = TRIGGER_EVENT_OPTIONS.find((opt) => opt.value === triggerEvent);
    return found ? found.label : triggerEvent;
  }, []);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="EMAIL SEQUENCES"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'completed' }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search sequences..." />
          <IconButton action="add" onClick={() => setShowCreateForm(true)} title="New Sequence" />
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {/* Inline Create Form */}
      {showCreateForm && (
        <div className="portal-card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <div className="portal-card-header">
            <span className="cell-title">New Sequence</span>
          </div>
          <div className="card-body flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="field-label" htmlFor="seq-name">
                Name <span className="form-required">*</span>
              </label>
              <input
                id="seq-name"
                type="text"
                placeholder="Welcome series, follow-up, etc."
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
                className="form-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label" htmlFor="seq-trigger">Trigger Event</label>
              <select
                id="seq-trigger"
                value={createTrigger}
                onChange={(e) => setCreateTrigger(e.target.value)}
                disabled={isCreating}
                className="form-input"
              >
                {TRIGGER_EVENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label" htmlFor="seq-desc">Description</label>
              <textarea
                id="seq-desc"
                placeholder="Brief description of this sequence..."
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
            <PortalTableHead className="count-col">Steps</PortalTableHead>
            <PortalTableHead className="count-col">Enrollments</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
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
              message={search ? 'No sequences match your search' : 'No sequences yet'}
            />
          ) : (
            filteredItems.map((seq) => (
              <React.Fragment key={seq.id}>
                <PortalTableRow clickable onClick={() => handleRowToggle(seq.id)}>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <Mail className="icon-sm" />
                      <div className="cell-content">
                        <span className="cell-title">{seq.name}</span>
                        {seq.description && (
                          <span className="cell-subtitle">{seq.description}</span>
                        )}
                      </div>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell>{triggerLabel(seq.trigger_event)}</PortalTableCell>
                  <PortalTableCell>{seq.steps?.length ?? 0}</PortalTableCell>
                  <PortalTableCell>
                    <div className="flex items-center gap-1">
                      <Users className="icon-xs" style={{ color: 'var(--app-color-text-muted)' }} />
                      <span>{seq.enrollmentCount}</span>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="status-col" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      <StatusBadge status={seq.is_active ? 'completed' : 'pending'} size="sm">
                        {seq.is_active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                      <button
                        type="button"
                        className="btn-secondary flex items-center gap-1"
                        onClick={() => handleToggleActive(seq)}
                        title={seq.is_active ? 'Deactivate' : 'Activate'}
                        style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
                      >
                        {seq.is_active ? (
                          <PowerOff className="icon-xs" />
                        ) : (
                          <Power className="icon-xs" />
                        )}
                      </button>
                    </div>
                  </PortalTableCell>
                </PortalTableRow>

                {/* Expanded inline detail */}
                {expandedId === seq.id && (
                  <PortalTableRow>
                    <PortalTableCell colSpan={TABLE_COL_COUNT}>
                      <div className="flex flex-col gap-1 py-2 px-4" style={{ background: 'var(--app-color-bg-secondary)' }}>
                        <div className="flex items-center gap-2">
                          {expandedId === seq.id ? (
                            <ChevronUp className="icon-xs" style={{ color: 'var(--app-color-text-muted)' }} />
                          ) : (
                            <ChevronDown className="icon-xs" style={{ color: 'var(--app-color-text-muted)' }} />
                          )}
                          <span className="text-muted">Details</span>
                        </div>
                        <div className="flex gap-6 ml-5">
                          <div>
                            <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                              Active Enrollments
                            </span>
                            <p>{seq.enrollmentCount}</p>
                          </div>
                          <div>
                            <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                              Completion Rate
                            </span>
                            <p>{Math.round(seq.completionRate * 100)}%</p>
                          </div>
                          <div>
                            <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                              Created
                            </span>
                            <p>{formatDate(seq.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    </PortalTableCell>
                  </PortalTableRow>
                )}
              </React.Fragment>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
