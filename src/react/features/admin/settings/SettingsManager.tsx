import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
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

  const sharedProps = useMemo(() => ({ onNavigate, getAuthToken, showNotification }), [onNavigate, getAuthToken, showNotification]);

  const handleSubtabNavigate = useCallback((subtab: string) => {
    document.dispatchEvent(new CustomEvent('systemSubtabChange', { detail: { subtab } }));
  }, []);

  // Configuration subtab
  if (activeSubtab === 'configuration') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading configuration..." />}>
          <BusinessConfiguration {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Workflows subtab
  if (activeSubtab === 'workflows') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading workflows..." />}>
          <WorkflowsTable {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Email Templates subtab
  if (activeSubtab === 'email-templates') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading email templates..." />}>
          <EmailTemplatesManager {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Audit Log subtab
  if (activeSubtab === 'audit-log') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading audit log..." />}>
          <AuditLogViewer {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // System Health subtab
  if (activeSubtab === 'system-health') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading system status..." />}>
          <SystemStatusDashboard {...sharedProps} />
        </React.Suspense>
      </div>
    );
  }

  // Overview - lightweight snapshot cards
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      <React.Suspense fallback={<LoadingState message="Loading settings overview..." />}>
        <SettingsOverview getAuthToken={getAuthToken} onSubtabNavigate={handleSubtabNavigate} />
      </React.Suspense>
    </div>
  );
}
