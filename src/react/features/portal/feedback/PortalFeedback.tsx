/**
 * ===============================================
 * PORTAL FEEDBACK
 * ===============================================
 * @file src/react/features/portal/feedback/PortalFeedback.tsx
 *
 * Client-facing view of their feedback surveys.
 * Shows pending and completed surveys with ratings.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Star, CheckCircle, Clock } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { StatusBadge, type StatusVariant } from '@react/components/portal/StatusBadge';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiFetch } from '@/utils/api-client';
import { formatDate } from '@react/utils/formatDate';
import type { PortalViewProps } from '../types';

// ============================================
// Types
// ============================================

interface SurveyResponse {
  overall_rating: number | null;
  nps_score: number | null;
  submitted_at: string;
}

interface Survey {
  id: number;
  survey_type: string;
  status: string;
  token: string;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  projectName: string | null;
  response?: SurveyResponse;
}

export interface PortalFeedbackProps extends PortalViewProps {}

// ============================================
// Constants
// ============================================

const SURVEY_TYPE_LABELS: Record<string, string> = {
  project_completion: 'Project Completion',
  milestone_check_in: 'Milestone Check-In',
  nps_quarterly: 'Quarterly Check-In'
};

const STATUS_MAP: Record<string, StatusVariant> = {
  sent: 'pending',
  completed: 'completed',
  expired: 'cancelled'
};

const TOTAL_STARS = 5;

// ============================================
// COMPONENT
// ============================================

export function PortalFeedback(_props: PortalFeedbackProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSurveys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(API_ENDPOINTS.FEEDBACK_MY);
      if (!res.ok) throw new Error('Failed to load feedback');
      const json = await res.json();
      setSurveys(json.data?.surveys || json.surveys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const { pending, completed } = useMemo(() => ({
    pending: surveys.filter(s => s.status === 'sent'),
    completed: surveys.filter(s => s.status === 'completed')
  }), [surveys]);

  if (isLoading) return <LoadingState message="Loading feedback..." />;
  if (error) return <ErrorState message={error} onRetry={fetchSurveys} />;

  if (surveys.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={32} />}
        message="No feedback surveys yet"
      />
    );
  }

  return (
    <div ref={containerRef} className="portal-feedback">
      <div className="portal-section-header">
        <MessageSquare size={20} />
        <h2>Feedback</h2>
      </div>

      {/* Pending Surveys */}
      {pending.length > 0 && (
        <div className="portal-feedback-section">
          <h3>Pending Surveys</h3>
          <div className="portal-card-grid">
            {pending.map(survey => (
              <div key={survey.id} className="portal-card">
                <div className="portal-card-header">
                  <Clock size={16} />
                  <StatusBadge status={STATUS_MAP.sent}>
                    Awaiting Response
                  </StatusBadge>
                </div>
                <div className="portal-card-body">
                  <div className="portal-card-title">
                    {SURVEY_TYPE_LABELS[survey.survey_type] || survey.survey_type}
                  </div>
                  {survey.projectName && (
                    <div className="text-muted text-sm">{survey.projectName}</div>
                  )}
                  {survey.sent_at && (
                    <div className="text-muted text-sm">
                      Sent {formatDate(survey.sent_at)}
                    </div>
                  )}
                </div>
                <div className="portal-card-footer">
                  <a
                    href={`/feedback/${survey.token}`}
                    className="btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Complete Survey
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Surveys */}
      {completed.length > 0 && (
        <div className="portal-feedback-section">
          <h3>Completed</h3>
          <div className="portal-card-grid">
            {completed.map(survey => (
              <div key={survey.id} className="portal-card">
                <div className="portal-card-header">
                  <CheckCircle size={16} />
                  <StatusBadge status={STATUS_MAP.completed}>
                    Completed
                  </StatusBadge>
                </div>
                <div className="portal-card-body">
                  <div className="portal-card-title">
                    {SURVEY_TYPE_LABELS[survey.survey_type] || survey.survey_type}
                  </div>
                  {survey.projectName && (
                    <div className="text-muted text-sm">{survey.projectName}</div>
                  )}
                  {survey.response?.overall_rating != null && (
                    <div className="star-rating" style={{ marginTop: '8px' }}>
                      {Array.from({ length: TOTAL_STARS }, (_, i) => (
                        <Star
                          key={i}
                          size={16}
                          fill={i < (survey.response?.overall_rating ?? 0) ? 'var(--app-color-warning)' : 'none'}
                          stroke={i < (survey.response?.overall_rating ?? 0) ? 'var(--app-color-warning)' : 'var(--app-color-text-muted)'}
                        />
                      ))}
                    </div>
                  )}
                  {survey.completed_at && (
                    <div className="text-muted text-sm" style={{ marginTop: '4px' }}>
                      Submitted {formatDate(survey.completed_at)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
