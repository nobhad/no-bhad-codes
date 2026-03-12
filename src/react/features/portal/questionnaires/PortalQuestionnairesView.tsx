/**
 * PortalQuestionnairesView
 * Client portal questionnaires list with status cards
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { FileText, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { ProgressBar } from '@react/components/portal';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_QUESTIONNAIRES_FILTER_CONFIG } from '../shared/filterConfigs';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { QuestionnaireForm } from './QuestionnaireForm';
import { QUESTIONNAIRE_STATUS_CONFIG } from './types';
import type {
  PortalQuestionnairesProps,
  PortalQuestionnaireResponse,
  QuestionnaireStatus
} from './types';
import { formatCardDate } from '@react/utils/cardFormatters';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

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
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      response.questionnaire?.title?.toLowerCase().includes(s) ||
      response.questionnaire?.description?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(response.status)) return false;
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
  const cardsRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_SLOW, GSAP.STAGGER_DELAY_SHORT);

  const { data: responses, isLoading, error, refetch } = usePortalData<PortalQuestionnaireResponse[]>({
    getAuthToken,
    url: API_ENDPOINTS.QUESTIONNAIRES_MY_RESPONSES,
    transform: (raw) => (raw as Record<string, unknown>).responses as PortalQuestionnaireResponse[] || []
  });
  const items = useMemo(() => responses ?? [], [responses]);
  const [selectedResponse, setSelectedResponse] = useState<PortalQuestionnaireResponse | null>(null);

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

  const filteredResponses = useMemo(() => applyFilters(items), [applyFilters, items]);

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
    refetch();
  };

  /**
   * Handle successful form submission
   */
  const handleSubmitSuccess = () => {
    setSelectedResponse(null);
    refetch();
    showNotification?.('Questionnaire submitted successfully', 'success');
  };

  // Calculate summary stats - single pass instead of 3 separate filters
  // Must be called unconditionally (before any early returns) per Rules of Hooks
  const { completedCount, pendingCount, needsRevisionCount } = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let revision = 0;
    for (const r of items) {
      if (r.status === 'submitted' || r.status === 'approved') completed++;
      else if (r.status === 'pending' || r.status === 'in_progress') pending++;
      else if (r.status === 'rejected') revision++;
    }
    return { completedCount: completed, pendingCount: pending, needsRevisionCount: revision };
  }, [items]);

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

  return (
    <TableLayout
      containerRef={containerRef}
      title="QUESTIONNAIRES"
      stats={
        <TableStats items={[
          { value: items.length, label: 'total' },
          { value: completedCount, label: 'completed', variant: 'completed' },
          { value: pendingCount, label: 'pending', variant: 'pending' },
          { value: needsRevisionCount, label: 'needs revision', variant: 'overdue' }
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
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading questionnaires..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filteredResponses.length === 0 ? (
        <EmptyState
          icon={<FileText className="icon-lg" />}
          message={items.length === 0
            ? 'No questionnaires assigned yet. Questionnaires will appear here when Noelle sends them.'
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
                    <div className="flex flex-col gap-0.5">
                      <span className="text-primary">
                        {response.questionnaire.title}
                      </span>
                      {response.questionnaire.description && (
                        <span className="text-muted text-xs">
                          {response.questionnaire.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="portal-card-status-group">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="badge">{config.label}</span>
                      <span className="text-muted text-xs">
                        {response.submitted_at
                          ? `Submitted ${formatCardDate(response.submitted_at)}`
                          : `Updated ${formatCardDate(response.updated_at || response.created_at)}`
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
                  <ProgressBar value={response.progress} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </TableLayout>
  );
}
