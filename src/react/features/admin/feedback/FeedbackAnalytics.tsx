/**
 * ===============================================
 * FEEDBACK ANALYTICS
 * ===============================================
 * @file src/react/features/admin/feedback/FeedbackAnalytics.tsx
 *
 * Admin analytics dashboard for NPS score, average
 * ratings, and survey completion metrics.
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Star, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn } from '@react/hooks/useGsap';
import { apiFetch } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

// ============================================
// Types
// ============================================

interface NpsBreakdown {
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  score: number;
}

interface Analytics {
  nps: NpsBreakdown;
  averageRatings: {
    overall: number;
    communication: number;
    quality: number;
    timeliness: number;
  };
  totalSurveysSent: number;
  totalCompleted: number;
  completionRate: number;
  sampleSizeWarning: boolean;
}

// ============================================
// Constants
// ============================================

const NPS_GREEN_THRESHOLD = 50;
const NPS_YELLOW_THRESHOLD = 0;
const PERCENTAGE_MULTIPLIER = 100;
const TOTAL_STARS = 5;

// ============================================
// Helpers
// ============================================

function getNpsColor(score: number): string {
  if (score >= NPS_GREEN_THRESHOLD) return 'var(--app-color-success)';
  if (score >= NPS_YELLOW_THRESHOLD) return 'var(--app-color-warning)';
  return 'var(--app-color-danger)';
}

function renderStarRating(value: number): React.ReactNode {
  const rounded = Math.round(value * 10) / 10;
  return (
    <div className="analytics-rating-row">
      <span className="analytics-rating-value">{rounded.toFixed(1)}</span>
      <span className="star-rating">
        {Array.from({ length: TOTAL_STARS }, (_, i) => (
          <Star
            key={i}
            size={16}
            fill={i < Math.round(value) ? 'var(--app-color-warning)' : 'none'}
            stroke={i < Math.round(value) ? 'var(--app-color-warning)' : 'var(--app-color-text-muted)'}
          />
        ))}
      </span>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function FeedbackAnalytics() {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(API_ENDPOINTS.FEEDBACK_ANALYTICS);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setAnalytics(json.data?.analytics || json.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) return <LoadingState message="Loading analytics..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAnalytics} />;
  if (!analytics) return <EmptyState icon={<BarChart3 size={32} />} message="No analytics data" />;

  const { nps, averageRatings, totalSurveysSent, totalCompleted, completionRate, sampleSizeWarning } = analytics;
  const npsColor = getNpsColor(nps.score);
  const completionPct = Math.round(completionRate * PERCENTAGE_MULTIPLIER);

  return (
    <div ref={containerRef} className="analytics-dashboard">
      <div className="analytics-header">
        <BarChart3 size={20} />
        <h2>Feedback Analytics</h2>
      </div>

      <div className="analytics-grid">
        {/* NPS Score Card */}
        <div className="analytics-card analytics-card--large">
          <h3 className="analytics-card-title">Net Promoter Score</h3>
          <div className="nps-score" style={{ color: npsColor }}>
            {nps.score}
          </div>

          {sampleSizeWarning && (
            <div className="analytics-warning">
              <AlertTriangle size={14} />
              <span>Fewer than 30 responses — NPS may not be statistically significant</span>
            </div>
          )}

          <div className="nps-breakdown">
            <div className="nps-segment nps-segment--promoter">
              <span className="nps-segment-label">Promoters (9-10)</span>
              <span className="nps-segment-count">{nps.promoters}</span>
            </div>
            <div className="nps-segment nps-segment--passive">
              <span className="nps-segment-label">Passives (7-8)</span>
              <span className="nps-segment-count">{nps.passives}</span>
            </div>
            <div className="nps-segment nps-segment--detractor">
              <span className="nps-segment-label">Detractors (0-6)</span>
              <span className="nps-segment-count">{nps.detractors}</span>
            </div>
          </div>
        </div>

        {/* Ratings Card */}
        <div className="analytics-card">
          <h3 className="analytics-card-title">Average Ratings</h3>
          <div className="analytics-ratings-list">
            <div className="analytics-rating-item">
              <span className="analytics-rating-label">Overall</span>
              {renderStarRating(averageRatings.overall)}
            </div>
            <div className="analytics-rating-item">
              <span className="analytics-rating-label">Communication</span>
              {renderStarRating(averageRatings.communication)}
            </div>
            <div className="analytics-rating-item">
              <span className="analytics-rating-label">Quality</span>
              {renderStarRating(averageRatings.quality)}
            </div>
            <div className="analytics-rating-item">
              <span className="analytics-rating-label">Timeliness</span>
              {renderStarRating(averageRatings.timeliness)}
            </div>
          </div>
        </div>

        {/* Survey Stats Card */}
        <div className="analytics-card">
          <h3 className="analytics-card-title">Survey Performance</h3>
          <div className="analytics-stat-grid">
            <div className="analytics-stat">
              <Users size={18} />
              <div className="analytics-stat-value">{totalSurveysSent}</div>
              <div className="analytics-stat-label">Surveys Sent</div>
            </div>
            <div className="analytics-stat">
              <TrendingUp size={18} />
              <div className="analytics-stat-value">{totalCompleted}</div>
              <div className="analytics-stat-label">Completed</div>
            </div>
            <div className="analytics-stat">
              <BarChart3 size={18} />
              <div className="analytics-stat-value">{completionPct}%</div>
              <div className="analytics-stat-label">Response Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
