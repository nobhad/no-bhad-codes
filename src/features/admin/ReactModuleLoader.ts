/**
 * ===============================================
 * REACT MODULE LOADER
 * ===============================================
 * @file src/features/admin/ReactModuleLoader.ts
 *
 * Lightweight module loader that directly mounts React components.
 * Replaces the vanilla JS modules with direct React mounting.
 *
 * Uses dynamic imports for code splitting.
 */

import type { AdminDashboardContext } from './admin-types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ReactModuleLoader');

/**
 * Cleanup function returned by mount operations
 */
type CleanupFn = (() => void) | void;

/**
 * Module definition for React components
 */
interface ReactModuleDefinition {
  /** Dynamic import function for the React module */
  import: () => Promise<Record<string, unknown>>;
  /** Name of the mount function in the module */
  mountFn: string;
  /** Name of the unmount function in the module */
  unmountFn: string;
}

/**
 * Active mount state for cleanup
 */
interface MountState {
  unmountFn: (() => void) | null;
  container: HTMLElement;
}

/**
 * Map of tab IDs to React module definitions
 */
const REACT_MODULES: Record<string, ReactModuleDefinition> = {
  // Dashboard
  dashboard: {
    import: () => import('../../react/features/admin/overview/mount'),
    mountFn: 'mountOverviewDashboard',
    unmountFn: 'unmountOverviewDashboard'
  },
  analytics: {
    import: () => import('../../react/features/admin/analytics/mount'),
    mountFn: 'mountAnalyticsDashboard',
    unmountFn: 'unmountAnalyticsDashboard'
  },
  performance: {
    import: () => import('../../react/features/admin/performance/mount'),
    mountFn: 'mountPerformanceMetrics',
    unmountFn: 'unmountPerformanceMetrics'
  },

  // Group Dashboards (parent components that handle subtabs internally)
  work: {
    import: () => import('../../react/features/admin/work/mount'),
    mountFn: 'mountWorkDashboard',
    unmountFn: 'unmountWorkDashboard'
  },
  crm: {
    import: () => import('../../react/features/admin/crm/mount'),
    mountFn: 'mountCRMDashboard',
    unmountFn: 'unmountCRMDashboard'
  },
  documents: {
    import: () => import('../../react/features/admin/documents/mount'),
    mountFn: 'mountDocumentsDashboard',
    unmountFn: 'unmountDocumentsDashboard'
  },

  // CRM
  leads: {
    import: () => import('../../react/features/admin/leads/mount'),
    mountFn: 'mountLeadsTable',
    unmountFn: 'unmountLeadsTable'
  },
  contacts: {
    import: () => import('../../react/features/admin/contacts/mount'),
    mountFn: 'mountContactsTable',
    unmountFn: 'unmountContactsTable'
  },
  clients: {
    import: () => import('../../react/features/admin/clients/mount'),
    mountFn: 'mountClientsTable',
    unmountFn: 'unmountClientsTable'
  },
  messages: {
    import: () => import('../../react/features/admin/messaging/mount'),
    mountFn: 'mountMessagingView',
    unmountFn: 'unmountMessagingView'
  },

  // Work
  projects: {
    import: () => import('../../react/features/admin/projects/mount'),
    mountFn: 'mountProjectsTable',
    unmountFn: 'unmountProjectsTable'
  },
  tasks: {
    import: () => import('../../react/features/admin/global-tasks/mount'),
    mountFn: 'mountGlobalTasksTable',
    unmountFn: 'unmountGlobalTasksTable'
  },
  'ad-hoc-requests': {
    import: () => import('../../react/features/admin/ad-hoc-requests/mount'),
    mountFn: 'mountAdHocRequestsTable',
    unmountFn: 'unmountAdHocRequestsTable'
  },
  deliverables: {
    import: () => import('../../react/features/admin/deliverables/mount'),
    mountFn: 'mountDeliverablesTable',
    unmountFn: 'unmountDeliverablesTable'
  },

  // Finance
  invoices: {
    import: () => import('../../react/features/admin/invoices/mount'),
    mountFn: 'mountInvoicesTable',
    unmountFn: 'unmountInvoicesTable'
  },
  contracts: {
    import: () => import('../../react/features/admin/contracts/mount'),
    mountFn: 'mountContractsTable',
    unmountFn: 'unmountContractsTable'
  },
  proposals: {
    import: () => import('../../react/features/admin/proposals/mount'),
    mountFn: 'mountProposalsTable',
    unmountFn: 'unmountProposalsTable'
  },

  // Documents & Files
  'document-requests': {
    import: () => import('../../react/features/admin/document-requests/mount'),
    mountFn: 'mountDocumentRequestsTable',
    unmountFn: 'unmountDocumentRequestsTable'
  },
  files: {
    import: () => import('../../react/features/admin/files/mount'),
    mountFn: 'mountFilesManager',
    unmountFn: 'unmountFilesManager'
  },
  questionnaires: {
    import: () => import('../../react/features/admin/questionnaires/mount'),
    mountFn: 'mountQuestionnairesTable',
    unmountFn: 'unmountQuestionnairesTable'
  },

  // Support & Admin
  support: {
    import: () => import('../../react/features/admin/knowledge-base/mount'),
    mountFn: 'mountKnowledgeBase',
    unmountFn: 'unmountKnowledgeBase'
  },
  system: {
    import: () => import('../../react/features/admin/settings/mount'),
    mountFn: 'mountSettingsManager',
    unmountFn: 'unmountSettingsManager'
  },
  'email-templates': {
    import: () => import('../../react/features/admin/email-templates/mount'),
    mountFn: 'mountEmailTemplatesManager',
    unmountFn: 'unmountEmailTemplatesManager'
  },
  'deleted-items': {
    import: () => import('../../react/features/admin/deleted-items/mount'),
    mountFn: 'mountDeletedItemsTable',
    unmountFn: 'unmountDeletedItemsTable'
  },
  'time-tracking': {
    import: () => import('../../react/features/admin/time-tracking/mount'),
    mountFn: 'mountTimeTrackingTable',
    unmountFn: 'unmountTimeTrackingTable'
  },
  'design-review': {
    import: () => import('../../react/features/admin/design-review/mount'),
    mountFn: 'mountDesignReviewTable',
    unmountFn: 'unmountDesignReviewTable'
  },
  'ad-hoc-analytics': {
    import: () => import('../../react/features/admin/ad-hoc-analytics/mount'),
    mountFn: 'mountAdHocAnalytics',
    unmountFn: 'unmountAdHocAnalytics'
  },
  'data-quality': {
    import: () => import('../../react/features/admin/data-quality/mount'),
    mountFn: 'mountDataQualityDashboard',
    unmountFn: 'unmountDataQualityDashboard'
  },
  integrations: {
    import: () => import('../../react/features/admin/integrations/mount'),
    mountFn: 'mountIntegrationsManager',
    unmountFn: 'unmountIntegrationsManager'
  },
  webhooks: {
    import: () => import('../../react/features/admin/webhooks/mount'),
    mountFn: 'mountWebhooksManager',
    unmountFn: 'unmountWebhooksManager'
  },
  workflows: {
    import: () => import('../../react/features/admin/workflows/mount'),
    mountFn: 'mountWorkflowsManager',
    unmountFn: 'unmountWorkflowsManager'
  },

  // Client Portal Modules
  approvals: {
    import: () => import('../../react/features/admin/approvals/mount'),
    mountFn: 'mountApprovalsTable',
    unmountFn: 'unmountApprovalsTable'
  },
  review: {
    import: () => import('../../react/features/admin/review/mount'),
    mountFn: 'mountReviewTable',
    unmountFn: 'unmountReviewTable'
  },
  help: {
    import: () => import('../../react/features/admin/help/mount'),
    mountFn: 'mountHelpCenter',
    unmountFn: 'unmountHelpCenter'
  },

  // Detail Views
  'client-detail': {
    import: () => import('../../react/features/admin/client-detail/mount'),
    mountFn: 'mountClientDetail',
    unmountFn: 'unmountClientDetail'
  },
  'project-detail': {
    import: () => import('../../react/features/admin/project-detail/mount'),
    mountFn: 'mountProjectDetail',
    unmountFn: 'unmountProjectDetail'
  },

  // Global (mounted on init, not on tab switch)
  'admin-modals': {
    import: () => import('../../react/features/admin/modals/mount'),
    mountFn: 'mountAdminModals',
    unmountFn: 'unmountAdminModals'
  }
};

/**
 * Track currently mounted modules for cleanup
 */
const mountedModules: Map<string, MountState> = new Map();

/**
 * Unmount a previously mounted module
 */
function unmountModule(tabId: string): void {
  const state = mountedModules.get(tabId);
  if (state?.unmountFn) {
    try {
      state.unmountFn();
      logger.log(`Unmounted module: ${tabId}`);
    } catch (err) {
      logger.error(`Error unmounting module ${tabId}:`, err);
    }
  }
  mountedModules.delete(tabId);
}

/**
 * Mount a React module to the specified container
 *
 * @param tabId - The tab/module identifier
 * @param container - The DOM element to mount into
 * @param context - The admin dashboard context
 * @returns Cleanup function or undefined if mount failed
 */
export async function mountReactModule(
  tabId: string,
  container: HTMLElement,
  context: AdminDashboardContext
): Promise<CleanupFn> {
  const moduleDef = REACT_MODULES[tabId];

  if (!moduleDef) {
    logger.warn(`No React module defined for tab: ${tabId}`);
    return undefined;
  }

  // Unmount previous instance if exists
  unmountModule(tabId);

  try {
    // Dynamic import the module
    const module = await moduleDef.import();
    const mountFn = module[moduleDef.mountFn] as
      | ((container: HTMLElement, options: Record<string, unknown>) => CleanupFn)
      | undefined;
    const unmountFnRef = module[moduleDef.unmountFn] as (() => void) | undefined;

    if (typeof mountFn !== 'function') {
      logger.error(`Mount function not found: ${moduleDef.mountFn} in ${tabId}`);
      return undefined;
    }

    // Prepare mount options from context
    const mountOptions: Record<string, unknown> = {
      getAuthToken: context.getAuthToken,
      showNotification: context.showNotification,
      onNavigate: context.switchTab,
      onNavigateToTab: context.switchTab,
      refreshData: context.refreshData
    };

    // For detail views, inject the entity ID and back navigation
    if (tabId === 'project-detail') {
      if (context.currentEntityId) {
        mountOptions.projectId = parseInt(context.currentEntityId, 10);
      }
      mountOptions.onBack = () => context.switchTab('projects');
    } else if (tabId === 'client-detail') {
      if (context.currentEntityId) {
        mountOptions.clientId = parseInt(context.currentEntityId, 10);
      }
      mountOptions.onBack = () => context.switchTab('clients');
    }

    // Mount the React component
    const _cleanup = mountFn(container, mountOptions);

    // Store mount state for cleanup
    mountedModules.set(tabId, {
      unmountFn: typeof unmountFnRef === 'function' ? unmountFnRef : null,
      container
    });

    logger.log(`Mounted React module: ${tabId}`);

    // Return cleanup function
    return () => unmountModule(tabId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to mount React module ${tabId}:`, {
      message: errorMessage,
      error: err
    });
    return undefined;
  }
}

/**
 * Check if a tab has a React module available
 */
export function hasReactModule(tabId: string): boolean {
  return tabId in REACT_MODULES;
}

/**
 * Unmount all currently mounted modules
 */
export function unmountAllModules(): void {
  for (const tabId of mountedModules.keys()) {
    unmountModule(tabId);
  }
}

/**
 * Get list of all available React module tab IDs
 */
export function getAvailableModules(): string[] {
  return Object.keys(REACT_MODULES);
}
