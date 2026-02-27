import * as React from 'react';
import { useState, useEffect } from 'react';
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
  id: string;
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
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="tw-h-5 tw-w-5" />,
  projects: <Briefcase className="tw-h-5 tw-w-5" />,
  tasks: <CheckCircle className="tw-h-5 tw-w-5" />,
  clients: <Users className="tw-h-5 tw-w-5" />,
  time: <Clock className="tw-h-5 tw-w-5" />,
  target: <Target className="tw-h-5 tw-w-5" />,
};

export function PerformanceMetrics({ onNavigate }: PerformanceMetricsProps) {
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

  useEffect(() => {
    loadPerformance();
  }, [period]);

  async function loadPerformance() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/performance?period=${period}`);
      if (!response.ok) throw new Error('Failed to load performance data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount}`;
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="tw-heading" style={{ fontSize: '16px' }}>Performance Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="tw-tab-list" style={{ borderBottom: 'none' }}>
            {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={period === p ? 'tw-tab-active' : 'tw-tab'}
                style={{ textTransform: 'capitalize' }}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="tw-btn-secondary" onClick={loadPerformance} disabled={isLoading}>
            <RefreshCw style={{ width: '1rem', height: '1rem', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <button className="tw-btn-secondary" onClick={loadPerformance} style={{ marginLeft: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="tw-grid-stats" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {isLoading
          ? <div className="tw-loading" style={{ gridColumn: 'span 6' }}>Loading performance data...</div>
          : data.kpis.map((kpi) => (
              <div key={kpi.id} className="tw-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className="tw-stat-label">{kpi.name}</span>
                  <span className="tw-text-muted">
                    {KPI_ICONS[kpi.icon] || <BarChart3 style={{ width: '1.25rem', height: '1.25rem' }} />}
                  </span>
                </div>
                <div className="tw-stat-value" style={{ marginBottom: '0.25rem' }}>
                  {kpi.unit === '$' ? formatCurrency(kpi.value) : `${kpi.value}${kpi.unit}`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {kpi.trend === 'up' ? (
                      <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} />
                    ) : kpi.trend === 'down' ? (
                      <TrendingDown style={{ width: '0.75rem', height: '0.75rem' }} />
                    ) : null}
                    <span className="tw-text-muted">
                      {formatPercentage(((kpi.value - kpi.previousValue) / kpi.previousValue) * 100)}
                    </span>
                  </div>
                  <span className="tw-text-muted">
                    Target: {kpi.unit === '$' ? formatCurrency(kpi.target) : `${kpi.target}${kpi.unit}`}
                  </span>
                </div>
                <div className="tw-progress-track" style={{ marginTop: '0.5rem' }}>
                  <div
                    className="tw-progress-bar"
                    style={{
                      width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%`,
                      backgroundColor: kpi.value >= kpi.target ? '#ffffff' : 'rgba(255,255,255,0.6)',
                    }}
                  />
                </div>
              </div>
            ))}
      </div>

      <div className="tw-grid-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* Team Performance */}
        <div className="tw-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 className="tw-section-title">Team Performance</h3>
            <Award style={{ width: '1rem', height: '1rem', color: 'rgba(255,255,255,0.46)' }} />
          </div>
          {isLoading ? (
            <div className="tw-loading">Loading team data...</div>
          ) : (
            <div>
              {data.teamMembers.map((member, index) => (
                <div key={member.id} className="tw-list-item">
                  <span className="tw-text-muted" style={{ width: '1.5rem', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>
                    {index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{member.name}</div>
                    <div className="tw-text-muted" style={{ fontSize: '11px' }}>{member.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      {formatCurrency(member.revenueGenerated)}
                    </div>
                    <div className="tw-text-muted" style={{ fontSize: '11px' }}>
                      {member.projectsCompleted} projects
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Performance */}
        <div className="tw-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 className="tw-section-title">Project Status</h3>
            <Briefcase style={{ width: '1rem', height: '1rem', color: 'rgba(255,255,255,0.46)' }} />
          </div>
          {isLoading ? (
            <div className="tw-loading">Loading project data...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.projectPerformance.map((project) => (
                <div
                  key={project.id}
                  className="tw-card-hover"
                  onClick={() => onNavigate?.('projects', project.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{project.name}</div>
                      <div className="tw-text-muted" style={{ fontSize: '11px' }}>{project.clientName}</div>
                    </div>
                    <span className="tw-badge">
                      {project.onTrack ? 'On Track' : 'At Risk'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '11px' }} className="tw-text-muted">
                    <span>Budget: {formatCurrency(project.budget)}</span>
                    <span>Spent: {formatCurrency(project.spent)}</span>
                    <span style={{ marginLeft: 'auto' }}>{project.progress}%</span>
                  </div>
                  <div className="tw-progress-track" style={{ marginTop: '0.5rem' }}>
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
