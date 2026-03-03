/**
 * PortalQuestionnairesView
 * Client portal questionnaires list with status cards
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronRight, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { EmptyState } from '@react/components/portal/EmptyState';
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
    day: 'numeric',
  });
}

/**
 * Get status icon based on questionnaire status
 */
function getStatusIcon(status: QuestionnaireStatus): React.ReactNode {
  const iconClass = 'tw-h-3.5 tw-w-3.5';

  switch (status) {
    case 'submitted':
    case 'approved':
      return <CheckCircle className={cn(iconClass, 'tw-text-[var(--status-completed)]')} />;
    case 'in_progress':
      return <Clock className={cn(iconClass, 'tw-text-[var(--status-active)]')} />;
    case 'rejected':
      return <AlertCircle className={cn(iconClass, 'tw-text-[var(--status-cancelled)]')} />;
    default:
      return <FileText className={iconClass} />;
  }
}

/**
 * PortalQuestionnairesView Component
 */
export function PortalQuestionnairesView({
  getAuthToken,
  showNotification,
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
        'Content-Type': 'application/json',
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.QUESTIONNAIRES_MY_RESPONSES, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch questionnaires');
      }

      const data = await response.json();
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

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading questionnaires...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-state">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="btn-secondary" onClick={fetchResponses}>Retry</button>
      </div>
    );
  }

  // Empty state
  if (responses.length === 0) {
    return (
      <div ref={containerRef}>
        <EmptyState
          icon={<FileText className="tw-h-6 tw-w-6" />}
          message="No questionnaires assigned yet"
        />
      </div>
    );
  }

  // Calculate summary stats
  const completedCount = responses.filter(r => r.status === 'submitted' || r.status === 'approved').length;
  const pendingCount = responses.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
  const needsRevisionCount = responses.filter(r => r.status === 'rejected').length;

  return (
    <div ref={containerRef} className="tw-section">
      {/* Summary Cards */}
      <div className="tw-grid-stats">
        <div className="tw-stat-card">
          <span className="tw-stat-label">Completed</span>
          <span className="tw-stat-value qview-status-completed">{completedCount}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Pending</span>
          <span className="tw-stat-value qview-status-active">{pendingCount}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Needs Revision</span>
          <span className="tw-stat-value qview-status-cancelled">{needsRevisionCount}</span>
        </div>
      </div>

      {/* Questionnaire Cards */}
      <div ref={cardsRef} className="tw-section qview-no-gap">
        {responses.map((response) => {
          const config = QUESTIONNAIRE_STATUS_CONFIG[response.status];
          const isActionable = response.status !== 'submitted' && response.status !== 'approved';

          return (
            <div
              key={response.id}
              onClick={() => handleOpenQuestionnaire(response)}
              className="tw-card-hover qview-card"
            >
              {/* Left side: Icon and info */}
              <div className="qview-left">
                <div className="qview-icon">
                  {getStatusIcon(response.status)}
                </div>
                <div className="qview-info">
                  <span className="tw-text-primary qview-title">
                    {response.questionnaire.title}
                  </span>
                  {response.questionnaire.description && (
                    <span className="tw-text-muted qview-text-xs">
                      {response.questionnaire.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Middle: Progress bar (if in progress) */}
              {response.status === 'in_progress' && response.progress > 0 && (
                <div className="qview-progress-section">
                  <div className="tw-progress-track qview-progress-track">
                    <div
                      className="tw-progress-bar"
                      style={{ width: `${response.progress}%` }}
                    />
                  </div>
                  <span className="tw-text-muted qview-text-xs">
                    {response.progress}%
                  </span>
                </div>
              )}

              {/* Right side: Status and action */}
              <div className="qview-right">
                <div className="qview-status-col">
                  <span className="tw-badge">{config.label}</span>
                  <span className="tw-text-muted qview-text-xs">
                    {response.submitted_at
                      ? `Submitted ${formatDate(response.submitted_at)}`
                      : `Updated ${formatDate(response.updated_at || response.created_at)}`
                    }
                  </span>
                </div>
                {isActionable && (
                  <ChevronRight className="tw-h-3.5 tw-w-3.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
