import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
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
import { StatCard } from '@react/components/portal/StatCard';
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
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      {/* Header */}
      <div className="panel-header">
        <div className="view-toggle">
          {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={period === p ? 'is-active' : ''}
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
          data.kpis.map((kpi) => {
            const changePercent = formatPercentage(((kpi.value - kpi.previousValue) / kpi.previousValue) * 100);
            const targetLabel = kpi.unit === '$' ? formatCurrency(kpi.target) : `${kpi.target}${kpi.unit}`;
            return (
              <StatCard
                key={kpi.id}
                label={kpi.name}
                value={kpi.unit === '$' ? formatCurrency(kpi.value) : `${kpi.value}${kpi.unit}`}
                icon={KPI_ICONS[kpi.icon] || <BarChart3 className="icon-lg" />}
                meta={`${changePercent} | Target: ${targetLabel}`}
              />
            );
          })
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
                  <span>{index + 1}</span>
                  <div className="flex-1">
                    <div>{member.name}</div>
                    <div>{member.role}</div>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(member.revenueGenerated)}</div>
                    <div>{member.projectsCompleted} projects</div>
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
                      <div>{project.clientName}</div>
                    </div>
                    <span className="badge">
                      {project.onTrack ? 'On Track' : 'At Risk'}
                    </span>
                  </div>
                  <div className="source-row">
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
