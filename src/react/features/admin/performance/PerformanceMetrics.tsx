import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Award,
  Users,
  DollarSign,
  Briefcase,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState } from '@react/components/portal/EmptyState';
import { formatCurrencyCompact as formatCurrency } from '@/utils/format-utils';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiFetch, unwrapApiData } from '@/utils/api-client';
import { formatErrorMessage } from '@/utils/error-utils';

interface PerformanceKPI {
  id: string;
  name: string;
  value: number;
  target: number;
  previousValue: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  icon: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  projectsCompleted: number;
  revenueGenerated: number;
  tasksCompleted: number;
  avgResponseTime: string;
  rating: number;
}

interface ProjectPerformance {
  id: number;
  name: string;
  clientName: string;
  budget: number;
  spent: number;
  progress: number;
  onTrack: boolean;
  dueDate: string;
}

interface PerformanceData {
  kpis: PerformanceKPI[];
  teamMembers: TeamMember[];
  projectPerformance: ProjectPerformance[];
  period: string;
}

interface PerformanceMetricsProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="icon-lg" />,
  projects: <Briefcase className="icon-lg" />,
  tasks: <CheckCircle className="icon-lg" />,
  clients: <Users className="icon-lg" />,
  time: <Clock className="icon-lg" />,
  target: <Target className="icon-lg" />
};

export function PerformanceMetrics({ onNavigate, getAuthToken: _getAuthToken }: PerformanceMetricsProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PerformanceData>({
    kpis: [],
    teamMembers: [],
    projectPerformance: [],
    period: 'This Month'
  });
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const loadPerformance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_ENDPOINTS.ADMIN.PERFORMANCE}?period=${period}`);
      if (!response.ok) throw new Error('Failed to load performance data');
      const payload = unwrapApiData<PerformanceData>(await response.json());
      setData(payload);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to load performance data'));
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  function getProgressColor(progress: number, isOnTrack: boolean): string {
    if (!isOnTrack) return 'var(--status-cancelled)';
    if (progress >= 75) return 'var(--status-completed)';
    if (progress >= 50) return 'var(--status-active)';
    return 'var(--status-pending)';
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      {/* Header */}
      <div className="panel-header">
        <div className="view-toggle">
          {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn('view-toggle-btn', period === p && 'is-active')}
            >
              {p}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={loadPerformance} disabled={isLoading}>
          <RefreshCw className={cn('icon-sm', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-state">
          <span>{error}</span>
          <button className="btn-secondary" onClick={loadPerformance}>
            Retry
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="stats-grid">
        {isLoading ? (
          <LoadingState message="Loading performance data..." />
        ) : (
          data.kpis.map((kpi) => (
            <div key={kpi.id} className="stat-card">
              <div className="stat-card-top">
                <span className="field-label">{kpi.name}</span>
                <span className="text-muted">
                  {KPI_ICONS[kpi.icon] || <BarChart3 className="icon-lg" />}
                </span>
              </div>
              <div className="stat-value">
                {kpi.unit === '$' ? formatCurrency(kpi.value) : `${kpi.value}${kpi.unit}`}
              </div>
              <div className="stat-card-trend">
                {kpi.trend === 'up' ? (
                  <TrendingUp className="icon-xs" />
                ) : kpi.trend === 'down' ? (
                  <TrendingDown className="icon-xs" />
                ) : null}
                <span className="text-muted">
                  {formatPercentage(((kpi.value - kpi.previousValue) / kpi.previousValue) * 100)}
                </span>
                <span className="text-muted">
                  Target: {kpi.unit === '$' ? formatCurrency(kpi.target) : `${kpi.target}${kpi.unit}`}
                </span>
              </div>
              <div className="progress-bar-sm">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%`,
                    backgroundColor: kpi.value >= kpi.target ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="analytics-card-grid">
        {/* Team Performance */}
        <div className="portal-card">
          <div className="data-table-header">
            <h3>
              <Award className="icon-sm" />
              <span className="title-full">Team Performance</span>
            </h3>
          </div>
          {isLoading ? (
            <LoadingState message="Loading team data..." />
          ) : (
            <div className="source-list">
              {data.teamMembers.map((member, index) => (
                <div key={member.id} className="list-item">
                  <span className="text-muted">{index + 1}</span>
                  <div className="flex-1">
                    <div>{member.name}</div>
                    <div className="text-muted">{member.role}</div>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(member.revenueGenerated)}</div>
                    <div className="text-muted">{member.projectsCompleted} projects</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Performance */}
        <div className="portal-card">
          <div className="data-table-header">
            <h3>
              <Briefcase className="icon-sm" />
              <span className="title-full">Project Status</span>
            </h3>
          </div>
          {isLoading ? (
            <LoadingState message="Loading project data..." />
          ) : (
            <div className="source-list">
              {data.projectPerformance.map((project) => (
                <div
                  key={project.id}
                  className="source-item cursor-pointer"
                  onClick={() => onNavigate?.('projects', String(project.id))}
                >
                  <div className="source-row">
                    <div>
                      <div>{project.name}</div>
                      <div className="text-muted">{project.clientName}</div>
                    </div>
                    <span className="badge">
                      {project.onTrack ? 'On Track' : 'At Risk'}
                    </span>
                  </div>
                  <div className="source-row text-muted">
                    <span>Budget: {formatCurrency(project.budget)}</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="progress-bar-sm">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${project.progress}%`,
                        backgroundColor: getProgressColor(project.progress, project.onTrack)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PerformanceMetrics;
