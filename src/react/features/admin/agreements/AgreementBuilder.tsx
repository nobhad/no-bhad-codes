/**
 * AgreementBuilder
 * Admin UI for managing project agreements with drag-to-reorder step support.
 * Uses the same table/detail/modal patterns as ContractsTable, InvoicesTable, etc.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  FileSignature,
  Inbox,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Send,
  XCircle,
  Calendar,
  ClipboardList
} from 'lucide-react';
import { IconButton } from '@react/factories';
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
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { PortalModal } from '@react/components/portal/PortalModal';
import { PortalInput } from '@react/components/portal/PortalInput';
import { FormDropdown } from '@react/components/portal/FormDropdown';
import type { FormDropdownOption } from '@react/components/portal/FormDropdown';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useFadeIn } from '@react/hooks/useGsap';
import { useEntityOptions } from '@react/hooks/useEntityOptions';
import { formatDate } from '@react/utils/formatDate';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiFetch, apiPost } from '@/utils/api-client';
import { showToast } from '@/utils/toast-notifications';
import { createLogger } from '@/utils/logger';
import type { SortConfig } from '../types';
import type { StatusVariant } from '@react/components/portal/StatusBadge';

const logger = createLogger('AgreementBuilder');

// ============================================
// TYPES
// ============================================

interface AgreementStep {
  id: number;
  step_type: string;
  step_order: number;
  status: string;
  custom_title: string | null;
  custom_content: string | null;
  entity_id: number | null;
}

interface Agreement {
  id: number;
  project_id: number;
  client_id: number;
  name: string;
  status: string;
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  steps: AgreementStep[];
  project?: { name: string };
  client?: { name: string };
}

interface AgreementStats {
  total: number;
  draft: number;
  sent: number;
  completed: number;
}

// ============================================
// CONSTANTS
// ============================================

const AGREEMENT_STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  draft: 'pending',
  sent: 'active',
  viewed: 'active',
  in_progress: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
  expired: 'inactive'
};

const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

const STEP_TYPE_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  proposal_review: 'Proposal Review',
  contract_sign: 'Contract Signing',
  deposit_payment: 'Deposit Payment',
  questionnaire: 'Questionnaire',
  custom_message: 'Custom Message'
};

const STEP_TYPE_OPTIONS: FormDropdownOption[] = Object.entries(STEP_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

const DEFAULT_STATS: AgreementStats = {
  total: 0,
  draft: 0,
  sent: 0,
  completed: 0
};

const AGREEMENT_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' }
];

const AGREEMENTS_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: AGREEMENT_STATUS_FILTER_OPTIONS }
];

// ============================================
// HELPERS
// ============================================

function getAgreementStatusVariant(status: string): StatusVariant {
  return AGREEMENT_STATUS_VARIANT_MAP[status] || 'pending';
}

function getAgreementStatusLabel(status: string): string {
  return AGREEMENT_STATUS_LABELS[status] || status;
}

function getStepTypeLabel(stepType: string): string {
  return STEP_TYPE_LABELS[stepType] || stepType;
}

// Filter function
function filterAgreement(
  agreement: Agreement,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      agreement.name?.toLowerCase().includes(searchLower) ||
      agreement.client?.name?.toLowerCase().includes(searchLower) ||
      agreement.project?.name?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(agreement.status)) return false;
  }

  return true;
}

// Sort function
function sortAgreements(a: Agreement, b: Agreement, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return multiplier * (a.name || '').localeCompare(b.name || '');
  case 'client':
    return multiplier * (a.client?.name || '').localeCompare(b.client?.name || '');
  case 'project':
    return multiplier * (a.project?.name || '').localeCompare(b.project?.name || '');
  case 'status':
    return multiplier * (a.status || '').localeCompare(b.status || '');
  case 'created_at':
    return multiplier * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  case 'expires_at': {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : 0;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : 0;
    return multiplier * (aTime - bTime);
  }
  default:
    return 0;
  }
}

// ============================================
// NEW STEP ROW
// ============================================

interface NewStepDraft {
  step_type: string;
  custom_title: string;
  custom_content: string;
}

const INITIAL_STEP_DRAFT: NewStepDraft = {
  step_type: '',
  custom_title: '',
  custom_content: ''
};

// ============================================
// STEP LIST (reorder with up/down arrows)
// ============================================

interface StepListProps {
  steps: AgreementStep[];
  onReorder: (stepIds: number[]) => void;
  reorderLoading: boolean;
}

function StepList({ steps, onReorder, reorderLoading }: StepListProps) {
  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.step_order - b.step_order),
    [steps]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0 || reorderLoading) return;
      const ids = sortedSteps.map((s) => s.id);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      onReorder(ids);
    },
    [sortedSteps, onReorder, reorderLoading]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= sortedSteps.length - 1 || reorderLoading) return;
      const ids = sortedSteps.map((s) => s.id);
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
      onReorder(ids);
    },
    [sortedSteps, onReorder, reorderLoading]
  );

  if (sortedSteps.length === 0) {
    return <p className="meta-value">No steps configured</p>;
  }

  return (
    <div className="agreement-step-list">
      {sortedSteps.map((step, index) => (
        <div key={step.id} className="agreement-step-row">
          <div className="agreement-step-order">{index + 1}</div>
          <div className="agreement-step-info">
            <span className="agreement-step-type">{getStepTypeLabel(step.step_type)}</span>
            {step.custom_title && (
              <span className="agreement-step-title">{step.custom_title}</span>
            )}
            <StatusBadge status={getAgreementStatusVariant(step.status)}>
              {step.status}
            </StatusBadge>
          </div>
          <div className="agreement-step-actions">
            <button
              type="button"
              className="btn-icon-sm"
              disabled={index === 0 || reorderLoading}
              onClick={() => handleMoveUp(index)}
              aria-label="Move step up"
            >
              <ChevronUp className="icon-xs" />
            </button>
            <button
              type="button"
              className="btn-icon-sm"
              disabled={index === sortedSteps.length - 1 || reorderLoading}
              onClick={() => handleMoveDown(index)}
              aria-label="Move step down"
            >
              <ChevronDown className="icon-xs" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// AGREEMENT DETAIL MODAL
// ============================================

interface AgreementDetailModalProps {
  agreement: Agreement | null;
  onClose: () => void;
  onSend: (id: number) => void;
  onCancel: (id: number) => void;
  onSetExpiration: (id: number, expiresAt: string | null) => void;
  onReorder: (id: number, stepIds: number[]) => void;
  actionLoading: string | null;
  reorderLoading: boolean;
}

function AgreementDetailModal({
  agreement,
  onClose,
  onSend,
  onCancel,
  onSetExpiration,
  onReorder,
  actionLoading,
  reorderLoading
}: AgreementDetailModalProps) {
  const [expirationDate, setExpirationDate] = useState('');
  const [showExpirationForm, setShowExpirationForm] = useState(false);

  // Reset expiration form when agreement changes
  React.useEffect(() => {
    if (agreement?.expires_at) {
      setExpirationDate(agreement.expires_at.split('T')[0]);
    } else {
      setExpirationDate('');
    }
    setShowExpirationForm(false);
  }, [agreement?.id, agreement?.expires_at]);

  const handleSetExpiration = useCallback(() => {
    if (!agreement) return;
    onSetExpiration(agreement.id, expirationDate || null);
    setShowExpirationForm(false);
  }, [agreement, expirationDate, onSetExpiration]);

  const handleReorder = useCallback(
    (stepIds: number[]) => {
      if (!agreement) return;
      onReorder(agreement.id, stepIds);
    },
    [agreement, onReorder]
  );

  if (!agreement) return null;

  const canSend = agreement.status === 'draft';
  const canCancel = agreement.status !== 'cancelled' && agreement.status !== 'completed';

  return (
    <PortalModal
      open={!!agreement}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={agreement.name || 'Agreement Details'}
      icon={<FileSignature />}
      size="lg"
      footer={
        <div className="action-group">
          {canSend && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionLoading === 'send'}
              onClick={() => onSend(agreement.id)}
            >
              <Send className="icon-xs" />
              {actionLoading === 'send' ? 'Sending...' : 'Send to Client'}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={actionLoading === 'cancel'}
              onClick={() => onCancel(agreement.id)}
            >
              <XCircle className="icon-xs" />
              {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Agreement'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="detail-section">
        <h3 className="detail-section-title">Information</h3>
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">Status</span>
            <StatusBadge status={getAgreementStatusVariant(agreement.status)}>
              {getAgreementStatusLabel(agreement.status)}
            </StatusBadge>
          </div>
          <div className="meta-item">
            <span className="meta-label">Client</span>
            <span className="meta-value">{agreement.client?.name || 'Unknown'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Project</span>
            <span className="meta-value">{agreement.project?.name || 'Unknown'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Created</span>
            <span className="meta-value">{formatDate(agreement.created_at)}</span>
          </div>
          {agreement.sent_at && (
            <div className="meta-item">
              <span className="meta-label">Sent</span>
              <span className="meta-value">{formatDate(agreement.sent_at)}</span>
            </div>
          )}
          {agreement.completed_at && (
            <div className="meta-item">
              <span className="meta-label">Completed</span>
              <span className="meta-value">{formatDate(agreement.completed_at)}</span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">Expiration</span>
            <span className="meta-value">
              {agreement.expires_at ? formatDate(agreement.expires_at) : 'None'}
              <button
                type="button"
                className="btn-icon-sm"
                onClick={() => setShowExpirationForm(!showExpirationForm)}
                aria-label="Set expiration"
              >
                <Calendar className="icon-xs" />
              </button>
            </span>
          </div>
        </div>

        {showExpirationForm && (
          <div className="expiration-form">
            <PortalInput
              type="date"
              label="Expiration Date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
            <div className="action-group">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSetExpiration}
                disabled={actionLoading === 'expiration'}
              >
                {actionLoading === 'expiration' ? 'Saving...' : 'Set Expiration'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowExpirationForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="detail-section">
        <h3 className="detail-section-title">
          Steps ({agreement.steps?.length || 0})
        </h3>
        <StepList
          steps={agreement.steps || []}
          onReorder={handleReorder}
          reorderLoading={reorderLoading}
        />
      </div>
    </PortalModal>
  );
}

// ============================================
// CREATE AGREEMENT MODAL
// ============================================

interface CreateAgreementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAgreementPayload) => void;
  onCreateFromTemplate: (projectId: string, clientId: string) => void;
  loading: boolean;
  clientOptions: FormDropdownOption[];
  projectOptions: FormDropdownOption[];
}

interface CreateAgreementPayload {
  name: string;
  project_id: string;
  client_id: string;
  steps: NewStepDraft[];
}

function CreateAgreementModal({
  open,
  onOpenChange,
  onSubmit,
  onCreateFromTemplate,
  loading,
  clientOptions,
  projectOptions
}: CreateAgreementModalProps) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [steps, setSteps] = useState<NewStepDraft[]>([]);
  const [newStep, setNewStep] = useState<NewStepDraft>(INITIAL_STEP_DRAFT);

  const resetForm = useCallback(() => {
    setName('');
    setProjectId('');
    setClientId('');
    setSteps([]);
    setNewStep(INITIAL_STEP_DRAFT);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const handleAddStep = useCallback(() => {
    if (!newStep.step_type) return;
    setSteps((prev) => [...prev, { ...newStep }]);
    setNewStep(INITIAL_STEP_DRAFT);
  }, [newStep]);

  const handleRemoveStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({ name, project_id: projectId, client_id: clientId, steps });
      resetForm();
    },
    [name, projectId, clientId, steps, onSubmit, resetForm]
  );

  const handleFromTemplate = useCallback(() => {
    if (!projectId || !clientId) {
      showToast('Select a project and client first', 'warning');
      return;
    }
    onCreateFromTemplate(projectId, clientId);
    handleClose();
  }, [projectId, clientId, onCreateFromTemplate, handleClose]);

  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title="New Agreement"
      icon={<FileSignature />}
      size="lg"
      onSubmit={handleFormSubmit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleFromTemplate}
            disabled={loading || !projectId || !clientId}
          >
            <ClipboardList className="icon-xs" />
            From Template
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || !name || !projectId || !clientId}>
            {loading ? 'Creating...' : 'Create Agreement'}
          </button>
        </>
      }
    >
      <div className="form-field">
        <label className="field-label">Name *</label>
        <PortalInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agreement name"
          required
        />
      </div>

      <div className="form-field">
        <label className="field-label">Client *</label>
        <FormDropdown
          options={clientOptions}
          value={clientId}
          onChange={setClientId}
          placeholder="Select client"
        />
      </div>

      <div className="form-field">
        <label className="field-label">Project *</label>
        <FormDropdown
          options={projectOptions}
          value={projectId}
          onChange={setProjectId}
          placeholder="Select project"
        />
      </div>

      <div className="form-field">
        <label className="field-label">Steps</label>
        {steps.length > 0 && (
          <div className="agreement-step-list">
            {steps.map((step, index) => (
              <div key={`step-${index}`} className="agreement-step-row">
                <div className="agreement-step-order">{index + 1}</div>
                <div className="agreement-step-info">
                  <span className="agreement-step-type">{getStepTypeLabel(step.step_type)}</span>
                  {step.custom_title && (
                    <span className="agreement-step-title">{step.custom_title}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-icon-sm btn-icon-danger"
                  onClick={() => handleRemoveStep(index)}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <Trash2 className="icon-xs" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="agreement-add-step-form">
          <FormDropdown
            options={STEP_TYPE_OPTIONS}
            value={newStep.step_type}
            onChange={(val) => setNewStep((prev) => ({ ...prev, step_type: val }))}
            placeholder="Step type"
          />
          <PortalInput
            value={newStep.custom_title}
            onChange={(e) => setNewStep((prev) => ({ ...prev, custom_title: e.target.value }))}
            placeholder="Custom title (optional)"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddStep}
            disabled={!newStep.step_type}
          >
            <Plus className="icon-xs" />
            Add Step
          </button>
        </div>
      </div>
    </PortalModal>
  );
}

// ============================================
// PROPS
// ============================================

interface AgreementBuilderProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
  overviewMode?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AgreementBuilder({
  getAuthToken,
  showNotification,
  onNavigate,
  defaultPageSize = 25,
  overviewMode = false
}: AgreementBuilderProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);
  const { clientOptions: entityClients, projectOptions: entityProjects } = useEntityOptions(createOpen);

  // Data fetching
  const { data, isLoading, error, refetch, setData } = useListFetch<Agreement, AgreementStats>({
    endpoint: API_ENDPOINTS.AGREEMENTS,
    getAuthToken,
    defaultStats: DEFAULT_STATS,
    itemsKey: 'agreements'
  });

  const agreements = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_STATS, [data]);

  // Confirm dialogs
  const sendDialog = useConfirmDialog();
  const cancelDialog = useConfirmDialog();

  // Filtering and sorting
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Agreement>({
    storageKey: overviewMode ? undefined : 'admin_agreements',
    filters: AGREEMENTS_FILTER_CONFIG,
    filterFn: filterAgreement,
    sortFn: sortAgreements,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  const filteredAgreements = useMemo(() => applyFilters(agreements), [applyFilters, agreements]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_agreements_pagination',
    totalItems: filteredAgreements.length,
    defaultPageSize
  });

  const paginatedAgreements = useMemo(
    () => pagination.paginate(filteredAgreements),
    [pagination, filteredAgreements]
  );

  // Merge entity options with data-derived options
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    entityClients.forEach((o) => map.set(o.value, o.label));
    agreements.forEach((a) => {
      if (a.client_id && a.client?.name) map.set(String(a.client_id), a.client.name);
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [agreements, entityClients]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    entityProjects.forEach((o) => map.set(o.value, o.label));
    agreements.forEach((a) => {
      if (a.project_id && a.project?.name) map.set(String(a.project_id), a.project.name);
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [agreements, entityProjects]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleCreate = useCallback(
    async (payload: CreateAgreementPayload) => {
      setCreateLoading(true);
      try {
        const response = await apiPost(API_ENDPOINTS.AGREEMENTS, {
          name: payload.name,
          project_id: Number(payload.project_id),
          client_id: Number(payload.client_id),
          steps: payload.steps.map((s, i) => ({
            step_type: s.step_type,
            step_order: i + 1,
            custom_title: s.custom_title || null,
            custom_content: s.custom_content || null
          }))
        });
        if (response.ok) {
          showNotification?.('Agreement created', 'success');
          setCreateOpen(false);
          refetch();
        } else {
          const json = await response.json().catch(() => null);
          showNotification?.(json?.error || 'Failed to create agreement', 'error');
        }
      } catch (err) {
        logger.error('Failed to create agreement:', err);
        showNotification?.('Failed to create agreement', 'error');
      } finally {
        setCreateLoading(false);
      }
    },
    [showNotification, refetch]
  );

  const handleCreateFromTemplate = useCallback(
    async (projectId: string, clientId: string) => {
      setCreateLoading(true);
      try {
        const response = await apiPost(API_ENDPOINTS.AGREEMENTS_FROM_TEMPLATE, {
          project_id: Number(projectId),
          client_id: Number(clientId)
        });
        if (response.ok) {
          showNotification?.('Agreement created from template', 'success');
          setCreateOpen(false);
          refetch();
        } else {
          const json = await response.json().catch(() => null);
          showNotification?.(json?.error || 'Failed to create from template', 'error');
        }
      } catch (err) {
        logger.error('Failed to create agreement from template:', err);
        showNotification?.('Failed to create from template', 'error');
      } finally {
        setCreateLoading(false);
      }
    },
    [showNotification, refetch]
  );

  const handleSend = useCallback(
    async (agreementId: number) => {
      setActionLoading('send');
      try {
        const response = await apiPost(buildEndpoint.agreementSend(agreementId));
        if (response.ok) {
          showNotification?.('Agreement sent to client', 'success');
          setData((prev) =>
            prev
              ? {
                ...prev,
                items: prev.items.map((a) =>
                  a.id === agreementId
                    ? { ...a, status: 'sent', sent_at: new Date().toISOString() }
                    : a
                )
              }
              : prev
          );
          setSelectedAgreement((prev) =>
            prev && prev.id === agreementId
              ? { ...prev, status: 'sent', sent_at: new Date().toISOString() }
              : prev
          );
        } else {
          showNotification?.('Failed to send agreement', 'error');
        }
      } catch (err) {
        logger.error('Failed to send agreement:', err);
        showNotification?.('Failed to send agreement', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showNotification, setData]
  );

  const handleCancel = useCallback(
    async (agreementId: number) => {
      setActionLoading('cancel');
      try {
        const response = await apiPost(buildEndpoint.agreementCancel(agreementId));
        if (response.ok) {
          showNotification?.('Agreement cancelled', 'success');
          setData((prev) =>
            prev
              ? {
                ...prev,
                items: prev.items.map((a) =>
                  a.id === agreementId ? { ...a, status: 'cancelled' } : a
                )
              }
              : prev
          );
          setSelectedAgreement((prev) =>
            prev && prev.id === agreementId ? { ...prev, status: 'cancelled' } : prev
          );
        } else {
          showNotification?.('Failed to cancel agreement', 'error');
        }
      } catch (err) {
        logger.error('Failed to cancel agreement:', err);
        showNotification?.('Failed to cancel agreement', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showNotification, setData]
  );

  const handleSetExpiration = useCallback(
    async (agreementId: number, expiresAt: string | null) => {
      setActionLoading('expiration');
      try {
        const response = await apiFetch(buildEndpoint.agreementExpiration(agreementId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresAt: expiresAt || null })
        });
        if (response.ok) {
          showNotification?.('Expiration updated', 'success');
          setData((prev) =>
            prev
              ? {
                ...prev,
                items: prev.items.map((a) =>
                  a.id === agreementId ? { ...a, expires_at: expiresAt } : a
                )
              }
              : prev
          );
          setSelectedAgreement((prev) =>
            prev && prev.id === agreementId ? { ...prev, expires_at: expiresAt } : prev
          );
        } else {
          showNotification?.('Failed to update expiration', 'error');
        }
      } catch (err) {
        logger.error('Failed to update expiration:', err);
        showNotification?.('Failed to update expiration', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showNotification, setData]
  );

  const handleReorder = useCallback(
    async (agreementId: number, stepIds: number[]) => {
      setReorderLoading(true);
      try {
        const response = await apiFetch(buildEndpoint.agreementStepsReorder(agreementId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepIds })
        });
        if (response.ok) {
          // Update local step order
          setSelectedAgreement((prev) => {
            if (!prev || prev.id !== agreementId) return prev;
            const updatedSteps = prev.steps.map((step) => ({
              ...step,
              step_order: stepIds.indexOf(step.id) + 1
            }));
            return { ...prev, steps: updatedSteps };
          });
          setData((prev) =>
            prev
              ? {
                ...prev,
                items: prev.items.map((a) => {
                  if (a.id !== agreementId) return a;
                  const updatedSteps = a.steps.map((step) => ({
                    ...step,
                    step_order: stepIds.indexOf(step.id) + 1
                  }));
                  return { ...a, steps: updatedSteps };
                })
              }
              : prev
          );
          showToast('Steps reordered', 'success');
        } else {
          showToast('Failed to reorder steps', 'error');
        }
      } catch (err) {
        logger.error('Failed to reorder steps:', err);
        showToast('Failed to reorder steps', 'error');
      } finally {
        setReorderLoading(false);
      }
    },
    [setData]
  );

  // Row click opens detail
  const handleRowClick = useCallback(
    async (agreement: Agreement) => {
      // Fetch enriched agreement with full step data
      try {
        const response = await apiFetch(buildEndpoint.agreement(agreement.id));
        if (response.ok) {
          const json = await response.json();
          const enriched = json.data?.agreement || json.agreement || json.data || json;
          setSelectedAgreement(enriched);
        } else {
          // Fallback to list data
          setSelectedAgreement(agreement);
        }
      } catch {
        setSelectedAgreement(agreement);
      }
    },
    []
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedAgreement(null);
  }, []);

  // Confirm dialog handlers
  const handleConfirmSend = useCallback(async () => {
    if (!selectedAgreement) return;
    await handleSend(selectedAgreement.id);
  }, [selectedAgreement, handleSend]);

  const handleConfirmCancel = useCallback(async () => {
    if (!selectedAgreement) return;
    await handleCancel(selectedAgreement.id);
  }, [selectedAgreement, handleCancel]);

  // Column count for table states
  const COL_COUNT = 7;

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="AGREEMENTS"
        stats={
          <TableStats
            items={[
              { value: stats.total, label: 'total' },
              { value: stats.draft, label: 'draft' },
              { value: stats.sent, label: 'sent', variant: 'active' },
              { value: stats.completed, label: 'completed', variant: 'completed' }
            ]}
            tooltip={`${stats.total} Total • ${stats.draft} Draft • ${stats.sent} Sent • ${stats.completed} Completed`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search agreements..."
            />
            <FilterDropdown
              sections={AGREEMENTS_FILTER_CONFIG}
              values={filterValues}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton action="add" onClick={() => setCreateOpen(true)} title="New Agreement" />
            <IconButton
              action="refresh"
              onClick={refetch}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
        pagination={
          !isLoading && filteredAgreements.length > 0 ? (
            <TablePagination
              pageInfo={pagination.pageInfo}
              page={pagination.page}
              pageSize={pagination.pageSize}
              pageSizeOptions={pagination.pageSizeOptions}
              canGoPrev={pagination.canGoPrev}
              canGoNext={pagination.canGoNext}
              onPageSizeChange={pagination.setPageSize}
              onFirstPage={pagination.firstPage}
              onPrevPage={pagination.prevPage}
              onNextPage={pagination.nextPage}
              onLastPage={pagination.lastPage}
            />
          ) : undefined
        }
      >
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead
                className="name-col"
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Agreement
              </PortalTableHead>
              <PortalTableHead
                className="client-col"
                sortable
                sortDirection={sort?.column === 'client' ? sort.direction : null}
                onClick={() => toggleSort('client')}
              >
                Client
              </PortalTableHead>
              <PortalTableHead
                className="project-col"
                sortable
                sortDirection={sort?.column === 'project' ? sort.direction : null}
                onClick={() => toggleSort('project')}
              >
                Project
              </PortalTableHead>
              <PortalTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </PortalTableHead>
              <PortalTableHead className="count-col">Steps</PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'expires_at' ? sort.direction : null}
                onClick={() => toggleSort('expires_at')}
              >
                Expires
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={COL_COUNT} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={COL_COUNT} rows={5} />
            ) : paginatedAgreements.length === 0 ? (
              <PortalTableEmpty
                colSpan={COL_COUNT}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No agreements match your filters' : 'No agreements yet'}
              />
            ) : (
              paginatedAgreements.map((agreement) => (
                <PortalTableRow
                  key={agreement.id}
                  clickable
                  onClick={() => handleRowClick(agreement)}
                >
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <FileSignature className="icon-sm" />
                      <div className="cell-content">
                        <span className="cell-title">{agreement.name || `Agreement #${agreement.id}`}</span>
                      </div>
                    </div>
                  </PortalTableCell>

                  <PortalTableCell className="client-cell">
                    {agreement.client_id && onNavigate ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('client-detail', String(agreement.client_id));
                        }}
                        className="table-link"
                      >
                        {agreement.client?.name || 'Unknown'}
                      </span>
                    ) : (
                      agreement.client?.name || 'Unknown'
                    )}
                  </PortalTableCell>

                  <PortalTableCell className="project-cell">
                    {agreement.project_id && onNavigate ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('project-detail', String(agreement.project_id));
                        }}
                        className="table-link"
                      >
                        {agreement.project?.name || 'Unknown'}
                      </span>
                    ) : (
                      agreement.project?.name || 'Unknown'
                    )}
                  </PortalTableCell>

                  <PortalTableCell className="status-col">
                    <StatusBadge status={getAgreementStatusVariant(agreement.status)}>
                      {getAgreementStatusLabel(agreement.status)}
                    </StatusBadge>
                  </PortalTableCell>

                  <PortalTableCell className="count-col">
                    {agreement.steps?.length || 0}
                  </PortalTableCell>

                  <PortalTableCell className="date-col">
                    {agreement.expires_at ? formatDate(agreement.expires_at) : '\u2014'}
                  </PortalTableCell>

                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      <IconButton
                        action="view"
                        title="View details"
                        onClick={() => handleRowClick(agreement)}
                      />
                      {agreement.status === 'draft' && (
                        <IconButton
                          action="send"
                          title="Send to client"
                          onClick={() => {
                            setSelectedAgreement(agreement);
                            sendDialog.open();
                          }}
                        />
                      )}
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      {/* Detail Modal */}
      <AgreementDetailModal
        agreement={selectedAgreement}
        onClose={handleCloseDetail}
        onSend={() => {
          sendDialog.open();
        }}
        onCancel={() => {
          cancelDialog.open();
        }}
        onSetExpiration={handleSetExpiration}
        onReorder={handleReorder}
        actionLoading={actionLoading}
        reorderLoading={reorderLoading}
      />

      {/* Create Modal */}
      <CreateAgreementModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        onCreateFromTemplate={handleCreateFromTemplate}
        loading={createLoading}
        clientOptions={clientOptions}
        projectOptions={projectOptions}
      />

      {/* Send Confirmation */}
      <ConfirmDialog
        open={sendDialog.isOpen}
        onOpenChange={sendDialog.setIsOpen}
        title="Send Agreement"
        description={`Send "${selectedAgreement?.name || 'this agreement'}" to the client? They will receive an email with a link to view and complete the agreement steps.`}
        confirmText="Send"
        cancelText="Cancel"
        onConfirm={handleConfirmSend}
        variant="info"
        loading={sendDialog.isLoading}
      />

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={cancelDialog.isOpen}
        onOpenChange={cancelDialog.setIsOpen}
        title="Cancel Agreement"
        description={`Are you sure you want to cancel "${selectedAgreement?.name || 'this agreement'}"? This action cannot be undone.`}
        confirmText="Cancel Agreement"
        cancelText="Go Back"
        onConfirm={handleConfirmCancel}
        variant="danger"
        loading={cancelDialog.isLoading}
      />
    </>
  );
}
