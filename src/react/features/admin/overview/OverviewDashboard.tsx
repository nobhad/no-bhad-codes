/**
 * OverviewDashboard
 * Admin dashboard overview with brutalist design
 * Transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  FileText,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  Mail,
  Briefcase,
  ArrowRight,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@react/lib/utils';

interface AttentionItem {
  type: 'overdue_invoice' | 'pending_contract' | 'new_lead' | 'unread_message';
  count: number;
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

interface SnapshotMetric {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  entityType: string;
  entityId: string;
}

interface ActiveProject {
  id: string;
  name: string;
  client: string;
  status: string;
  progress: number;
  dueDate?: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  projectName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  dueDate?: string;
}

interface OverviewDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

// Brutalist panel styles
const panelStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--portal-border-color)',
  padding: 'var(--space-4)',
};

const panelHoverStyle: React.CSSProperties = {
  ...panelStyle,
  cursor: 'pointer',
  transition: 'border-color var(--transition-faster)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--portal-text-muted)',
  marginBottom: 'var(--space-4)',
  fontFamily: 'var(--font-mono)',
};

const statValueStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-2xl)',
  fontWeight: 600,
  color: 'var(--portal-text-light)',
  fontFamily: 'var(--font-mono)',
  lineHeight: 1.2,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--portal-text-muted)',
  fontFamily: 'var(--font-mono)',
  marginTop: 'var(--space-1)',
};

export function OverviewDashboard({ onNavigate }: OverviewDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasksView, setTasksView] = useState<'list' | 'kanban'>('list');

  // Dashboard data state
  const [attention, setAttention] = useState({
    overdueInvoices: 0,
    pendingContracts: 0,
    newLeadsThisWeek: 0,
    unreadMessages: 0,
  });
  const [snapshot, setSnapshot] = useState({
    activeProjects: 0,
    totalClients: 0,
    revenueMTD: 0,
    conversionRate: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dashboard');
      if (!response.ok) throw new Error('Failed to load dashboard data');

      const data = await response.json();

      setAttention(data.attention || {
        overdueInvoices: 0,
        pendingContracts: 0,
        newLeadsThisWeek: 0,
        unreadMessages: 0,
      });
      setSnapshot(data.snapshot || {
        activeProjects: 0,
        totalClients: 0,
        revenueMTD: 0,
        conversionRate: 0,
      });
      setRecentActivity(data.recentActivity || []);
      setActiveProjects(data.activeProjects || []);
      setUpcomingTasks(data.upcomingTasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  const attentionItems: AttentionItem[] = [
    {
      type: 'overdue_invoice',
      count: attention.overdueInvoices,
      label: 'Overdue Invoices',
      icon: <AlertTriangle style={{ width: 16, height: 16 }} />,
      action: () => onNavigate?.('invoices'),
    },
    {
      type: 'pending_contract',
      count: attention.pendingContracts,
      label: 'Pending Contracts',
      icon: <FileText style={{ width: 16, height: 16 }} />,
      action: () => onNavigate?.('contracts'),
    },
    {
      type: 'unread_message',
      count: attention.unreadMessages,
      label: 'Unread Messages',
      icon: <Mail style={{ width: 16, height: 16 }} />,
      action: () => onNavigate?.('messaging'),
    },
  ];

  const snapshotMetrics: SnapshotMetric[] = [
    {
      label: 'Active Projects',
      value: snapshot.activeProjects,
      icon: <Briefcase style={{ width: 16, height: 16 }} />,
    },
    {
      label: 'Total Clients',
      value: snapshot.totalClients,
      icon: <Users style={{ width: 16, height: 16 }} />,
    },
    {
      label: 'Revenue MTD',
      value: formatCurrency(snapshot.revenueMTD),
      icon: <DollarSign style={{ width: 16, height: 16 }} />,
    },
    {
      label: 'Conversion Rate',
      value: `${snapshot.conversionRate}%`,
      icon: <TrendingUp style={{ width: 16, height: 16 }} />,
    },
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div style={{ ...panelStyle, textAlign: 'center', padding: 'var(--space-12)' }}>
        <p style={{ color: 'var(--portal-text-secondary)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
          {error}
        </p>
        <button
          onClick={loadDashboardData}
          style={{
            background: 'transparent',
            border: '1px solid var(--portal-text-light)',
            color: 'var(--portal-text-light)',
            padding: 'var(--space-2) var(--space-4)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Attention Items */}
      <section>
        <h2 style={sectionTitleStyle}>Needs Attention</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {attentionItems.filter(item => item.count > 0).map((item) => (
            <button
              key={item.type}
              onClick={item.action}
              style={{
                ...panelHoverStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--portal-text-muted)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--portal-border-color)'}
            >
              <div style={{ color: 'var(--portal-text-muted)' }}>{item.icon}</div>
              <div>
                <div style={statValueStyle}>{item.count}</div>
                <div style={statLabelStyle}>{item.label}</div>
              </div>
            </button>
          ))}
          {attentionItems.filter(item => item.count > 0).length === 0 && (
            <div style={{ ...panelStyle, gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
              <CheckCircle style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: 0.5, color: 'var(--portal-text-light)' }} />
              <p style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>
                All caught up! Nothing needs your attention.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Snapshot Metrics */}
      <section>
        <h2 style={sectionTitleStyle}>Snapshot</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {snapshotMetrics.map((metric) => (
            <div key={metric.label} style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--portal-text-muted)' }}>{metric.icon}</span>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {metric.label}
                </span>
              </div>
              <div style={statValueStyle}>{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Active Projects */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Active Projects</h2>
            <button
              onClick={() => onNavigate?.('projects')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--portal-text-muted)',
                fontSize: 'var(--font-size-2xs)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              View All <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
          <div style={panelStyle}>
            {activeProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                No active projects
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activeProjects.slice(0, 5).map((project, index) => (
                  <div
                    key={project.id}
                    onClick={() => onNavigate?.('projects', project.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) 0',
                      borderTop: index > 0 ? '1px solid var(--portal-border-subtle)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--portal-text-light)', fontFamily: 'var(--font-mono)' }}>
                        {project.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-0-5)' }}>
                        {project.client}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ width: '80px', height: '4px', background: 'var(--portal-border-subtle)' }}>
                        <div style={{ width: `${project.progress}%`, height: '100%', background: 'var(--portal-text-light)' }} />
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', minWidth: '32px' }}>
                        {project.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 style={sectionTitleStyle}>Recent Activity</h2>
          <div style={panelStyle}>
            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                No recent activity
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentActivity.slice(0, 8).map((activity, index) => (
                  <div
                    key={activity.id}
                    style={{
                      padding: 'var(--space-2-5) 0',
                      borderTop: index > 0 ? '1px solid var(--portal-border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--portal-text-light)', fontFamily: 'var(--font-mono)' }}>
                      {activity.description}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-1)' }}>
                      {formatRelativeTime(activity.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Upcoming Tasks */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Upcoming Tasks</h2>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <button
              onClick={() => setTasksView('list')}
              style={{
                background: 'transparent',
                border: '1px solid',
                borderColor: tasksView === 'list' ? 'var(--portal-text-light)' : 'var(--portal-border-color)',
                color: tasksView === 'list' ? 'var(--portal-text-light)' : 'var(--portal-text-muted)',
                padding: 'var(--space-1-5)',
                cursor: 'pointer',
              }}
              title="List view"
            >
              <List style={{ width: 14, height: 14 }} />
            </button>
            <button
              onClick={() => setTasksView('kanban')}
              style={{
                background: 'transparent',
                border: '1px solid',
                borderColor: tasksView === 'kanban' ? 'var(--portal-text-light)' : 'var(--portal-border-color)',
                color: tasksView === 'kanban' ? 'var(--portal-text-light)' : 'var(--portal-text-muted)',
                padding: 'var(--space-1-5)',
                cursor: 'pointer',
              }}
              title="Kanban view"
            >
              <LayoutGrid style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {tasksView === 'list' ? (
          <div style={panelStyle}>
            {upcomingTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                No upcoming tasks
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {upcomingTasks.map((task, index) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) 0',
                      borderTop: index > 0 ? '1px solid var(--portal-border-subtle)' : 'none',
                    }}
                  >
                    <span style={{
                      width: '8px',
                      height: '8px',
                      background: getPriorityColor(task.priority),
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--portal-text-light)', fontFamily: 'var(--font-mono)' }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-0-5)' }}>
                        {task.projectName}
                      </div>
                    </div>
                    {task.dueDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <Clock style={{ width: 12, height: 12 }} />
                        {formatDate(task.dueDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <TasksKanban tasks={upcomingTasks} />
        )}
      </section>
    </div>
  );
}

function TasksKanban({ tasks }: { tasks: UpcomingTask[] }) {
  const columns = [
    { id: 'pending', label: 'TO DO' },
    { id: 'in_progress', label: 'IN PROGRESS' },
    { id: 'completed', label: 'DONE' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {columns.map((column) => (
        <div key={column.id} style={panelStyle}>
          <h3 style={{ ...sectionTitleStyle, marginBottom: 'var(--space-3)' }}>{column.label}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {tasks
              .filter((task) => task.status === column.id)
              .map((task) => (
                <div
                  key={task.id}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--portal-border-color)',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--portal-border-color)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--portal-border-color)'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      background: getPriorityColor(task.priority),
                      flexShrink: 0,
                      marginTop: 'var(--space-1-5)',
                    }} />
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--portal-text-light)', fontFamily: 'var(--font-mono)' }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--portal-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-1)' }}>
                        {task.projectName}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            {tasks.filter((task) => task.status === column.id).length === 0 && (
              <div style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--portal-text-muted)', padding: 'var(--space-6)', fontFamily: 'var(--font-mono)' }}>
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  const skeletonStyle: React.CSSProperties = {
    background: 'var(--portal-bg-hover)',
    border: '1px solid var(--portal-border-subtle)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...skeletonStyle, height: '80px' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ ...skeletonStyle, height: '72px' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ ...skeletonStyle, height: '240px' }} />
        <div style={{ ...skeletonStyle, height: '240px' }} />
      </div>
      <div style={{ ...skeletonStyle, height: '200px' }} />
    </div>
  );
}

// Utility functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(timestamp);
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'var(--status-cancelled)';
    case 'high': return 'var(--status-pending)';
    case 'medium': return 'var(--portal-text-light)';
    case 'low': return 'var(--portal-text-muted)';
    default: return 'var(--portal-text-muted)';
  }
}

export default OverviewDashboard;
