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
const SystemHealthDashboard = lazyNamed(() => import('../features/admin/system-health').then(m => ({ SystemHealthDashboard: m.SystemHealthDashboard })));

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
const PortalMessagesView = lazyNamed(() => import('../features/portal/messages').then(m => ({ PortalMessagesView: m.PortalMessagesView })));
const PortalSettings = lazyNamed(() => import('../features/portal/settings').then(m => ({ PortalSettings: m.PortalSettings })));
const PortalHelp = lazyNamed(() => import('../features/portal/help').then(m => ({ PortalHelp: m.PortalHelp })));

// New consolidated portal views
const PortalDocuments = lazyNamed(() => import('../features/portal/documents').then(m => ({ PortalDocuments: m.PortalDocuments })));
const PortalFilesHub = lazyNamed(() => import('../features/portal/files-hub').then(m => ({ PortalFilesHub: m.PortalFilesHub })));
const PortalDeliverablesHub = lazyNamed(() => import('../features/portal/deliverables-hub').then(m => ({ PortalDeliverablesHub: m.PortalDeliverablesHub })));
const PortalContracts = lazyNamed(() => import('../features/portal/contracts').then(m => ({ PortalContracts: m.PortalContracts })));
const PortalRequestsHub = lazyNamed(() => import('../features/portal/requests-hub').then(m => ({ PortalRequestsHub: m.PortalRequestsHub })));
const ContentChecklistView = lazyNamed(() => import('../features/portal/content-requests').then(m => ({ ContentChecklistView: m.ContentChecklistView })));
const PaymentScheduleView = lazyNamed(() => import('../features/portal/payment-schedule').then(m => ({ PaymentScheduleView: m.PaymentScheduleView })));
const PortalProposals = lazyNamed(() => import('../features/portal/proposals').then(m => ({ PortalProposals: m.PortalProposals })));
const PortalProposalDetailView = lazyNamed(() => import('../features/portal/proposals').then(m => ({ PortalProposalDetail: m.PortalProposalDetail })));

// Agreements
const AgreementsList = lazyNamed(() => import('../features/portal/agreements').then(m => ({ AgreementsList: m.AgreementsList })));
const AgreementFlowLazy = React.lazy(() => import('../features/portal/agreements').then(m => ({ default: m.AgreementFlow })));

// Meetings (Portal)
const MeetingRequestsList = lazyNamed(() => import('../features/portal/meetings').then(m => ({ MeetingRequestsList: m.MeetingRequestsList })));

// Admin: Sequences, Meetings & Automations
const SequencesTable = lazyNamed(() => import('../features/admin/sequences').then(m => ({ SequencesTable: m.SequencesTable })));
const MeetingRequestsTable = lazyNamed(() => import('../features/admin/meetings').then(m => ({ MeetingRequestsTable: m.MeetingRequestsTable })));
const AutomationsTable = lazyNamed(() => import('../features/admin/automations').then(m => ({ AutomationsTable: m.AutomationsTable })));
const AutomationDetailLazy = React.lazy(() => import('../features/admin/automations').then(m => ({ default: m.AutomationDetailPanel })));

// Admin: Feedback & Testimonials
const FeedbackTable = lazyNamed(() => import('../features/admin/feedback').then(m => ({ FeedbackTable: m.FeedbackTable })));
const TestimonialsTable = lazyNamed(() => import('../features/admin/feedback').then(m => ({ TestimonialsTable: m.TestimonialsTable })));
const FeedbackAnalytics = lazyNamed(() => import('../features/admin/feedback').then(m => ({ FeedbackAnalytics: m.FeedbackAnalytics })));

// Portal: Feedback
const PortalFeedback = lazyNamed(() => import('../features/portal/feedback').then(m => ({ PortalFeedback: m.PortalFeedback })));

// Admin: Embed Widgets
const EmbedWidgetsManager = lazyNamed(() => import('../features/admin/embed').then(m => ({ EmbedWidgetsManager: m.EmbedWidgetsManager })));

// Admin: Agreement Builder & Onboarding Templates
const AgreementBuilder = lazyNamed(() => import('../features/admin/agreements').then(m => ({ AgreementBuilder: m.AgreementBuilder })));
const OnboardingTemplatesManager = lazyNamed(() => import('../features/admin/onboarding-templates').then(m => ({ OnboardingTemplatesManager: m.OnboardingTemplatesManager })));

// Portal: Auto-Pay
const AutoPaySettings = lazyNamed(() => import('../features/portal/auto-pay').then(m => ({ AutoPaySettings: m.AutoPaySettings })));

// Admin: Expenses & Retainers
const ExpensesTable = lazyNamed(() => import('../features/admin/expenses').then(m => ({ ExpensesTable: m.ExpensesTable })));
const RetainersTable = lazyNamed(() => import('../features/admin/retainers').then(m => ({ RetainersTable: m.RetainersTable })));

// Portal: Retainers
const PortalRetainers = lazyNamed(() => import('../features/portal/retainers').then(m => ({ PortalRetainers: m.PortalRetainers })));

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

function AutomationDetailRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const automationId = params.automationId ? parseInt(params.automationId, 10) : 0;

  if (!automationId) return <Navigate to="/automations" replace />;

  return <AutomationDetailLazy automationId={automationId} onBack={() => navigate('/automations')} />;
}

function AgreementFlowRoute() {
  const params = useParams();
  const agreementId = params.id ? parseInt(params.id, 10) : 0;

  if (!agreementId) return <Navigate to="/agreements" replace />;

  return <AgreementFlowLazy agreementId={agreementId} />;
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
          role === 'admin' ? (
            <LazyTabRoute tabId="invoices"><InvoicesTable /></LazyTabRoute>
          ) : (
            <Navigate to="/documents" replace />
          )
        } />
        <Route path="/files" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="files"><FilesManager /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="files"><PortalFilesHub /></LazyTabRoute>
          )
        } />
        <Route path="/questionnaires" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="questionnaires"><QuestionnairesTable /></LazyTabRoute>
          ) : (
            <Navigate to="/requests-hub" replace />
          )
        } />
        <Route path="/document-requests" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="document-requests"><DocumentRequestsTable /></LazyTabRoute>
          ) : (
            <Navigate to="/requests-hub" replace />
          )
        } />
        <Route path="/projects" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="projects"><ProjectsTable /></LazyTabRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } />
        <Route path="/settings" element={
          <LazyTabRoute tabId="settings">
            <PortalSettings />
          </LazyTabRoute>
        } />
        <Route path="/contracts" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="contracts"><ContractsTable /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="contracts"><PortalContracts /></LazyTabRoute>
          )
        } />

        {/* ========== ADMIN-ONLY ROUTES ========== */}
        <Route path="/analytics" element={<LazyTabRoute tabId="analytics"><AnalyticsDashboard /></LazyTabRoute>} />
        <Route path="/performance" element={<LazyTabRoute tabId="performance"><PerformanceMetrics /></LazyTabRoute>} />
        <Route path="/system-health" element={<LazyTabRoute tabId="system-health"><SystemHealthDashboard /></LazyTabRoute>} />
        <Route path="/work" element={<LazyTabRoute tabId="work"><WorkDashboard /></LazyTabRoute>} />
        <Route path="/crm" element={<LazyTabRoute tabId="crm"><CRMDashboard /></LazyTabRoute>} />
        <Route path="/documents" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="documents"><DocumentsDashboard /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="documents"><PortalDocuments /></LazyTabRoute>
          )
        } />
        <Route path="/leads" element={<LazyTabRoute tabId="leads"><LeadsTable /></LazyTabRoute>} />
        <Route path="/contacts" element={<LazyTabRoute tabId="contacts"><ContactsTable /></LazyTabRoute>} />
        <Route path="/clients" element={<LazyTabRoute tabId="clients"><ClientsTable /></LazyTabRoute>} />
        <Route path="/tasks" element={<LazyTabRoute tabId="tasks"><GlobalTasksTable /></LazyTabRoute>} />
        <Route path="/requests" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="requests"><AdHocRequestsTable /></LazyTabRoute>
          ) : (
            <Navigate to="/requests-hub" replace />
          )
        } />
        <Route path="/ad-hoc-requests" element={<Navigate to="/requests" replace />} />
        <Route path="/deliverables" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="deliverables"><DeliverablesTable /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="deliverables"><PortalDeliverablesHub /></LazyTabRoute>
          )
        } />
        <Route path="/proposals" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="proposals"><ProposalsTable /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="proposals"><PortalProposals /></LazyTabRoute>
          )
        } />
        <Route path="/proposals/:id" element={
          <LazyTabRoute tabId="proposals"><PortalProposalDetailView /></LazyTabRoute>
        } />
        {/* document-requests now handled above with role-based routing */}
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

        {/* ========== CLIENT-ONLY REDIRECTS ========== */}
        <Route path="/approvals" element={
          role === 'client' ? <Navigate to="/deliverables" replace /> : <Navigate to="/dashboard" replace />
        } />
        <Route path="/review" element={<Navigate to="/dashboard" replace />} />
        <Route path="/help" element={<LazyTabRoute tabId="help"><PortalHelp /></LazyTabRoute>} />

        {/* ========== NEW: Requests Hub, Content Requests, Payment Schedule ========== */}
        <Route path="/requests-hub" element={
          role === 'admin' ? (
            <Navigate to="/documents" replace />
          ) : (
            <LazyTabRoute tabId="requests-hub"><PortalRequestsHub /></LazyTabRoute>
          )
        } />
        <Route path="/content-requests" element={
          role === 'admin' ? (
            <Navigate to="/documents" replace />
          ) : (
            <LazyTabRoute tabId="content-requests"><ContentChecklistView /></LazyTabRoute>
          )
        } />
        <Route path="/payment-schedule" element={
          <LazyTabRoute tabId="payment-schedule">
            <PaymentScheduleView />
          </LazyTabRoute>
        } />

        {/* ========== MEETINGS ========== */}
        <Route path="/meetings" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="meetings"><MeetingRequestsTable /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="meetings"><MeetingRequestsList /></LazyTabRoute>
          )
        } />

        {/* ========== ADMIN: SEQUENCES & AUTOMATIONS ========== */}
        <Route path="/sequences" element={
          <LazyTabRoute tabId="sequences"><SequencesTable /></LazyTabRoute>
        } />
        <Route path="/automations" element={
          <LazyTabRoute tabId="automations"><AutomationsTable /></LazyTabRoute>
        } />
        <Route path="/automation-detail/:automationId" element={
          <LazyTabRoute tabId="automations"><AutomationDetailRoute /></LazyTabRoute>
        } />

        {/* ========== ADMIN: EXPENSES & RETAINERS ========== */}
        <Route path="/expenses" element={
          <LazyTabRoute tabId="expenses"><ExpensesTable /></LazyTabRoute>
        } />
        <Route path="/retainers" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="retainers"><RetainersTable /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="retainers"><PortalRetainers /></LazyTabRoute>
          )
        } />

        {/* ========== FEEDBACK & TESTIMONIALS ========== */}
        <Route path="/feedback" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="feedback"><FeedbackTable /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="feedback"><PortalFeedback /></LazyTabRoute>
          )
        } />
        <Route path="/feedback-analytics" element={
          <LazyTabRoute tabId="feedback"><FeedbackAnalytics /></LazyTabRoute>
        } />
        <Route path="/testimonials" element={
          <LazyTabRoute tabId="testimonials"><TestimonialsTable /></LazyTabRoute>
        } />

        {/* ========== EMBED WIDGETS ========== */}
        <Route path="/embed-widgets" element={
          <LazyTabRoute tabId="embed-widgets"><EmbedWidgetsManager /></LazyTabRoute>
        } />

        {/* ========== AGREEMENTS ========== */}
        <Route path="/agreements" element={
          role === 'admin' ? (
            <LazyTabRoute tabId="agreements"><AgreementBuilder /></LazyTabRoute>
          ) : (
            <LazyTabRoute tabId="agreements"><AgreementsList /></LazyTabRoute>
          )
        } />
        <Route path="/agreements/:id" element={
          <LazyTabRoute tabId="agreements">
            <AgreementFlowRoute />
          </LazyTabRoute>
        } />

        {/* ========== ONBOARDING TEMPLATES (Admin) ========== */}
        <Route path="/onboarding-templates" element={
          <LazyTabRoute tabId="onboarding-templates"><OnboardingTemplatesManager /></LazyTabRoute>
        } />

        {/* ========== AUTO-PAY (Client) ========== */}
        <Route path="/auto-pay" element={
          <LazyTabRoute tabId="auto-pay"><AutoPaySettings /></LazyTabRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
