import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  ClipboardList,
  Inbox,
  ChevronDown,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
} from '@react/components/portal/AdminTable';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { formatDate } from '@react/utils/formatDate';
import { QUESTIONNAIRES_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  client_name: string;
  project_name: string | null;
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'expired';
  questions_count: number;
  responses_count: number;
  completion_rate: number;
  due_date: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface QuestionnairesTableProps {
  clientId?: string;
  projectId?: string;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

const QUESTIONNAIRE_STATUS_CONFIG: Record<string, { label: string }> = {
  draft: { label: 'Draft' },
  sent: { label: 'Sent' },
  in_progress: { label: 'In Progress' },
  completed: { label: 'Completed' },
  expired: { label: 'Expired' },
};

// Filter function
function filterQuestionnaire(
  questionnaire: Questionnaire,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      questionnaire.title.toLowerCase().includes(searchLower) ||
      questionnaire.client_name.toLowerCase().includes(searchLower) ||
      (questionnaire.project_name && questionnaire.project_name.toLowerCase().includes(searchLower));
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (questionnaire.status !== filters.status) return false;
  }

  return true;
}

// Sort function
function sortQuestionnaires(a: Questionnaire, b: Questionnaire, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
    case 'title':
      return multiplier * a.title.localeCompare(b.title);
    case 'client_name':
      return multiplier * a.client_name.localeCompare(b.client_name);
    case 'status':
      return multiplier * a.status.localeCompare(b.status);
    case 'due_date':
      return multiplier * ((a.due_date || '').localeCompare(b.due_date || ''));
    case 'completion_rate':
      return multiplier * (a.completion_rate - b.completion_rate);
    case 'created_at':
      return multiplier * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    default:
      return 0;
  }
}

export function QuestionnairesTable({ clientId, projectId, getAuthToken, showNotification, onNavigate }: QuestionnairesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);

  // Build headers helper with auth token
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  } = useTableFilters<Questionnaire>({
    storageKey: 'admin_questionnaires',
    filters: QUESTIONNAIRES_FILTER_CONFIG,
    filterFn: filterQuestionnaire,
    sortFn: sortQuestionnaires,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  // Apply filters
  const filteredQuestionnaires = useMemo(() => applyFilters(questionnaires), [applyFilters, questionnaires]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_questionnaires_pagination',
    totalItems: filteredQuestionnaires.length,
    defaultPageSize: 25
  });

  const paginatedQuestionnaires = useMemo(
    () => pagination.paginate(filteredQuestionnaires),
    [pagination, filteredQuestionnaires]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (q: Questionnaire) => q.id,
    items: paginatedQuestionnaires
  });

  const fetchQuestionnaires = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (clientId) params.append('client_id', clientId);
      if (projectId) params.append('project_id', projectId);

      const response = await fetch(`/api/questionnaires?${params}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch questionnaires');

      const data = await response.json();
      const payload = data.data || data;
      setQuestionnaires(payload.questionnaires || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [clientId, projectId, getHeaders]);

  useEffect(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  // Status change handler
  const handleStatusChange = useCallback(async (questionnaireId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/questionnaires/${questionnaireId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update questionnaire');

      setQuestionnaires((prev) =>
        prev.map((q) =>
          q.id === questionnaireId
            ? { ...q, status: newStatus as Questionnaire['status'] }
            : q
        )
      );
      showNotification?.('Questionnaire status updated', 'success');
    } catch (err) {
      console.error('Failed to update questionnaire status:', err);
      showNotification?.('Failed to update questionnaire status', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleSendQuestionnaire = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/questionnaires/${id}/send`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to send questionnaire');
      fetchQuestionnaires();
      showNotification?.('Questionnaire sent', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send questionnaire');
      showNotification?.('Failed to send questionnaire', 'error');
    }
  }, [getHeaders, showNotification, fetchQuestionnaires]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((q) => q.id);
    try {
      const response = await fetch('/api/questionnaires/bulk-delete', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error('Failed to delete questionnaires');

      setQuestionnaires((prev) => prev.filter((q) => !ids.includes(q.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} questionnaire${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      console.error('Failed to delete questionnaires:', err);
      showNotification?.('Failed to delete questionnaires', 'error');
    }
  }, [selection, getHeaders, showNotification]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(QUESTIONNAIRE_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`
      })),
    []
  );

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      for (const q of selection.selectedItems) {
        await handleStatusChange(q.id, newStatus);
      }
      selection.clearSelection();
    },
    [selection, handleStatusChange]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  function isOverdue(questionnaire: Questionnaire): boolean {
    if (!questionnaire.due_date || questionnaire.status === 'completed') return false;
    return new Date(questionnaire.due_date) < new Date();
  }

  const stats = useMemo(() => {
    const total = questionnaires.length;
    const draft = questionnaires.filter((q) => q.status === 'draft').length;
    const sent = questionnaires.filter((q) => q.status === 'sent').length;
    const inProgress = questionnaires.filter((q) => q.status === 'in_progress').length;
    const completed = questionnaires.filter((q) => q.status === 'completed').length;
    const avgCompletion = total > 0
      ? Math.round(questionnaires.reduce((sum, q) => sum + q.completion_rate, 0) / total)
      : 0;

    return { total, draft, sent, inProgress, completed, avgCompletion };
  }, [questionnaires]);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="QUESTIONNAIRES"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.draft, label: 'draft', hideIfZero: true },
            { value: stats.sent, label: 'sent', variant: 'pending', hideIfZero: true },
            { value: stats.inProgress, label: 'in progress', variant: 'active', hideIfZero: true },
            { value: stats.completed, label: 'completed', variant: 'completed', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total | ${stats.avgCompletion}% Avg Completion`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search questionnaires..."
          />
          <FilterDropdown
            sections={QUESTIONNAIRES_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredQuestionnaires.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" title="Create Questionnaire" onClick={() => onNavigate?.('questionnaire-create')} />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredQuestionnaires.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredQuestionnaires)}
          allSelected={selection.allSelected && selection.selectedCount === filteredQuestionnaires.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={fetchQuestionnaires}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredQuestionnaires.length > 0 ? (
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
      {!error && (
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selection.allSelected}
                onCheckedChange={selection.toggleSelectAll}
                aria-label="Select all"
              />
            </AdminTableHead>
            <AdminTableHead
              className="name-col"
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Questionnaire
            </AdminTableHead>
            <AdminTableHead
              className="client-col"
              sortable
              sortDirection={sort?.column === 'client_name' ? sort.direction : null}
              onClick={() => toggleSort('client_name')}
            >
              Client / Project
            </AdminTableHead>
            <AdminTableHead
              className="status-col"
              sortable
              sortDirection={sort?.column === 'status' ? sort.direction : null}
              onClick={() => toggleSort('status')}
            >
              Status
            </AdminTableHead>
            <AdminTableHead className="progress-col">Progress</AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'due_date' ? sort.direction : null}
              onClick={() => toggleSort('due_date')}
            >
              Due Date
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedQuestionnaires.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No questionnaires match your filters' : 'No questionnaires yet'}
            />
          ) : (
            paginatedQuestionnaires.map((questionnaire) => (
              <AdminTableRow
                key={questionnaire.id}
                clickable
                selected={selection.isSelected(questionnaire)}
              >
                <AdminTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(questionnaire)}
                    onCheckedChange={() => selection.toggleSelection(questionnaire)}
                    aria-label={`Select ${questionnaire.title}`}
                  />
                </AdminTableCell>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <ClipboardList className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{questionnaire.title}</span>
                      {questionnaire.description && (
                        <span className="cell-subtitle">{questionnaire.description}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-content">
                    <span className="cell-title">{questionnaire.client_name}</span>
                    {questionnaire.project_name && (
                      <span className="cell-subtitle">{questionnaire.project_name}</span>
                    )}
                  </div>
                </AdminTableCell>
                <AdminTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button className="status-dropdown-trigger">
                        <StatusBadge status={getStatusVariant(questionnaire.status)} size="sm">
                          {QUESTIONNAIRE_STATUS_CONFIG[questionnaire.status]?.label || questionnaire.status}
                        </StatusBadge>
                        <ChevronDown className="status-dropdown-caret" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent sideOffset={0} align="start">
                      {Object.entries(QUESTIONNAIRE_STATUS_CONFIG).map(([status, config]) => (
                        <PortalDropdownItem
                          key={status}
                          onClick={() => handleStatusChange(questionnaire.id, status)}
                        >
                          <StatusBadge status={getStatusVariant(status)} size="sm">
                            {config.label}
                          </StatusBadge>
                        </PortalDropdownItem>
                      ))}
                    </PortalDropdownContent>
                  </PortalDropdown>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-content">
                    <div className="progress-cell">
                      <div className="progress-bar progress-sm">
                        <div
                          className={`progress-fill ${questionnaire.completion_rate === 100 ? 'progress-success' : ''}`}
                          style={{ width: `${questionnaire.completion_rate}%` }}
                        />
                      </div>
                      <span className="progress-pct">{questionnaire.completion_rate}%</span>
                    </div>
                    <span className="cell-subtitle">
                      {questionnaire.responses_count}/{questionnaire.questions_count} questions
                    </span>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="date-cell">
                  <span className={isOverdue(questionnaire) ? 'text-danger' : ''}>
                    {formatDate(questionnaire.due_date)}
                    {isOverdue(questionnaire) && (
                      <span className="overdue-label">Overdue</span>
                    )}
                  </span>
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton
                      action="view"
                      onClick={() => onNavigate?.('questionnaire-detail', String(questionnaire.id))}
                    />
                    {questionnaire.status === 'draft' && (
                      <IconButton
                        action="send"
                        onClick={() => handleSendQuestionnaire(questionnaire.id)}
                      />
                    )}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>
      )}
    </TableLayout>
  );
}
