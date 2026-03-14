import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState } from '@react/factories';

// Lazy load child components
const LeadsTable = React.lazy(() => import('../leads/LeadsTable').then(m => ({ default: m.LeadsTable })));
const ContactsTable = React.lazy(() => import('../contacts/ContactsTable').then(m => ({ default: m.ContactsTable })));
const MessageView = React.lazy(() => import('../messaging/MessageView').then(m => ({ default: m.MessageView })));
const MessagesTable = React.lazy(() => import('../messaging/MessagesTable').then(m => ({ default: m.MessagesTable })));
const ClientsTable = React.lazy(() => import('../clients/ClientsTable').then(m => ({ default: m.ClientsTable })));

interface CRMDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type CRMSubtab = 'overview' | 'leads' | 'contacts' | 'messages' | 'clients';

export function CRMDashboard({ onNavigate, getAuthToken, showNotification }: CRMDashboardProps) {
  const containerRef = useFadeIn();
  const [activeSubtab, setActiveSubtab] = useState<CRMSubtab>('overview');

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as CRMSubtab;
      if (['overview', 'leads', 'contacts', 'messages', 'clients'].includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('crmSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('crmSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  // Render individual views for specific subtabs
  if (activeSubtab === 'leads') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading leads..." />}>
          <LeadsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
        </React.Suspense>
      </div>
    );
  }

  if (activeSubtab === 'contacts') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading contacts..." />}>
          <ContactsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
        </React.Suspense>
      </div>
    );
  }

  if (activeSubtab === 'messages') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading messages..." />}>
          <MessageView onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
        </React.Suspense>
      </div>
    );
  }

  if (activeSubtab === 'clients') {
    return (
      <div className="section">
        <React.Suspense fallback={<LoadingState message="Loading clients..." />}>
          <ClientsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
        </React.Suspense>
      </div>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      <React.Suspense fallback={<LoadingState message="Loading leads..." />}>
        <section className="overview-table-section">
          <LeadsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading messages..." />}>
        <section className="overview-table-section">
          <MessagesTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading clients..." />}>
        <section className="overview-table-section">
          <ClientsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading contacts..." />}>
        <section className="overview-table-section">
          <ContactsTable
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
