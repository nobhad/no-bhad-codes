import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  ClipboardList,
  Inbox,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
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
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';

interface Questionnaire {
  id: string;
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
  onNavigate?: (tab: string, entityId?: string) => void;
}

type SortField = 'title' | 'client_name' | 'status' | 'due_date' | 'completion_rate' | 'created_at';
type SortDirection = 'asc' | 'desc';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
];

export function QuestionnairesTable({ clientId, projectId, onNavigate }: QuestionnairesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchQuestionnaires();
  }, [clientId, projectId]);

  async function fetchQuestionnaires() {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (clientId) params.append('client_id', clientId);
      if (projectId) params.append('project_id', projectId);

      const response = await fetch(`/api/admin/questionnaires?${params}`);
      if (!response.ok) throw new Error('Failed to fetch questionnaires');

      const data = await response.json();
      setQuestionnaires(data.questionnaires || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredQuestionnaires = useMemo(() => {
    let filtered = [...questionnaires];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.title.toLowerCase().includes(query) ||
          q.client_name.toLowerCase().includes(query) ||
          (q.project_name && q.project_name.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'client_name':
          aVal = a.client_name.toLowerCase();
          bVal = b.client_name.toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'due_date':
          aVal = a.due_date || '';
          bVal = b.due_date || '';
          break;
        case 'completion_rate':
          aVal = a.completion_rate;
          bVal = b.completion_rate;
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [questionnaires, searchQuery, statusFilter, sortField, sortDirection]);

  const pagination = usePagination({ totalItems: filteredQuestionnaires.length });
  const paginatedQuestionnaires = filteredQuestionnaires.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function getStatusLabel(status: Questionnaire['status']): string {
    const labels: Record<Questionnaire['status'], string> = {
      draft: 'Draft',
      sent: 'Sent',
      in_progress: 'In Progress',
      completed: 'Completed',
      expired: 'Expired',
    };
    return labels[status];
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

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

  async function handleSendQuestionnaire(id: string) {
    try {
      const response = await fetch(`/api/admin/questionnaires/${id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send questionnaire');
      fetchQuestionnaires();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send questionnaire');
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

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
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search questionnaires..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <IconButton action="add" title="Create Questionnaire" onClick={() => onNavigate?.('questionnaire-create')} />
        </>
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
            <AdminTableHead
              sortable
              sortDirection={sortField === 'title' ? sortDirection : null}
              onClick={() => handleSort('title')}
            >
              Questionnaire
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sortField === 'client_name' ? sortDirection : null}
              onClick={() => handleSort('client_name')}
            >
              Client / Project
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sortField === 'status' ? sortDirection : null}
              onClick={() => handleSort('status')}
            >
              Status
            </AdminTableHead>
            <AdminTableHead>Progress</AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sortField === 'due_date' ? sortDirection : null}
              onClick={() => handleSort('due_date')}
            >
              Due Date
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={6} rows={5} />
          ) : paginatedQuestionnaires.length === 0 ? (
            <AdminTableEmpty
              colSpan={6}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No questionnaires match your filters' : 'No questionnaires yet'}
            />
          ) : (
            paginatedQuestionnaires.map((questionnaire) => (
              <AdminTableRow key={questionnaire.id} clickable>
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
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(questionnaire.status)} size="sm">
                    {getStatusLabel(questionnaire.status)}
                  </StatusBadge>
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
                      onClick={() => onNavigate?.('questionnaire-detail', questionnaire.id)}
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
