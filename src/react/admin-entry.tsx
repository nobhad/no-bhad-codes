/**
 * React Admin Entry Point
 * This file is loaded as a separate entry point to avoid preamble detection issues
 * It registers React components for use by vanilla TypeScript code
 */

// Import pre-generated Tailwind CSS for React components
import './styles/tailwind-generated.css';
// Note: Button styles (tw-btn-*) are now in portal-buttons.css (base portal styles)

import { registerReactComponent } from './registry';
import { createLogger } from '../utils/logger';

const logger = createLogger('AdminEntry');

// Detail views
import { mountClientDetail, unmountClientDetail } from './features/admin/client-detail';
import { mountProjectDetail, unmountProjectDetail } from './features/admin/project-detail';

// Table components
import { mountProjectsTable, unmountProjectsTable } from './features/admin/projects';
import { mountClientsTable, unmountClientsTable } from './features/admin/clients';
import { mountLeadsTable, unmountLeadsTable } from './features/admin/leads';
import { mountInvoicesTable, unmountInvoicesTable } from './features/admin/invoices';
import { mountContactsTable, unmountContactsTable } from './features/admin/contacts';
import { mountContractsTable, unmountContractsTable } from './features/admin/contracts';
import { mountDeliverablesTable, unmountDeliverablesTable } from './features/admin/deliverables';
import { mountDocumentRequestsTable, unmountDocumentRequestsTable } from './features/admin/document-requests';
import { mountQuestionnairesTable, unmountQuestionnairesTable } from './features/admin/questionnaires';
import { mountAdHocRequestsTable, unmountAdHocRequestsTable } from './features/admin/ad-hoc-requests';
import { mountProposalsTable, unmountProposalsTable } from './features/admin/proposals';
import { mountGlobalTasksTable, unmountGlobalTasksTable } from './features/admin/global-tasks';
import { mountDeletedItemsTable, unmountDeletedItemsTable } from './features/admin/deleted-items';

// Feature components
import { mountTasksManager, unmountTasksManager } from './features/admin/tasks';
import { mountWorkflowsManager, unmountWorkflowsManager } from './features/admin/workflows';
import { mountFilesManager, unmountFilesManager } from './features/admin/files';
import { mountEmailTemplatesManager, unmountEmailTemplatesManager } from './features/admin/email-templates';
import { mountKnowledgeBase, unmountKnowledgeBase } from './features/admin/knowledge-base';
import { mountMessagingPanel, unmountMessagingPanel } from './features/admin/messaging';
import { mountTimeTrackingPanel, unmountTimeTrackingPanel } from './features/admin/time-tracking';
import { mountDesignReviewPanel, unmountDesignReviewPanel } from './features/admin/design-review';
import { mountSystemStatusPanel, unmountSystemStatusPanel } from './features/admin/system-status';

// Analytics components
import { mountOverviewDashboard, unmountOverviewDashboard } from './features/admin/overview';
import { mountAnalyticsDashboard, unmountAnalyticsDashboard } from './features/admin/analytics';
import { mountAdHocAnalytics, unmountAdHocAnalytics } from './features/admin/ad-hoc-analytics';
import { mountPerformanceMetrics, unmountPerformanceMetrics } from './features/admin/performance';

// Dashboard components (parent tab groups)
import { mountWorkDashboard, unmountWorkDashboard } from './features/admin/work';
import { mountCRMDashboard, unmountCRMDashboard } from './features/admin/crm';
import { mountDocumentsDashboard, unmountDocumentsDashboard } from './features/admin/documents';

// Register detail views
registerReactComponent('clientDetail', {
  mount: mountClientDetail,
  unmount: unmountClientDetail
});

registerReactComponent('projectDetail', {
  mount: mountProjectDetail,
  unmount: unmountProjectDetail
});

// Register table components
registerReactComponent('projectsTable', {
  mount: mountProjectsTable,
  unmount: unmountProjectsTable
});

registerReactComponent('clientsTable', {
  mount: mountClientsTable,
  unmount: unmountClientsTable
});

registerReactComponent('leadsTable', {
  mount: mountLeadsTable,
  unmount: unmountLeadsTable
});

registerReactComponent('invoicesTable', {
  mount: mountInvoicesTable,
  unmount: unmountInvoicesTable
});

registerReactComponent('contactsTable', {
  mount: mountContactsTable,
  unmount: unmountContactsTable
});

registerReactComponent('contractsTable', {
  mount: mountContractsTable,
  unmount: unmountContractsTable
});

registerReactComponent('deliverablesTable', {
  mount: mountDeliverablesTable,
  unmount: unmountDeliverablesTable
});

registerReactComponent('documentRequestsTable', {
  mount: mountDocumentRequestsTable,
  unmount: unmountDocumentRequestsTable
});

registerReactComponent('questionnairesTable', {
  mount: mountQuestionnairesTable,
  unmount: unmountQuestionnairesTable
});

registerReactComponent('adHocRequestsTable', {
  mount: mountAdHocRequestsTable,
  unmount: unmountAdHocRequestsTable
});

registerReactComponent('proposalsTable', {
  mount: mountProposalsTable,
  unmount: unmountProposalsTable
});

registerReactComponent('globalTasksTable', {
  mount: mountGlobalTasksTable,
  unmount: unmountGlobalTasksTable
});

registerReactComponent('deletedItemsTable', {
  mount: mountDeletedItemsTable,
  unmount: unmountDeletedItemsTable
});

// Register feature components
registerReactComponent('tasksManager', {
  mount: mountTasksManager,
  unmount: unmountTasksManager
});

registerReactComponent('workflowsManager', {
  mount: mountWorkflowsManager,
  unmount: unmountWorkflowsManager
});

registerReactComponent('filesManager', {
  mount: mountFilesManager,
  unmount: unmountFilesManager
});

registerReactComponent('emailTemplatesManager', {
  mount: mountEmailTemplatesManager,
  unmount: unmountEmailTemplatesManager
});

registerReactComponent('knowledgeBase', {
  mount: mountKnowledgeBase,
  unmount: unmountKnowledgeBase
});

registerReactComponent('messagingPanel', {
  mount: mountMessagingPanel,
  unmount: unmountMessagingPanel
});

registerReactComponent('timeTrackingPanel', {
  mount: mountTimeTrackingPanel,
  unmount: unmountTimeTrackingPanel
});

registerReactComponent('designReviewPanel', {
  mount: mountDesignReviewPanel,
  unmount: unmountDesignReviewPanel
});

registerReactComponent('systemStatusPanel', {
  mount: mountSystemStatusPanel,
  unmount: unmountSystemStatusPanel
});

// Register analytics components
registerReactComponent('overviewDashboard', {
  mount: mountOverviewDashboard,
  unmount: unmountOverviewDashboard
});

registerReactComponent('analyticsDashboard', {
  mount: mountAnalyticsDashboard,
  unmount: unmountAnalyticsDashboard
});

registerReactComponent('adHocAnalytics', {
  mount: mountAdHocAnalytics,
  unmount: unmountAdHocAnalytics
});

registerReactComponent('performanceMetrics', {
  mount: mountPerformanceMetrics,
  unmount: unmountPerformanceMetrics
});

// Register dashboard components (parent tab groups)
registerReactComponent('workDashboard', {
  mount: mountWorkDashboard,
  unmount: unmountWorkDashboard
});

registerReactComponent('crmDashboard', {
  mount: mountCRMDashboard,
  unmount: unmountCRMDashboard
});

registerReactComponent('documentsDashboard', {
  mount: mountDocumentsDashboard,
  unmount: unmountDocumentsDashboard
});

// Log that React components are available
logger.info('Admin components registered (31 total)');
