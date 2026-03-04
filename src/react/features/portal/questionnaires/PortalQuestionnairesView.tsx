/**
 * PortalQuestionnairesView
 * Client portal questionnaires list with status cards
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_QUESTIONNAIRES_FILTER_CONFIG } from '../shared/filterConfigs';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { QuestionnaireForm } from './QuestionnaireForm';
import { QUESTIONNAIRE_STATUS_CONFIG } from './types';
import type {
  PortalQuestionnairesProps,
  PortalQuestionnaireResponse,
  QuestionnaireStatus
} from './types';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get status icon based on questionnaire status
 */
function getStatusIcon(status: QuestionnaireStatus): React.ReactNode {
  switch (status) {
  case 'submitted':
  case 'approved':
    return <CheckCircle className="icon-sm text-status-completed" />;
  case 'in_progress':
    return <Clock className="icon-sm text-status-active" />;
  case 'rejected':
    return <AlertCircle className="icon-sm text-status-cancelled" />;
  default:
    return <FileText className="icon-sm" />;
  }
}

/**
 * Filter questionnaire by search and status
 */
function filterQuestionnaire(
  response: PortalQuestionnaireResponse,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      response.questionnaire?.title?.toLowerCase().includes(s) ||
      response.questionnaire?.description?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (response.status !== filters.status) return false;
  }

  return true;
}

/**
 * PortalQuestionnairesView Component
 */
export function PortalQuestionnairesView({
  getAuthToken,
  showNotification
}: PortalQuestionnairesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const cardsRef = useStaggerChildren<HTMLDivElement>(0.08, 0.1);

  const [responses, setResponses] = useState<PortalQuestionnaireResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<PortalQuestionnaireResponse | null>(null);

  /**
   * Fetch questionnaire responses from API
   */
  const fetchResponses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.QUESTIONNAIRES_MY_RESPONSES, {
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to fetch questionnaires');
      }

      const raw = await response.json();
      // Server uses sendSuccess() which wraps: { success, data: { responses } }
      const data = raw.data ?? raw;
      setResponses(data.responses || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load questionnaires';
      setError(errorMessage);
      showNotification?.(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken, showNotification]);

  // Fetch on mount
  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<PortalQuestionnaireResponse>({
    storageKey: 'portal_questionnaires',
    filters: PORTAL_QUESTIONNAIRES_FILTER_CONFIG,
    filterFn: filterQuestionnaire
  });

  const filteredResponses = useMemo(() => applyFilters(responses), [applyFilters, responses]);

  /**
   * Handle card click to open questionnaire
   */
  const handleOpenQuestionnaire = (response: PortalQuestionnaireResponse) => {
    setSelectedResponse(response);
  };

  /**
   * Handle back from form view
   */
  const handleBack = () => {
    setSelectedResponse(null);
    // Refresh the list to get updated status
    fetchResponses();
  };

  /**
   * Handle successful form submission
   */
  const handleSubmitSuccess = () => {
    setSelectedResponse(null);
    fetchResponses();
    showNotification?.('Questionnaire submitted successfully', 'success');
  };

  // If a questionnaire is selected, show the form
  if (selectedResponse) {
    return (
      <QuestionnaireForm
        response={selectedResponse}
        getAuthToken={getAuthToken}
        showNotification={showNotification}
        onSubmitSuccess={handleSubmitSuccess}
        onBack={handleBack}
      />
    );
  }

  // Calculate summary stats
  const completedCount = responses.filter(r => r.status === 'submitted' || r.status === 'approved').length;
  const pendingCount = responses.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
  const needsRevisionCount = responses.filter(r => r.status === 'rejected').length;

  return (
    <TableLayout
      containerRef={containerRef}
      title="QUESTIONNAIRES"
      stats={
        <TableStats items={[
          { value: responses.length, label: 'total' },
          { value: completedCount, label: 'completed', variant: 'completed', hideIfZero: true },
          { value: pendingCount, label: 'pending', variant: 'pending', hideIfZero: true },
          { value: needsRevisionCount, label: 'needs revision', variant: 'overdue', hideIfZero: true }
        ]} />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search questionnaires..." />
          <FilterDropdown
            sections={PORTAL_QUESTIONNAIRES_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={fetchResponses} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading questionnaires..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchResponses} />
      ) : filteredResponses.length === 0 ? (
        <EmptyState
          icon={<FileText className="icon-lg" />}
          message={responses.length === 0
            ? 'No questionnaires assigned yet'
            : 'No questionnaires match the current filters.'
          }
        />
      ) : (
        <div ref={cardsRef} className="portal-cards-list">
          {filteredResponses.map((response) => {
            const config = QUESTIONNAIRE_STATUS_CONFIG[response.status];
            const isActionable = response.status !== 'submitted' && response.status !== 'approved';

            return (
              <div
                key={response.id}
                onClick={() => handleOpenQuestionnaire(response)}
                className="portal-card card-clickable"
              >
                {/* Header: Icon, title, status */}
                <div className="portal-card-header">
                  <div className="portal-card-title-group">
                    {getStatusIcon(response.status)}
                    <div className="tw-flex tw-flex-col tw-gap-0.5">
                      <span className="tw-text-primary">
                        {response.questionnaire.title}
                      </span>
                      {response.questionnaire.description && (
                        <span className="text-muted tw-text-xs">
                          {response.questionnaire.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="portal-card-status-group">
                    <div className="tw-flex tw-flex-col tw-items-end tw-gap-0.5">
                      <span className="tw-badge">{config.label}</span>
                      <span className="text-muted tw-text-xs">
                        {response.submitted_at
                          ? `Submitted ${formatDate(response.submitted_at)}`
                          : `Updated ${formatDate(response.updated_at || response.created_at)}`
                        }
                      </span>
                    </div>
                    {isActionable && (
                      <ChevronRight className="icon-xs" />
                    )}
                  </div>
                </div>

                {/* Progress bar (if in progress) */}
                {response.status === 'in_progress' && response.progress > 0 && (
                  <div className="portal-card-progress">
                    <div className="tw-progress-track">
                      <div
                        className="tw-progress-bar"
                        style={{ width: `${response.progress}%` }}
                      />
                    </div>
                    <span className="text-muted tw-text-xs">
                      {response.progress}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </TableLayout>
  );
}
