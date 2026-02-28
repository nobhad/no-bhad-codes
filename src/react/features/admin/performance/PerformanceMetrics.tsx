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
  BarChart3,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatCurrencyCompact as formatCurrency } from '../../../../utils/format-utils';

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
  revenue: <DollarSign className="tw-h-5 tw-w-5" />,
  projects: <Briefcase className="tw-h-5 tw-w-5" />,
  tasks: <CheckCircle className="tw-h-5 tw-w-5" />,
  clients: <Users className="tw-h-5 tw-w-5" />,
  time: <Clock className="tw-h-5 tw-w-5" />,
  target: <Target className="tw-h-5 tw-w-5" />,
};

export function PerformanceMetrics({ onNavigate, getAuthToken, showNotification }: PerformanceMetricsProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PerformanceData>({
    kpis: [],
    teamMembers: [],
    projectPerformance: [],
    period: 'This Month',
  });
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Auth headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const loadPerformance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/performance?period=${period}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load performance data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  }, [period, getHeaders]);

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
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="tw-section">
      {/* Header */}
      <div className="perf-header">
        <h2 className="tw-heading perf-heading">Performance Dashboard</h2>
        <div className="perf-controls">
          <div className="tw-tab-list perf-tab-list">
            {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(period === p ? 'tw-tab-active' : 'tw-tab', 'perf-tab-capitalize')}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="tw-btn-secondary" onClick={loadPerformance} disabled={isLoading}>
            <RefreshCw className={cn('status-panel-refresh-icon', isLoading && 'status-panel-refresh-icon-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <button className="tw-btn-secondary status-retry-btn" onClick={loadPerformance}>
            Retry
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="tw-grid-stats tw-grid-6-cols">
        {isLoading
          ? <div className="tw-loading tw-col-span-full">Loading performance data...</div>
          : data.kpis.map((kpi) => (
              <div key={kpi.id} className="tw-stat-card">
                <div className="perf-kpi-header">
                  <span className="tw-stat-label">{kpi.name}</span>
                  <span className="tw-text-muted">
                    {KPI_ICONS[kpi.icon] || <BarChart3 className="perf-kpi-icon" />}
                  </span>
                </div>
                <div className="tw-stat-value perf-kpi-value">
                  {kpi.unit === '$' ? formatCurrency(kpi.value) : `${kpi.value}${kpi.unit}`}
                </div>
                <div className="perf-kpi-trend-row">
                  <div className="perf-kpi-trend">
                    {kpi.trend === 'up' ? (
                      <TrendingUp className="perf-trend-icon" />
                    ) : kpi.trend === 'down' ? (
                      <TrendingDown className="perf-trend-icon" />
                    ) : null}
                    <span className="tw-text-muted">
                      {formatPercentage(((kpi.value - kpi.previousValue) / kpi.previousValue) * 100)}
                    </span>
                  </div>
                  <span className="tw-text-muted">
                    Target: {kpi.unit === '$' ? formatCurrency(kpi.target) : `${kpi.target}${kpi.unit}`}
                  </span>
                </div>
                <div className="tw-progress-track perf-progress-mt">
                  <div
                    className="tw-progress-bar"
                    style={{
                      width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%`,
                      backgroundColor: kpi.value >= kpi.target ? 'var(--portal-text-light)' : 'var(--portal-text-muted)',
                    }}
                  />
                </div>
              </div>
            ))}
      </div>

      <div className="tw-grid-cards tw-grid-2-cols">
        {/* Team Performance */}
        <div className="tw-card perf-card">
          <div className="perf-card-header">
            <h3 className="tw-section-title">Team Performance</h3>
            <Award className="perf-card-icon" />
          </div>
          {isLoading ? (
            <div className="tw-loading">Loading team data...</div>
          ) : (
            <div>
              {data.teamMembers.map((member, index) => (
                <div key={member.id} className="tw-list-item">
                  <span className="tw-text-muted perf-rank">
                    {index + 1}
                  </span>
                  <div className="perf-member-info">
                    <div className="perf-member-name">{member.name}</div>
                    <div className="tw-text-muted perf-member-role">{member.role}</div>
                  </div>
                  <div className="perf-member-stats">
                    <div className="perf-member-revenue">
                      {formatCurrency(member.revenueGenerated)}
                    </div>
                    <div className="tw-text-muted perf-member-projects">
                      {member.projectsCompleted} projects
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Performance */}
        <div className="tw-card perf-card">
          <div className="perf-card-header">
            <h3 className="tw-section-title">Project Status</h3>
            <Briefcase className="perf-card-icon" />
          </div>
          {isLoading ? (
            <div className="tw-loading">Loading project data...</div>
          ) : (
            <div className="perf-projects-list">
              {data.projectPerformance.map((project) => (
                <div
                  key={project.id}
                  className="tw-card-hover"
                  onClick={() => onNavigate?.('projects', String(project.id))}
                >
                  <div className="perf-project-header">
                    <div>
                      <div className="perf-project-name">{project.name}</div>
                      <div className="tw-text-muted perf-project-client">{project.clientName}</div>
                    </div>
                    <span className="tw-badge">
                      {project.onTrack ? 'On Track' : 'At Risk'}
                    </span>
                  </div>
                  <div className="tw-text-muted perf-project-meta">
                    <span>Budget: {formatCurrency(project.budget)}</span>
                    <span>Spent: {formatCurrency(project.spent)}</span>
                    <span className="perf-ml-auto">{project.progress}%</span>
                  </div>
                  <div className="tw-progress-track perf-progress-mt">
                    <div
                      className="tw-progress-bar"
                      style={{
                        width: `${project.progress}%`,
                        backgroundColor: getProgressColor(project.progress, project.onTrack),
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
