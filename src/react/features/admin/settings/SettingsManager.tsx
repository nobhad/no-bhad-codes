import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState } from '@react/factories';

// Lazy load child components
const SystemStatusDashboard = React.lazy(() => import('../system-status/SystemStatusDashboard').then(m => ({ default: m.SystemStatusDashboard })));
const WorkflowsTable = React.lazy(() => import('../workflows/WorkflowsTable').then(m => ({ default: m.WorkflowsTable })));
const EmailTemplatesManager = React.lazy(() => import('../email-templates/EmailTemplatesManager').then(m => ({ default: m.EmailTemplatesManager })));
const BusinessConfiguration = React.lazy(() => import('./BusinessConfiguration').then(m => ({ default: m.BusinessConfiguration })));
const AuditLogViewer = React.lazy(() => import('./AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));

interface SettingsManagerProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

type SettingsSubtab = 'overview' | 'configuration' | 'workflows' | 'email-templates' | 'audit-log' | 'system-health';

export function SettingsManager({ getAuthToken, showNotification, onNavigate }: SettingsManagerProps) {
  const containerRef = useFadeIn();
  const [activeSubtab, setActiveSubtab] = useState<SettingsSubtab>('overview');

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as SettingsSubtab;
      const validSubtabs: SettingsSubtab[] = ['overview', 'configuration', 'workflows', 'email-templates', 'audit-log', 'system-health'];
      if (validSubtabs.includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('systemSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('systemSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  const sharedProps = { onNavigate, getAuthToken, showNotification };

  // Configuration subtab
  if (activeSubtab === 'configuration') {
    return (
      <div className="subtab-content-wrapper">
        <React.Suspense fallback={<LoadingState message="Loading configuration..." />}>
          <BusinessConfiguration {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Workflows subtab
  if (activeSubtab === 'workflows') {
    return (
      <div className="subtab-content-wrapper">
        <React.Suspense fallback={<LoadingState message="Loading workflows..." />}>
          <WorkflowsTable {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Email Templates subtab
  if (activeSubtab === 'email-templates') {
    return (
      <div className="subtab-content-wrapper">
        <React.Suspense fallback={<LoadingState message="Loading email templates..." />}>
          <EmailTemplatesManager {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Audit Log subtab
  if (activeSubtab === 'audit-log') {
    return (
      <div className="subtab-content-wrapper">
        <React.Suspense fallback={<LoadingState message="Loading audit log..." />}>
          <AuditLogViewer {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // System Health subtab
  if (activeSubtab === 'system-health') {
    return (
      <div className="subtab-content-wrapper">
        <React.Suspense fallback={<LoadingState message="Loading system status..." />}>
          <SystemStatusDashboard {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Overview - show configuration + system health stacked
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subtab-content-wrapper">
      <React.Suspense fallback={<LoadingState message="Loading configuration..." />}>
        <section className="overview-table-section">
          <BusinessConfiguration {...sharedProps} overviewMode />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading system status..." />}>
        <section className="overview-table-section">
          <SystemStatusDashboard {...sharedProps} />
        </section>
      </React.Suspense>
    </div>
  );
}
