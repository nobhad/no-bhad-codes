import * as React from 'react';
import { useMemo } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { useActiveSubtab, useSetSubtab, useSetSubtabActions } from '@react/contexts/SubtabContext';
import { LoadingState } from '@react/factories';

// Lazy load child components
const SystemStatusDashboard = React.lazy(() => import('../system-status/SystemStatusDashboard').then(m => ({ default: m.SystemStatusDashboard })));
const WorkflowsTable = React.lazy(() => import('../workflows/WorkflowsTable').then(m => ({ default: m.WorkflowsTable })));
const EmailTemplatesManager = React.lazy(() => import('../email-templates/EmailTemplatesManager').then(m => ({ default: m.EmailTemplatesManager })));
const BusinessConfiguration = React.lazy(() => import('./BusinessConfiguration').then(m => ({ default: m.BusinessConfiguration })));
const AuditLogViewer = React.lazy(() => import('./AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));
const SettingsOverview = React.lazy(() => import('./SettingsOverview').then(m => ({ default: m.SettingsOverview })));

interface SettingsManagerProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

type SettingsSubtab = 'overview' | 'configuration' | 'workflows' | 'email-templates' | 'audit-log' | 'system-health';

export function SettingsManager({ getAuthToken, showNotification, onNavigate }: SettingsManagerProps) {
  const containerRef = useFadeIn();
  const activeSubtab = useActiveSubtab<SettingsSubtab>();
  const setSubtab = useSetSubtab();
  const setSubtabActions = useSetSubtabActions();

  // Clear stale subtab actions on mount — child components manage their own actions
  React.useEffect(() => {
    setSubtabActions(null);
    return () => setSubtabActions(null);
  }, [setSubtabActions]);

  const sharedProps = useMemo(() => ({ onNavigate, getAuthToken, showNotification }), [onNavigate, getAuthToken, showNotification]);

  // Configuration subtab
  if (activeSubtab === 'configuration') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading configuration..." />}>
        <BusinessConfiguration {...sharedProps} />
      </React.Suspense>
    );
  }

  // Workflows subtab
  if (activeSubtab === 'workflows') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading workflows..." />}>
        <WorkflowsTable {...sharedProps} />
      </React.Suspense>
    );
  }

  // Email Templates subtab
  if (activeSubtab === 'email-templates') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading email templates..." />}>
        <EmailTemplatesManager {...sharedProps} />
      </React.Suspense>
    );
  }

  // Audit Log subtab
  if (activeSubtab === 'audit-log') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading audit log..." />}>
        <AuditLogViewer {...sharedProps} />
      </React.Suspense>
    );
  }

  // System Health subtab
  if (activeSubtab === 'system-health') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading system status..." />}>
        <SystemStatusDashboard {...sharedProps} />
      </React.Suspense>
    );
  }

  // Overview - lightweight snapshot cards
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <React.Suspense fallback={<LoadingState message="Loading settings overview..." />}>
        <SettingsOverview getAuthToken={getAuthToken} onSubtabNavigate={setSubtab} />
      </React.Suspense>
    </div>
  );
}
