import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useFadeIn } from '@react/hooks/useGsap';
import { useActiveSubtab, useSetSubtab } from '@react/contexts/SubtabContext';
import { LoadingState } from '@react/factories';

// Lazy load child components
const ProjectsTable = React.lazy(() => import('../projects/ProjectsTable').then(m => ({ default: m.ProjectsTable })));
const GlobalTasksTable = React.lazy(() => import('../global-tasks/GlobalTasksTable').then(m => ({ default: m.GlobalTasksTable })));
const AdHocRequestsTable = React.lazy(() => import('../ad-hoc-requests/AdHocRequestsTable').then(m => ({ default: m.AdHocRequestsTable })));

interface WorkDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type WorkSubtab = 'overview' | 'projects' | 'tasks' | 'ad-hoc-requests';

export function WorkDashboard({ onNavigate, getAuthToken, showNotification }: WorkDashboardProps) {
  const containerRef = useFadeIn();
  const location = useLocation();
  const activeSubtab = useActiveSubtab() as WorkSubtab;
  const setSubtab = useSetSubtab();

  // Honor location.state subtab when navigated from other pages (e.g., overview "View All Tasks")
  React.useEffect(() => {
    const state = location.state as { subtab?: WorkSubtab } | null;
    if (state?.subtab && ['overview', 'projects', 'tasks', 'ad-hoc-requests'].includes(state.subtab)) {
      setSubtab(state.subtab);
    }
  }, [location.state, setSubtab]);

  // Render individual views for specific subtabs
  if (activeSubtab === 'projects') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading projects..." />}>
        <ProjectsTable onNavigate={onNavigate} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'tasks') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading tasks..." />}>
        <GlobalTasksTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'ad-hoc-requests') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading requests..." />}>
        <AdHocRequestsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <React.Suspense fallback={<LoadingState message="Loading projects..." />}>
        <section className="overview-table-section">
          <ProjectsTable
            onNavigate={onNavigate}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading tasks..." />}>
        <section className="overview-table-section">
          <GlobalTasksTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading requests..." />}>
        <section className="overview-table-section">
          <AdHocRequestsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>
    </div>
  );
}
