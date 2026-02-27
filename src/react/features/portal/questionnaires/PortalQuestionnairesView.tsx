/**
 * PortalQuestionnairesView
 * Client portal questionnaires list with status cards
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronRight, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { QuestionnaireForm } from './QuestionnaireForm';
import { QUESTIONNAIRE_STATUS_CONFIG } from './types';
import type {
  PortalQuestionnairesProps,
  PortalQuestionnaireResponse,
  QuestionnaireStatus
} from './types';

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
      return <FileText className={cn(iconClass, 'tw-text-muted')} />;
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

      const response = await fetch('/api/questionnaires/my-responses', {
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
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading questionnaires...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={fetchResponses}>Retry</button>
      </div>
    );
  }

  // Empty state
  if (responses.length === 0) {
    return (
      <div ref={containerRef} className="tw-empty-state">
        <FileText className="tw-h-6 tw-w-6" />
        <p>No questionnaires assigned yet</p>
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
          <span className="tw-stat-value" style={{ color: 'var(--status-completed)' }}>{completedCount}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Pending</span>
          <span className="tw-stat-value" style={{ color: 'var(--status-active)' }}>{pendingCount}</span>
        </div>
        <div className="tw-stat-card">
          <span className="tw-stat-label">Needs Revision</span>
          <span className="tw-stat-value" style={{ color: 'var(--status-cancelled)' }}>{needsRevisionCount}</span>
        </div>
      </div>

      {/* Questionnaire Cards */}
      <div ref={cardsRef} className="tw-section" style={{ gap: 0 }}>
        {responses.map((response) => {
          const config = QUESTIONNAIRE_STATUS_CONFIG[response.status];
          const isActionable = response.status !== 'submitted' && response.status !== 'approved';

          return (
            <div
              key={response.id}
              onClick={() => handleOpenQuestionnaire(response)}
              className="tw-card-hover"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}
            >
              {/* Left side: Icon and info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div style={{ flexShrink: 0 }}>
                  {getStatusIcon(response.status)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', minWidth: 0 }}>
                  <span className="tw-text-primary" style={{ fontSize: '12px', fontWeight: 500 }}>
                    {response.questionnaire.title}
                  </span>
                  {response.questionnaire.description && (
                    <span className="tw-text-muted" style={{ fontSize: '10px' }}>
                      {response.questionnaire.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Middle: Progress bar (if in progress) */}
              {response.status === 'in_progress' && response.progress > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <div className="tw-progress-track" style={{ width: '64px' }}>
                    <div
                      className="tw-progress-bar"
                      style={{ width: `${response.progress}%` }}
                    />
                  </div>
                  <span className="tw-text-muted" style={{ fontSize: '10px' }}>
                    {response.progress}%
                  </span>
                </div>
              )}

              {/* Right side: Status and action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                  <span className="tw-badge">{config.label}</span>
                  <span className="tw-text-muted" style={{ fontSize: '10px' }}>
                    {response.submitted_at
                      ? `Submitted ${formatDate(response.submitted_at)}`
                      : `Updated ${formatDate(response.updated_at || response.created_at)}`
                    }
                  </span>
                </div>
                {isActionable && (
                  <ChevronRight className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
