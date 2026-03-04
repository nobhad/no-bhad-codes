/**
 * ===============================================
 * REACT MODULE LOADER (CLIENT PORTAL)
 * ===============================================
 * @file src/features/client/ReactModuleLoader.ts
 *
 * Lightweight module loader that directly mounts React components.
 * Replaces the vanilla JS portal modules with direct React mounting.
 *
 * Uses dynamic imports for code splitting.
 */

import type { ClientPortalContext } from './portal-types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalReactModuleLoader');

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
 * Map of view IDs to React module definitions
 */
const REACT_MODULES: Record<string, ReactModuleDefinition> = {
  // Main views
  projects: {
    import: () => import('../../react/features/portal/projects/mount'),
    mountFn: 'mountPortalProjects',
    unmountFn: 'unmountPortalProjects'
  },
  'project-detail': {
    import: () => import('../../react/features/portal/projects/mount'),
    mountFn: 'mountPortalProjectDetail',
    unmountFn: 'unmountPortalProjectDetail'
  },
  messages: {
    import: () => import('../../react/features/portal/messages/mount'),
    mountFn: 'mountPortalMessages',
    unmountFn: 'unmountPortalMessages'
  },
  invoices: {
    import: () => import('../../react/features/portal/invoices/mount'),
    mountFn: 'mountPortalInvoices',
    unmountFn: 'unmountPortalInvoices'
  },
  files: {
    import: () => import('../../react/features/portal/files/mount'),
    mountFn: 'mountPortalFiles',
    unmountFn: 'unmountPortalFiles'
  },
  settings: {
    import: () => import('../../react/features/portal/settings/mount'),
    mountFn: 'mountPortalSettings',
    unmountFn: 'unmountPortalSettings'
  },
  questionnaires: {
    import: () => import('../../react/features/portal/questionnaires/mount'),
    mountFn: 'mountPortalQuestionnaires',
    unmountFn: 'unmountPortalQuestionnaires'
  },
  'document-requests': {
    import: () => import('../../react/features/portal/document-requests/mount'),
    mountFn: 'mountPortalDocumentRequests',
    unmountFn: 'unmountPortalDocumentRequests'
  },
  'ad-hoc-requests': {
    import: () => import('../../react/features/portal/ad-hoc-requests/mount'),
    mountFn: 'mountPortalAdHocRequests',
    unmountFn: 'unmountPortalAdHocRequests'
  },
  approvals: {
    import: () => import('../../react/features/portal/approvals/mount'),
    mountFn: 'mountPortalApprovals',
    unmountFn: 'unmountPortalApprovals'
  },
  onboarding: {
    import: () => import('../../react/features/portal/onboarding/mount'),
    mountFn: 'mountOnboardingWizard',
    unmountFn: 'unmountOnboardingWizard'
  },
  dashboard: {
    import: () => import('../../react/features/portal/dashboard/mount'),
    mountFn: 'mountPortalDashboard',
    unmountFn: 'unmountPortalDashboard'
  },
  help: {
    import: () => import('../../react/features/portal/help/mount'),
    mountFn: 'mountPortalHelp',
    unmountFn: 'unmountPortalHelp'
  },
  review: {
    import: () => import('../../react/features/portal/preview/mount'),
    mountFn: 'mountPortalPreview',
    unmountFn: 'unmountPortalPreview'
  },
  'new-project': {
    import: () => import('../../react/features/portal/onboarding/mount'),
    mountFn: 'mountOnboardingWizard',
    unmountFn: 'unmountOnboardingWizard'
  },

  // Navigation (sidebar, header)
  navigation: {
    import: () => import('../../react/features/portal/navigation/mount'),
    mountFn: 'mountPortalNavigation',
    unmountFn: 'unmountPortalNavigation'
  }
};

/**
 * Track currently mounted modules for cleanup
 */
const mountedModules: Map<string, MountState> = new Map();

/**
 * Unmount a previously mounted module
 */
function unmountModule(viewId: string): void {
  const state = mountedModules.get(viewId);
  if (state?.unmountFn) {
    try {
      state.unmountFn();
      logger.log(`Unmounted module: ${viewId}`);
    } catch (err) {
      logger.error(`Error unmounting module ${viewId}:`, err);
    }
  }
  mountedModules.delete(viewId);
}

/**
 * Mount a React module to the specified container
 *
 * @param viewId - The view/module identifier
 * @param container - The DOM element to mount into
 * @param context - The client portal context
 * @returns Cleanup function or undefined if mount failed
 */
export async function mountReactModule(
  viewId: string,
  container: HTMLElement,
  context: ClientPortalContext
): Promise<CleanupFn> {
  const moduleDef = REACT_MODULES[viewId];

  if (!moduleDef) {
    logger.warn(`No React module defined for view: ${viewId}`);
    return undefined;
  }

  // Unmount previous instance if exists
  unmountModule(viewId);

  try {
    // Dynamic import the module
    const module = await moduleDef.import();
    const mountFn = module[moduleDef.mountFn] as
      | ((container: HTMLElement, options: Record<string, unknown>) => CleanupFn)
      | undefined;
    const unmountFnRef = module[moduleDef.unmountFn] as (() => void) | undefined;

    if (typeof mountFn !== 'function') {
      logger.error(`Mount function not found: ${moduleDef.mountFn} in ${viewId}`);
      return undefined;
    }

    // Prepare mount options from context
    const mountOptions: Record<string, unknown> = {
      getAuthToken: context.getAuthToken,
      showNotification: context.showNotification,
      onNavigate: context.switchView,
      refreshData: context.refreshData,
      onSelectProject: context.onSelectProject
    };

    // Mount the React component
    const _cleanup = mountFn(container, mountOptions);

    // Store mount state for cleanup
    mountedModules.set(viewId, {
      unmountFn: typeof unmountFnRef === 'function' ? unmountFnRef : null,
      container
    });

    logger.log(`Mounted React module: ${viewId}`);

    // Return cleanup function
    return () => unmountModule(viewId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to mount React module ${viewId}:`, {
      message: errorMessage,
      error: err
    });
    return undefined;
  }
}

/**
 * Check if a view has a React module available
 */
export function hasReactModule(viewId: string): boolean {
  return viewId in REACT_MODULES;
}

/**
 * Unmount all currently mounted modules
 */
export function unmountAllModules(): void {
  for (const viewId of mountedModules.keys()) {
    unmountModule(viewId);
  }
}

/**
 * Get list of all available React module view IDs
 */
export function getAvailableModules(): string[] {
  return Object.keys(REACT_MODULES);
}
