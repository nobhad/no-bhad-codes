import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';

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
  const [activeSubtab, setActiveSubtab] = useState<WorkSubtab>('overview');

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as WorkSubtab;
      if (['overview', 'projects', 'tasks', 'ad-hoc-requests'].includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('workSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('workSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  // Render individual views for specific subtabs
  if (activeSubtab === 'projects') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading projects...</div>}>
        <ProjectsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'tasks') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading tasks...</div>}>
        <GlobalTasksTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'ad-hoc-requests') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading requests...</div>}>
        <AdHocRequestsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="overview-tables">
      <React.Suspense fallback={<div className="loading-state">Loading projects...</div>}>
        <section className="overview-table-section">
          <ProjectsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<div className="loading-state">Loading tasks...</div>}>
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

      <React.Suspense fallback={<div className="loading-state">Loading requests...</div>}>
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

export default WorkDashboard;
