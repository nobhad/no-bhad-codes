/**
 * ===============================================
 * FEEDBACK TABLE
 * ===============================================
 * @file src/react/features/admin/feedback/FeedbackTable.tsx
 *
 * Admin table for viewing and sending feedback surveys.
 * Shows survey list with status, ratings, and response data.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Send as _Send, Inbox, Star, BarChart3 as _BarChart3 } from 'lucide-react';
import { IconButton } from '@react/factories';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatDate } from '@react/utils/formatDate';
import { apiFetch, apiPost } from '@/utils/api-client';
import { showToast } from '@/utils/toast-notifications';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

// ============================================
// Constants
// ============================================

const SURVEY_TYPE_LABELS: Record<string, string> = {
  project_completion: 'Project Completion',
  milestone_check_in: 'Milestone Check-In',
  nps_quarterly: 'NPS Quarterly'
};

import type { StatusVariant } from '@react/components/portal/StatusBadge';

const STATUS_MAP: Record<string, StatusVariant> = {
  completed: 'completed',
  sent: 'active',
  expired: 'cancelled',
  pending: 'pending'
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' }
];

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'project_completion', label: 'Project Completion' },
  { value: 'milestone_check_in', label: 'Milestone Check-In' },
  { value: 'nps_quarterly', label: 'NPS Quarterly' }
];

const FILTER_CONFIG = [
  { key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS },
  { key: 'surveyType', label: 'Type', options: TYPE_FILTER_OPTIONS }
];

const TOTAL_STARS = 5;

// ============================================
// Types
// ============================================

interface SurveyResponse {
  overall_rating: number | null;
  nps_score: number | null;
}

interface Survey {
  id: number;
  project_id: number | null;
  client_id: number;
  survey_type: string;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
  clientName: string;
  clientEmail: string;
  projectName: string | null;
  response?: SurveyResponse;
}

interface ClientOption {
  value: string;
  label: string;
}

// ============================================
// Filter / Sort helpers
// ============================================

function filterSurvey(
  survey: Survey,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const term = search.toLowerCase();
    const matches =
      survey.clientName?.toLowerCase().includes(term) ||
      survey.projectName?.toLowerCase().includes(term);
    if (!matches) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0 && !statusFilter.includes(survey.status)) {
    return false;
  }

  const typeFilter = filters.surveyType;
  if (typeFilter && typeFilter.length > 0 && !typeFilter.includes(survey.survey_type)) {
    return false;
  }

  return true;
}

function sortSurveys(a: Survey, b: Survey): number {
  return new Date(b.sent_at || b.completed_at || '').getTime() -
         new Date(a.sent_at || a.completed_at || '').getTime();
}

// ============================================
// Helpers
// ============================================

function renderStars(rating: number | null | undefined): React.ReactNode {
  if (rating == null) return '—';
  return (
    <span className="star-rating" title={`${rating}/5`}>
      {Array.from({ length: TOTAL_STARS }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < rating ? 'var(--app-color-warning)' : 'none'}
          stroke={i < rating ? 'var(--app-color-warning)' : 'var(--app-color-text-muted)'}
        />
      ))}
    </span>
  );
}

// ============================================
// COMPONENT
// ============================================

export function FeedbackTable() {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const fetchedClients = useRef(false);
  const [sendForm, setSendForm] = useState({
    clientId: '',
    surveyType: 'project_completion'
  });

  // Filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Survey>({
    storageKey: 'admin_feedback',
    filters: FILTER_CONFIG,
    filterFn: filterSurvey,
    sortFn: sortSurveys,
    defaultSort: { column: 'date', direction: 'desc' }
  });

  // Fetch surveys
  const fetchSurveys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(API_ENDPOINTS.FEEDBACK_SURVEYS);
      if (!res.ok) throw new Error('Failed to load surveys');
      const json = await res.json();
      setSurveys(json.data?.surveys || json.surveys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load surveys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch clients for send form
  const fetchClients = useCallback(async () => {
    if (fetchedClients.current) return;
    fetchedClients.current = true;
    try {
      const res = await apiFetch('/api/clients');
      if (res.ok) {
        const json = await res.json();
        const list = (json.data?.clients || json.clients || []) as Array<{ id: number; name: string }>;
        setClients(list.map(c => ({ value: String(c.id), label: c.name })));
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const filteredSurveys = useMemo(() => applyFilters(surveys), [applyFilters, surveys]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_feedback_pagination',
    totalItems: filteredSurveys.length,
    defaultPageSize: 25
  });

  const paginatedSurveys = useMemo(
    () => pagination.paginate(filteredSurveys),
    [pagination, filteredSurveys]
  );

  // Stats
  const stats = useMemo(() => {
    const total = surveys.length;
    const completed = surveys.filter(s => s.status === 'completed').length;
    const pending = surveys.filter(s => s.status === 'sent').length;
    const withRating = surveys.filter(s => s.response?.overall_rating);
    const avgRating = withRating.length > 0
      ? withRating.reduce((sum, s) => sum + (s.response?.overall_rating || 0), 0) / withRating.length
      : 0;

    return [
      { value: total, label: 'total' },
      { value: completed, label: 'completed' },
      { value: pending, label: 'awaiting' },
      { value: avgRating ? avgRating.toFixed(1) : '—', label: 'avg rating' }
    ];
  }, [surveys]);

  // Send survey
  const handleSend = useCallback(async () => {
    if (!sendForm.clientId) {
      showToast('Select a client', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await apiPost(API_ENDPOINTS.FEEDBACK, {
        clientId: Number(sendForm.clientId),
        surveyType: sendForm.surveyType
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to send');
      }
      showToast('Survey sent', 'success');
      setShowSendForm(false);
      setSendForm({ clientId: '', surveyType: 'project_completion' });
      fetchSurveys();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  }, [sendForm, fetchSurveys]);

  const handleOpenSend = useCallback(() => {
    setShowSendForm(prev => !prev);
    fetchClients();
  }, [fetchClients]);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="FEEDBACK SURVEYS"
      stats={
        <TableStats
          items={stats}
          tooltip={`${surveys.length} Surveys`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search surveys..."
          />
          <FilterDropdown
            sections={FILTER_CONFIG}
            values={{
              status: filterValues.status || 'all',
              surveyType: filterValues.surveyType || 'all'
            }}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton
            action="add"
            onClick={handleOpenSend}
            title="Send survey"
          />
          <IconButton
            action="refresh"
            onClick={fetchSurveys}
            disabled={isLoading}
            loading={isLoading}
          />
        </>
      }
      pagination={
        !isLoading && filteredSurveys.length > 0 ? (
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
      {/* Send Form */}
      {showSendForm && (
        <div className="inline-create-form">
          <div className="inline-form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="survey-client">Client</label>
              <select
                id="survey-client"
                className="form-input"
                value={sendForm.clientId}
                onChange={e => setSendForm(prev => ({ ...prev, clientId: e.target.value }))}
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="survey-type">Type</label>
              <select
                id="survey-type"
                className="form-input"
                value={sendForm.surveyType}
                onChange={e => setSendForm(prev => ({ ...prev, surveyType: e.target.value }))}
              >
                {TYPE_FILTER_OPTIONS.filter(o => o.value !== 'all').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="inline-form-actions">
            <button className="btn-primary" onClick={handleSend} disabled={sending}>
              {sending ? 'Sending...' : 'Send Survey'}
            </button>
            <button className="btn-secondary" onClick={() => setShowSendForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead className="client-col">Client</PortalTableHead>
            <PortalTableHead className="client-col">Project</PortalTableHead>
            <PortalTableHead className="status-col">Type</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="status-col">Rating</PortalTableHead>
            <PortalTableHead className="amount-col">NPS</PortalTableHead>
            <PortalTableHead className="date-col">Sent</PortalTableHead>
            <PortalTableHead className="date-col">Completed</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={8} message={error} onRetry={fetchSurveys} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={8} rows={5} />
          ) : paginatedSurveys.length === 0 ? (
            <PortalTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No surveys match your filters' : 'No surveys yet'}
            />
          ) : (
            paginatedSurveys.map(survey => (
              <PortalTableRow key={survey.id}>
                <PortalTableCell className="client-cell">{survey.clientName}</PortalTableCell>
                <PortalTableCell className="client-cell">{survey.projectName || '—'}</PortalTableCell>
                <PortalTableCell className="status-col">
                  <StatusBadge status="qualified">
                    {SURVEY_TYPE_LABELS[survey.survey_type] || survey.survey_type}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className="status-col">
                  <StatusBadge status={STATUS_MAP[survey.status] || survey.status}>
                    {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className="status-col">
                  {renderStars(survey.response?.overall_rating)}
                </PortalTableCell>
                <PortalTableCell className="amount-col">
                  {survey.response?.nps_score != null ? survey.response.nps_score : '—'}
                </PortalTableCell>
                <PortalTableCell className="date-col">
                  {survey.sent_at ? formatDate(survey.sent_at) : '—'}
                </PortalTableCell>
                <PortalTableCell className="date-col">
                  {survey.completed_at ? formatDate(survey.completed_at) : '—'}
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
