import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState } from '@react/factories';

// Lazy load child components
const WorkflowsTable = React.lazy(() => import('./WorkflowsTable').then(m => ({ default: m.WorkflowsTable })));
const EmailTemplatesManager = React.lazy(() => import('../email-templates/EmailTemplatesManager').then(m => ({ default: m.EmailTemplatesManager })));

interface WorkflowsManagerProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

type WorkflowsSubtab = 'overview' | 'approvals' | 'triggers' | 'email-templates';

export function WorkflowsManager({ getAuthToken, showNotification, onNavigate }: WorkflowsManagerProps) {
  const containerRef = useFadeIn();
  const [activeSubtab, setActiveSubtab] = useState<WorkflowsSubtab>('overview');

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as WorkflowsSubtab;
      if (['overview', 'approvals', 'triggers', 'email-templates'].includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('workflowsSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('workflowsSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  // Individual subtab views
  if (activeSubtab === 'approvals' || activeSubtab === 'triggers') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading workflows..." />}>
          <WorkflowsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
          />
        </React.Suspense>
      </div>
    );
  }

  if (activeSubtab === 'email-templates') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading email templates..." />}>
          <EmailTemplatesManager
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
          />
        </React.Suspense>
      </div>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      <React.Suspense fallback={<LoadingState message="Loading workflows..." />}>
        <section className="overview-table-section">
          <WorkflowsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading email templates..." />}>
        <section className="overview-table-section">
          <EmailTemplatesManager
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
