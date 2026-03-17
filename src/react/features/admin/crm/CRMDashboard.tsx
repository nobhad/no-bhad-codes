import * as React from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { useActiveSubtab } from '@react/contexts/SubtabContext';
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
  const activeSubtab = useActiveSubtab() as CRMSubtab;

  // Render individual views for specific subtabs
  if (activeSubtab === 'leads') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading leads..." />}>
        <LeadsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'contacts') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading contacts..." />}>
        <ContactsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'messages') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading messages..." />}>
        <MessageView onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'clients') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading clients..." />}>
        <ClientsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
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
