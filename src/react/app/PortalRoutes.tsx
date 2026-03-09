/**
 * ===============================================
 * PORTAL ROUTES
 * ===============================================
 * @file src/react/app/PortalRoutes.tsx
 *
 * Defines all portal routes using React Router.
 * Each tab is a lazy-loaded route component.
 *
 * Uses React.lazy() with .then() to map named exports
 * to default exports for code splitting.
 */

import * as React from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PortalLayout } from './PortalLayout';
import { usePortalStore } from '../stores/portal-store';
import { usePortalAuth } from '../hooks/usePortalAuth';
import { LazyTabRoute } from './LazyTabRoute';

// ============================================
// HELPER: wrap named export for React.lazy
// ============================================

function lazyNamed<T extends React.ComponentType<Record<string, unknown>>>(
  loader: () => Promise<{ [key: string]: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    loader().then((mod) => {
      // Find the first exported component (skip mount/unmount/types)
      const key = Object.keys(mod).find(
        (k) => typeof mod[k] === 'function' && /^[A-Z]/.test(k)
      );
      if (!key) throw new Error('No component export found');
      return { default: mod[key] as T };
    })
  );
}

// ============================================
// LAZY ROUTE DEFINITIONS
// ============================================

// Admin Dashboards
const OverviewDashboard = lazyNamed(() => import('../features/admin/overview').then(m => ({ OverviewDashboard: m.OverviewDashboard })));
const AnalyticsDashboard = lazyNamed(() => import('../features/admin/analytics').then(m => ({ AnalyticsDashboard: m.AnalyticsDashboard })));
const PerformanceMetrics = lazyNamed(() => import('../features/admin/performance').then(m => ({ PerformanceMetrics: m.PerformanceMetrics })));

// Admin Group Dashboards
const WorkDashboard = lazyNamed(() => import('../features/admin/work').then(m => ({ WorkDashboard: m.WorkDashboard })));
const CRMDashboard = lazyNamed(() => import('../features/admin/crm').then(m => ({ CRMDashboard: m.CRMDashboard })));
const DocumentsDashboard = lazyNamed(() => import('../features/admin/documents').then(m => ({ DocumentsDashboard: m.DocumentsDashboard })));

// Admin CRM
const LeadsTable = lazyNamed(() => import('../features/admin/leads').then(m => ({ LeadsTable: m.LeadsTable })));
const ContactsTable = lazyNamed(() => import('../features/admin/contacts').then(m => ({ ContactsTable: m.ContactsTable })));
const ClientsTable = lazyNamed(() => import('../features/admin/clients').then(m => ({ ClientsTable: m.ClientsTable })));
const MessageView = lazyNamed(() => import('../features/admin/messaging').then(m => ({ MessageView: m.MessageView })));

// Admin Work
const ProjectsTable = lazyNamed(() => import('../features/admin/projects').then(m => ({ ProjectsTable: m.ProjectsTable })));
const GlobalTasksTable = lazyNamed(() => import('../features/admin/global-tasks').then(m => ({ GlobalTasksTable: m.GlobalTasksTable })));
const AdHocRequestsTable = lazyNamed(() => import('../features/admin/ad-hoc-requests').then(m => ({ AdHocRequestsTable: m.AdHocRequestsTable })));
const DeliverablesTable = lazyNamed(() => import('../features/admin/deliverables').then(m => ({ DeliverablesTable: m.DeliverablesTable })));

// Admin Finance
const InvoicesTable = lazyNamed(() => import('../features/admin/invoices').then(m => ({ InvoicesTable: m.InvoicesTable })));
const ContractsTable = lazyNamed(() => import('../features/admin/contracts').then(m => ({ ContractsTable: m.ContractsTable })));
const ProposalsTable = lazyNamed(() => import('../features/admin/proposals').then(m => ({ ProposalsTable: m.ProposalsTable })));

// Admin Documents & Files
const DocumentRequestsTable = lazyNamed(() => import('../features/admin/document-requests').then(m => ({ DocumentRequestsTable: m.DocumentRequestsTable })));
const FilesManager = lazyNamed(() => import('../features/admin/files').then(m => ({ FilesManager: m.FilesManager })));
const QuestionnairesTable = lazyNamed(() => import('../features/admin/questionnaires').then(m => ({ QuestionnairesTable: m.QuestionnairesTable })));

// Admin Settings & System
const KnowledgeBase = lazyNamed(() => import('../features/admin/knowledge-base').then(m => ({ KnowledgeBase: m.KnowledgeBase })));
const SettingsManager = lazyNamed(() => import('../features/admin/settings').then(m => ({ SettingsManager: m.SettingsManager })));
const EmailTemplatesManager = lazyNamed(() => import('../features/admin/email-templates').then(m => ({ EmailTemplatesManager: m.EmailTemplatesManager })));
const DeletedItemsTable = lazyNamed(() => import('../features/admin/deleted-items').then(m => ({ DeletedItemsTable: m.DeletedItemsTable })));

// Admin Advanced
const TimeTrackingTable = lazyNamed(() => import('../features/admin/time-tracking').then(m => ({ TimeTrackingTable: m.TimeTrackingTable })));
const DesignReviewTable = lazyNamed(() => import('../features/admin/design-review').then(m => ({ DesignReviewTable: m.DesignReviewTable })));
const AdHocAnalytics = lazyNamed(() => import('../features/admin/ad-hoc-analytics').then(m => ({ AdHocAnalytics: m.AdHocAnalytics })));
const DataQualityDashboard = lazyNamed(() => import('../features/admin/data-quality').then(m => ({ DataQualityDashboard: m.DataQualityDashboard })));
const IntegrationsManager = lazyNamed(() => import('../features/admin/integrations').then(m => ({ IntegrationsManager: m.IntegrationsManager })));
const WebhooksManager = lazyNamed(() => import('../features/admin/webhooks').then(m => ({ WebhooksManager: m.WebhooksManager })));
const WorkflowsManager = lazyNamed(() => import('../features/admin/workflows').then(m => ({ WorkflowsManager: m.WorkflowsManager })));

// Admin Detail Views (loaded directly, wrapped below)
const ClientDetailLazy = React.lazy(() =>
  import('../features/admin/client-detail').then(m => ({ default: m.ClientDetail }))
);
const ProjectDetailLazy = React.lazy(() =>
  import('../features/admin/project-detail').then(m => ({ default: m.ProjectDetail }))
);

// Portal / Client Modules
const PortalDashboard = lazyNamed(() => import('../features/portal/dashboard').then(m => ({ PortalDashboard: m.PortalDashboard })));
const PortalFilesManager = lazyNamed(() => import('../features/portal/files').then(m => ({ PortalFilesManager: m.PortalFilesManager })));
const PortalMessagesView = lazyNamed(() => import('../features/portal/messages').then(m => ({ PortalMessagesView: m.PortalMessagesView })));
const PortalInvoicesTable = lazyNamed(() => import('../features/portal/invoices').then(m => ({ PortalInvoicesTable: m.PortalInvoicesTable })));
const PortalSettings = lazyNamed(() => import('../features/portal/settings').then(m => ({ PortalSettings: m.PortalSettings })));
const PortalQuestionnairesView = lazyNamed(() => import('../features/portal/questionnaires').then(m => ({ PortalQuestionnairesView: m.PortalQuestionnairesView })));
const PortalProjectsList = lazyNamed(() => import('../features/portal/projects').then(m => ({ PortalProjectsList: m.PortalProjectsList })));
const PortalContracts = lazyNamed(() => import('../features/portal/contracts').then(m => ({ PortalContracts: m.PortalContracts })));
const PortalAdHocRequests = lazyNamed(() => import('../features/portal/ad-hoc-requests').then(m => ({ PortalAdHocRequests: m.PortalAdHocRequests })));
const PortalDeliverables = lazyNamed(() => import('../features/portal/deliverables').then(m => ({ PortalDeliverables: m.PortalDeliverables })));
const PortalProposals = lazyNamed(() => import('../features/portal/proposals').then(m => ({ PortalProposals: m.PortalProposals })));
const PortalApprovals = lazyNamed(() => import('../features/portal/approvals').then(m => ({ PortalApprovals: m.PortalApprovals })));
const PortalHelp = lazyNamed(() => import('../features/portal/help').then(m => ({ PortalHelp: m.PortalHelp })));
const PortalPreview = lazyNamed(() => import('../features/portal/preview').then(m => ({ PortalPreview: m.PortalPreview })));

// ============================================
// DETAIL VIEW WRAPPERS
// ============================================

function ClientDetailRoute(props: Record<string, unknown>) {
  const params = useParams();
  const navigate = useNavigate();
  const clientId = props.clientId as number | undefined
    ?? (params.clientId ? parseInt(params.clientId, 10) : 0);

  if (!clientId) return <Navigate to="/clients" replace />;

  return (
    <ClientDetailLazy
      clientId={clientId}
      onBack={() => navigate('/clients')}
      onViewProject={(pid: number) => navigate(`/project-detail/${pid}`)}
      onNavigate={(tab: string, entityId?: string) => {
        navigate(entityId ? `/${tab}/${entityId}` : `/${tab}`);
      }}
      {...props}
    />
  );
}

function ProjectDetailRoute(props: Record<string, unknown>) {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = props.projectId as number | undefined
    ?? (params.projectId ? parseInt(params.projectId, 10) : 0);
  const initialTab = (searchParams.get('tab') || undefined) as string | undefined;

  if (!projectId) return <Navigate to="/projects" replace />;

  return (
    <ProjectDetailLazy
      projectId={projectId}
      initialTab={initialTab}
      onBack={() => navigate('/projects')}
      onNavigate={(tab: string, entityId?: string) => {
        navigate(entityId ? `/${tab}/${entityId}` : `/${tab}`);
      }}
      {...props}
    />
  );
}

// ============================================
// AUTH GUARD
// ============================================

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = usePortalAuth();
  const hasRendered = React.useRef(false);

  // Track if we successfully rendered once (auth was valid from sessionStorage)
  if (isAuthenticated) {
    hasRendered.current = true;
  }

  // Auth loads synchronously from sessionStorage — typically instant
  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  // If we rendered successfully before but auth was cleared (e.g. validate
  // race condition), redirect via useEffect to avoid infinite render loops.
  if (!isAuthenticated && hasRendered.current) {
    return <SessionExpiredRedirect />;
  }

  // Server validates JWT before rendering /dashboard. If the session
  // was never valid on this page load, render nothing (the server
  // should have redirected before we got here).
  if (!isAuthenticated) {
    return <SessionExpiredRedirect />;
  }

  return <>{children}</>;
}

/**
 * Handles redirect to login via useEffect (not during render)
 * to prevent infinite reload loops.
 */
function SessionExpiredRedirect() {
  React.useEffect(() => {
    window.location.href = '/#/portal';
  }, []);

  return (
    <div className="auth-loading">
      <div className="loading-spinner" />
    </div>
  );
}

// ============================================
// ROUTE COMPONENT
// ============================================

export function PortalRoutes() {
  const role = usePortalStore((s) => s.role);

  return (
    <Routes>
      <Route
        element={
          <RequireAuth>
            <PortalLayout />
          </RequireAuth>
        }
      >
        {/* Default redirect */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* ========== SHARED ROUTES ========== */}
        <Route path="/dashboard" element={
          <LazyTabRoute tabId="dashboard">
            {role === 'admin' ? <OverviewDashboard /> : <PortalDashboard />}
          </LazyTabRoute>
        } />
        <Route path="/messages" element={
          <LazyTabRoute tabId="messages">
            {role === 'admin' ? <MessageView /> : <PortalMessagesView />}
          </LazyTabRoute>
        } />
        <Route path="/invoices" element={
          <LazyTabRoute tabId="invoices">
            {role === 'admin' ? <InvoicesTable /> : <PortalInvoicesTable />}
          </LazyTabRoute>
        } />
        <Route path="/files" element={
          <LazyTabRoute tabId="files">
            {role === 'admin' ? <FilesManager /> : <PortalFilesManager />}
          </LazyTabRoute>
        } />
        <Route path="/questionnaires" element={
          <LazyTabRoute tabId="questionnaires">
            {role === 'admin' ? <QuestionnairesTable /> : <PortalQuestionnairesView />}
          </LazyTabRoute>
        } />
        <Route path="/projects" element={
          <LazyTabRoute tabId="projects">
            {role === 'admin' ? <ProjectsTable /> : <PortalProjectsList />}
          </LazyTabRoute>
        } />
        <Route path="/settings" element={
          <LazyTabRoute tabId="settings">
            <PortalSettings />
          </LazyTabRoute>
        } />
        <Route path="/contracts" element={
          <LazyTabRoute tabId="contracts">
            {role === 'admin' ? <ContractsTable /> : <PortalContracts />}
          </LazyTabRoute>
        } />

        {/* ========== ADMIN-ONLY ROUTES ========== */}
        <Route path="/analytics" element={<LazyTabRoute tabId="analytics"><AnalyticsDashboard /></LazyTabRoute>} />
        <Route path="/performance" element={<LazyTabRoute tabId="performance"><PerformanceMetrics /></LazyTabRoute>} />
        <Route path="/work" element={<LazyTabRoute tabId="work"><WorkDashboard /></LazyTabRoute>} />
        <Route path="/crm" element={<LazyTabRoute tabId="crm"><CRMDashboard /></LazyTabRoute>} />
        <Route path="/documents" element={<LazyTabRoute tabId="documents"><DocumentsDashboard /></LazyTabRoute>} />
        <Route path="/leads" element={<LazyTabRoute tabId="leads"><LeadsTable /></LazyTabRoute>} />
        <Route path="/contacts" element={<LazyTabRoute tabId="contacts"><ContactsTable /></LazyTabRoute>} />
        <Route path="/clients" element={<LazyTabRoute tabId="clients"><ClientsTable /></LazyTabRoute>} />
        <Route path="/tasks" element={<LazyTabRoute tabId="tasks"><GlobalTasksTable /></LazyTabRoute>} />
        <Route path="/requests" element={
          <LazyTabRoute tabId="requests">
            {role === 'admin' ? <AdHocRequestsTable /> : <PortalAdHocRequests />}
          </LazyTabRoute>
        } />
        <Route path="/ad-hoc-requests" element={<Navigate to="/requests" replace />} />
        <Route path="/deliverables" element={
          <LazyTabRoute tabId="deliverables">
            {role === 'admin' ? <DeliverablesTable /> : <PortalDeliverables />}
          </LazyTabRoute>
        } />
        <Route path="/proposals" element={
          <LazyTabRoute tabId="proposals">
            {role === 'admin' ? <ProposalsTable /> : <PortalProposals />}
          </LazyTabRoute>
        } />
        <Route path="/document-requests" element={<LazyTabRoute tabId="document-requests"><DocumentRequestsTable /></LazyTabRoute>} />
        <Route path="/support" element={<LazyTabRoute tabId="support"><KnowledgeBase /></LazyTabRoute>} />
        <Route path="/system" element={<LazyTabRoute tabId="system"><SettingsManager /></LazyTabRoute>} />
        <Route path="/email-templates" element={<LazyTabRoute tabId="email-templates"><EmailTemplatesManager /></LazyTabRoute>} />
        {/* Direct-access routes (reachable via command palette / deep link, not in sidebar or subtabs) */}
        <Route path="/deleted-items" element={<LazyTabRoute tabId="deleted-items"><DeletedItemsTable /></LazyTabRoute>} />
        <Route path="/time-tracking" element={<LazyTabRoute tabId="time-tracking"><TimeTrackingTable /></LazyTabRoute>} />
        <Route path="/design-review" element={<LazyTabRoute tabId="design-review"><DesignReviewTable /></LazyTabRoute>} />
        <Route path="/ad-hoc-analytics" element={<LazyTabRoute tabId="ad-hoc-analytics"><AdHocAnalytics /></LazyTabRoute>} />
        <Route path="/data-quality" element={<LazyTabRoute tabId="data-quality"><DataQualityDashboard /></LazyTabRoute>} />
        <Route path="/integrations" element={<LazyTabRoute tabId="integrations"><IntegrationsManager /></LazyTabRoute>} />
        <Route path="/webhooks" element={<LazyTabRoute tabId="webhooks"><WebhooksManager /></LazyTabRoute>} />
        <Route path="/workflows" element={<LazyTabRoute tabId="workflows"><WorkflowsManager /></LazyTabRoute>} />

        {/* Detail Views */}
        <Route path="/client-detail" element={<LazyTabRoute tabId="client-detail"><ClientDetailRoute /></LazyTabRoute>} />
        <Route path="/client-detail/:clientId" element={<LazyTabRoute tabId="client-detail"><ClientDetailRoute /></LazyTabRoute>} />
        <Route path="/project-detail" element={<LazyTabRoute tabId="project-detail"><ProjectDetailRoute /></LazyTabRoute>} />
        <Route path="/project-detail/:projectId" element={<LazyTabRoute tabId="project-detail"><ProjectDetailRoute /></LazyTabRoute>} />

        {/* ========== CLIENT-ONLY ROUTES ========== */}
        <Route path="/approvals" element={<LazyTabRoute tabId="approvals"><PortalApprovals /></LazyTabRoute>} />
        <Route path="/review" element={<LazyTabRoute tabId="review"><PortalPreview /></LazyTabRoute>} />
        <Route path="/help" element={<LazyTabRoute tabId="help"><PortalHelp /></LazyTabRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
