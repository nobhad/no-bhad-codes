import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';

// Lazy load child components
const InvoicesTable = React.lazy(() => import('../invoices/InvoicesTable').then(m => ({ default: m.InvoicesTable })));
const ContractsTable = React.lazy(() => import('../contracts/ContractsTable').then(m => ({ default: m.ContractsTable })));
const DocumentRequestsTable = React.lazy(() => import('../document-requests/DocumentRequestsTable').then(m => ({ default: m.DocumentRequestsTable })));
const QuestionnairesTable = React.lazy(() => import('../questionnaires/QuestionnairesTable').then(m => ({ default: m.QuestionnairesTable })));

interface DocumentsDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type DocumentsSubtab = 'overview' | 'invoices' | 'contracts' | 'document-requests' | 'questionnaires';

export function DocumentsDashboard({ onNavigate, getAuthToken, showNotification }: DocumentsDashboardProps) {
  const containerRef = useFadeIn();
  const [activeSubtab, setActiveSubtab] = useState<DocumentsSubtab>('overview');

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as DocumentsSubtab;
      if (['overview', 'invoices', 'contracts', 'document-requests', 'questionnaires'].includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('documentsSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('documentsSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  // Render individual views for specific subtabs
  if (activeSubtab === 'invoices') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading invoices...</div>}>
        <InvoicesTable
          onNavigate={onNavigate}
          getAuthToken={getAuthToken}
          showNotification={showNotification}
        />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'contracts') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading contracts...</div>}>
        <ContractsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'document-requests') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading document requests...</div>}>
        <DocumentRequestsTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'questionnaires') {
    return (
      <React.Suspense fallback={<div className="loading-state">Loading questionnaires...</div>}>
        <QuestionnairesTable onNavigate={onNavigate} getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="overview-tables">
      <React.Suspense fallback={<div className="loading-state">Loading invoices...</div>}>
        <section className="overview-table-section">
          <InvoicesTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<div className="loading-state">Loading contracts...</div>}>
        <section className="overview-table-section">
          <ContractsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<div className="loading-state">Loading document requests...</div>}>
        <section className="overview-table-section">
          <DocumentRequestsTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<div className="loading-state">Loading questionnaires...</div>}>
        <section className="overview-table-section">
          <QuestionnairesTable
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

export default DocumentsDashboard;
