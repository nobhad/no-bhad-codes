import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  ClipboardList,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { cn } from '@react/lib/utils';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
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
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { QUESTIONNAIRES_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost, apiFetch } from '@/utils/api-client';
import { executeUpdateWithToast, executeWithToast } from '@/utils/api-wrappers';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  client_id: number;
  client_name: string;
  project_id?: number;
  project_name: string | null;
  questionnaire_name?: string;
  status: 'draft' | 'sent' | 'pending' | 'in_progress' | 'completed' | 'expired';
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
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

const QUESTIONNAIRE_STATUS_CONFIG: Record<string, { label: string }> = {
  draft: { label: 'Draft' },
  pending: { label: 'Pending' },
  sent: { label: 'Sent' },
  in_progress: { label: 'In Progress' },
  completed: { label: 'Completed' },
  expired: { label: 'Expired' },
  viewed: { label: 'Viewed' }
};

// Capitalize status label (fallback for unknown statuses)
function getStatusLabel(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  if (QUESTIONNAIRE_STATUS_CONFIG[status]) {
    return QUESTIONNAIRE_STATUS_CONFIG[status].label;
  }
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// Filter function
function filterQuestionnaire(
  questionnaire: Questionnaire,
  filters: Record<string, string[]>,
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

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(questionnaire.status)) return false;
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

export function QuestionnairesTable({ clientId, projectId, getAuthToken, showNotification: _showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: QuestionnairesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Build endpoint URL with query params — fetches responses (not templates)
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (clientId) params.append('client_id', clientId);
    if (projectId) params.append('project_id', projectId);
    const query = params.toString();
    return query ? `${API_ENDPOINTS.QUESTIONNAIRES_RESPONSES}?${query}` : API_ENDPOINTS.QUESTIONNAIRES_RESPONSES;
  }, [clientId, projectId]);

  // Data fetching via useListFetch
  const { data, isLoading, error, refetch, setData } = useListFetch<Questionnaire>({
    endpoint,
    getAuthToken,
    itemsKey: 'questionnaires',
    deps: [clientId, projectId]
  });
  const questionnaires = useMemo(() => data?.items ?? [], [data]);

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
    storageKey: overviewMode ? undefined : 'admin_questionnaires',
    filters: QUESTIONNAIRES_FILTER_CONFIG,
    filterFn: filterQuestionnaire,
    sortFn: sortQuestionnaires,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  // Apply filters
  const filteredQuestionnaires = useMemo(() => applyFilters(questionnaires), [applyFilters, questionnaires]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_questionnaires_pagination',
    totalItems: filteredQuestionnaires.length,
    defaultPageSize
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

  // Status change handler
  const handleStatusChange = useCallback(async (questionnaireId: number, newStatus: string) => {
    await executeUpdateWithToast(
      'questionnaire status',
      () => apiFetch(buildEndpoint.questionnaire(questionnaireId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }),
      () => setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((q) =>
          q.id === questionnaireId
            ? { ...q, status: newStatus as Questionnaire['status'] }
            : q
        )
      } : prev)
    );
  }, [setData]);

  const handleSendQuestionnaire = useCallback(async (id: number) => {
    await executeWithToast(
      () => apiPost(buildEndpoint.questionnaireSend(id)),
      { success: 'Questionnaire sent', error: 'Failed to send questionnaire' },
      () => refetch()
    );
  }, [refetch]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((q) => q.id);
    await executeWithToast(
      () => apiPost(API_ENDPOINTS.QUESTIONNAIRES_BULK_DELETE, { ids }),
      { success: `Deleted ${ids.length} questionnaire${ids.length !== 1 ? 's' : ''}`, error: 'Failed to delete questionnaires' },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((q) => !ids.includes(q.id)) } : prev);
        selection.clearSelection();
      }
    );
  }, [selection, setData]);

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
            { value: stats.draft, label: 'draft' },
            { value: stats.sent, label: 'sent', variant: 'pending' },
            { value: stats.inProgress, label: 'in progress', variant: 'active' },
            { value: stats.completed, label: 'completed', variant: 'completed' }
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
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead className="col-checkbox" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selection.allSelected}
                onCheckedChange={selection.toggleSelectAll}
                aria-label="Select all"
              />
            </PortalTableHead>
            <PortalTableHead
              className="name-col"
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Questionnaire
            </PortalTableHead>
            <PortalTableHead className="client-col">Client</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'due_date' ? sort.direction : null}
              onClick={() => toggleSort('due_date')}
            >
              Due Date
            </PortalTableHead>
            <PortalTableHead className="progress-col">Progress</PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={7} rows={5} />
          ) : paginatedQuestionnaires.length === 0 ? (
            <PortalTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No questionnaires match your filters' : 'No questionnaires yet'}
            />
          ) : (
            paginatedQuestionnaires.map((questionnaire) => (
              <PortalTableRow
                key={questionnaire.id}
                clickable
                selected={selection.isSelected(questionnaire)}
              >
                <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(questionnaire)}
                    onCheckedChange={() => selection.toggleSelection(questionnaire)}
                    aria-label={`Select ${questionnaire.title}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <ClipboardList className="icon-sm" />
                    <div className="cell-content">
                      <span className="cell-title">
                        {decodeHtmlEntities(questionnaire.questionnaire_name || questionnaire.title)}
                      </span>
                      {questionnaire.project_name && (
                        <span className="cell-subtitle">
                          {questionnaire.project_id && onNavigate ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('project-detail', String(questionnaire.project_id));
                              }}
                              className="table-link"
                            >
                              {decodeHtmlEntities(questionnaire.project_name)}
                            </span>
                          ) : (
                            decodeHtmlEntities(questionnaire.project_name)
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  {questionnaire.client_id && onNavigate ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('client-detail', String(questionnaire.client_id));
                      }}
                      className="table-link"
                    >
                      {decodeHtmlEntities(questionnaire.client_name)}
                    </span>
                  ) : (
                    decodeHtmlEntities(questionnaire.client_name)
                  )}
                </PortalTableCell>
                <PortalTableCell>
                  <StatusBadge status={getStatusVariant(questionnaire.status)}>
                    {getStatusLabel(questionnaire.status)}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className={cn(isOverdue(questionnaire) && 'text-danger')}>
                  {questionnaire.due_date && formatDate(questionnaire.due_date)}
                </PortalTableCell>
                <PortalTableCell>
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
                </PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
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
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
