/**
 * OverviewDashboard
 * Admin dashboard overview using existing portal CSS classes
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  FileText,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Mail,
  Briefcase,
  ArrowRight,
  LayoutGrid,
  List,
  RefreshCw,
  Plus,
  FileUp,
  Send,
  Inbox
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState } from '@react/factories';
import { cn } from '@react/lib/utils';
import { formatTimeAgo } from '@/utils/time-utils';
import { formatCurrency } from '@/utils/format-utils';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiFetch, unwrapApiData } from '@/utils/api-client';
import { formatErrorMessage } from '@/utils/error-utils';
import { useNavigate } from 'react-router-dom';

interface OverviewDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface ActivityItem {
  id: number;
  description: string;
  timestamp: string;
}

interface ProjectItem {
  id: number;
  name: string;
  client: string;
  client_id?: number;
  progress: number;
}

interface TaskItem {
  id: number;
  title: string;
  projectName: string;
  priority: string;
  status: string;
  dueDate?: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityColor(priority: string): string {
  switch (priority) {
  case 'urgent': return 'var(--status-cancelled)';
  case 'high': return 'var(--status-pending)';
  case 'medium': return 'var(--color-text-primary)';
  default: return 'var(--color-text-tertiary)';
  }
}

const KANBAN_COLUMNS = [
  { id: 'pending', label: 'TO DO' },
  { id: 'in_progress', label: 'IN PROGRESS' },
  { id: 'completed', label: 'DONE' }
] as const;

const TasksKanban = React.memo(({ tasks }: { tasks: TaskItem[] }) => {
  // Group tasks by status in a single pass instead of filtering per column
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<string, TaskItem[]> = {};
    for (const col of KANBAN_COLUMNS) grouped[col.id] = [];
    for (const task of tasks) {
      if (grouped[task.status]) grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  return (
    <div className="kanban-grid">
      {KANBAN_COLUMNS.map((column) => {
        const columnTasks = tasksByStatus[column.id] || [];
        return (
          <div key={column.id} className="kanban-column">
            <h4 className="field-label">{column.label}</h4>
            <div className="kanban-items">
              {columnTasks.map((task) => (
                <div key={task.id} className="kanban-card">
                  <span className="dashboard-status-dot" data-priority={task.priority} style={{ background: getPriorityColor(task.priority), borderColor: getPriorityColor(task.priority) }} />
                  <div>
                    <div className="activity-text">{task.title}</div>
                    <div className="activity-time">{task.projectName}</div>
                  </div>
                </div>
              ))}
              {columnTasks.length === 0 && (
                <div className="empty-state-small">No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export function OverviewDashboard({ onNavigate, getAuthToken: _getAuthToken }: OverviewDashboardProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasksView, setTasksView] = useState<'list' | 'kanban'>('list');

  const [attention, setAttention] = useState({ overdueInvoices: 0, pendingContracts: 0, unreadMessages: 0 });
  const [snapshot, setSnapshot] = useState({ activeProjects: 0, totalClients: 0, revenueMTD: 0, conversionRate: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProjectItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(API_ENDPOINTS.ADMIN.DASHBOARD);
      if (!response.ok) throw new Error('Failed to load dashboard data');
      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setAttention((payload.attention as typeof attention) || { overdueInvoices: 0, pendingContracts: 0, unreadMessages: 0 });
      setSnapshot((payload.snapshot as typeof snapshot) || { activeProjects: 0, totalClients: 0, revenueMTD: 0, conversionRate: 0 });
      setRecentActivity((payload.recentActivity as ActivityItem[]) || []);
      setActiveProjects((payload.activeProjects as ProjectItem[]) || []);
      setUpcomingTasks((payload.upcomingTasks as TaskItem[]) || []);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const attentionItems = useMemo(() => [
    { type: 'overdue_invoice', count: attention.overdueInvoices, label: 'Overdue Invoices', icon: <AlertTriangle />, action: () => onNavigate?.('invoices') },
    { type: 'pending_contract', count: attention.pendingContracts, label: 'Pending Contracts', icon: <FileText />, action: () => onNavigate?.('contracts') },
    { type: 'unread_message', count: attention.unreadMessages, label: 'Unread Messages', icon: <Mail />, action: () => onNavigate?.('messages') }
  ].filter(item => item.count > 0), [attention, onNavigate]);

  const snapshotMetrics = useMemo(() => [
    { label: 'Active Projects', value: snapshot.activeProjects, icon: <Briefcase /> },
    { label: 'Total Clients', value: snapshot.totalClients, icon: <Users /> },
    { label: 'Revenue MTD', value: formatCurrency(snapshot.revenueMTD), icon: <DollarSign /> },
    { label: 'Conversion Rate', value: `${snapshot.conversionRate}%`, icon: <TrendingUp /> }
  ], [snapshot]);

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="panel ovdash-error-panel">
        <p className="field-label ovdash-error-message">{error}</p>
        <button onClick={loadDashboardData} className="btn btn-outline">
          <RefreshCw /> Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overview-linear">
      {/* Stats Strip */}
      <div className="overview-stats-strip">
        {snapshotMetrics.map((metric) => (
          <div key={metric.label} className="stat-card">
            <div className="stat-card-top">
              {metric.icon}
              <span className="field-label">{metric.label}</span>
            </div>
            <div className="stat-value">{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Attention Items */}
      {attentionItems.length > 0 && (
        <div className="overview-stats-strip" style={{ gridTemplateColumns: `repeat(${attentionItems.length}, 1fr)` }}>
          {attentionItems.map((item) => (
            <button key={item.type} onClick={item.action} className="stat-card stat-card-clickable">
              <div className="stat-card-top">
                {item.icon}
                <span className="field-label">{item.label}</span>
              </div>
              <div className="stat-value stat-value-alert">{item.count}</div>
            </button>
          ))}
        </div>
      )}

      {/* Two Column Grid */}
      <div className="overview-grid">
        {/* Main Column */}
        <div className="overview-col-main">
          {/* Active Projects */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Briefcase className="panel-icon" />
                <span className="field-label">Active Projects</span>
              </div>
              <button onClick={() => onNavigate?.('projects')} className="panel-action">
                View All <ArrowRight className="panel-icon" />
              </button>
            </div>
            <div className="panel-body">
              {activeProjects.length === 0 ? (
                <div className="empty-state">
                  <Briefcase className="icon-xl" />
                  <span>No active projects</span>
                </div>
              ) : (
                <ul className="activity-feed">
                  {activeProjects.slice(0, 5).map((project) => (
                    <li key={project.id} className="activity-feed-item ovdash-clickable" onClick={() => onNavigate?.('project-detail', String(project.id))}>
                      <div className="activity-body">
                        <span className="activity-text">{project.name}</span>
                      </div>
                      <div className="progress-cell">
                        <div className="progress-bar ovdash-progress-width">
                          <div className="progress-fill" style={{ width: `${project.progress}%` }} />
                        </div>
                        <span className="progress-pct">{project.progress}%</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div className="panel">
            <div className="panel-header">
              <button
                className="panel-title panel-action"
                onClick={() => navigate('/work', { state: { subtab: 'tasks' } })}
              >
                <Clock className="panel-icon" />
                <span className="field-label">Upcoming Tasks</span>
              </button>
              <div className="view-toggle">
                <button onClick={() => setTasksView('list')} className={cn('icon-btn icon-btn-outline', tasksView === 'list' && 'is-active')} title="List view">
                  <List />
                </button>
                <button onClick={() => setTasksView('kanban')} className={cn('icon-btn icon-btn-outline', tasksView === 'kanban' && 'is-active')} title="Kanban view">
                  <LayoutGrid />
                </button>
              </div>
            </div>
            <div className="panel-body">
              {upcomingTasks.length === 0 ? (
                <div className="empty-state">
                  <Clock className="icon-xl" />
                  <span>No upcoming tasks</span>
                </div>
              ) : tasksView === 'list' ? (
                <ul className="activity-feed">
                  {upcomingTasks.slice(0, 5).map((task) => (
                    <li key={task.id} className="activity-feed-item">
                      <span className="dashboard-status-dot" data-priority={task.priority} style={{ background: getPriorityColor(task.priority), borderColor: getPriorityColor(task.priority) }} />
                      <div className="activity-body">
                        <span className="activity-text">{task.title}</span>
                        <span className="activity-time">{task.projectName}</span>
                      </div>
                      {task.dueDate && <span className="due-cell">{formatDate(task.dueDate)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <TasksKanban tasks={upcomingTasks} />
              )}
            </div>
          </div>
        </div>

        {/* Aside Column */}
        <div className="overview-col-aside">
          {/* Recent Activity */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="field-label">Recent Activity</span>
              </div>
            </div>
            <div className="panel-body--compact">
              {recentActivity.length === 0 ? (
                <div className="empty-state">
                  <Inbox className="icon-xl" />
                  <span>No recent activity</span>
                </div>
              ) : (
                <ul className="activity-feed">
                  {recentActivity.slice(0, 8).map((activity) => (
                    <li key={activity.id} className="activity-feed-item">
                      <span className="dashboard-status-dot dot-blue" />
                      <div className="activity-body">
                        <span className="activity-text">{activity.description}</span>
                        <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="field-label">Quick Actions</span>
              </div>
            </div>
            <div className="panel-body ovdash-quick-actions">
              <button onClick={() => onNavigate?.('projects')} className="btn-secondary btn-sm">
                <Plus /> New Project
              </button>
              <button onClick={() => onNavigate?.('clients')} className="btn-secondary btn-sm">
                <Users /> Add Client
              </button>
              <button onClick={() => onNavigate?.('invoices')} className="btn-secondary btn-sm">
                <FileUp /> Create Invoice
              </button>
              <button onClick={() => onNavigate?.('messages')} className="btn-secondary btn-sm">
                <Send /> Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
