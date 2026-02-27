/**
 * React Component Registry
 * Provides a way for React components to register themselves for use by vanilla code
 * This avoids the preamble detection issue with Vite's React plugin
 */


type MountFunction = (container: HTMLElement, options: any) => void | (() => void);
type UnmountFunction = (container: HTMLElement) => void;

// Component registry entry type
interface RegistryEntry {
  mount: MountFunction;
  unmount: UnmountFunction;
}

// Global registry for React mount functions
interface ReactRegistry {
  // Admin detail components
  clientDetail?: RegistryEntry;
  projectDetail?: RegistryEntry;
  // Admin table components
  projectsTable?: RegistryEntry;
  clientsTable?: RegistryEntry;
  leadsTable?: RegistryEntry;
  invoicesTable?: RegistryEntry;
  contactsTable?: RegistryEntry;
  contractsTable?: RegistryEntry;
  deliverablesTable?: RegistryEntry;
  documentRequestsTable?: RegistryEntry;
  questionnairesTable?: RegistryEntry;
  adHocRequestsTable?: RegistryEntry;
  proposalsTable?: RegistryEntry;
  globalTasksTable?: RegistryEntry;
  deletedItemsTable?: RegistryEntry;
  // Admin feature components
  tasksManager?: RegistryEntry;
  workflowsManager?: RegistryEntry;
  filesManager?: RegistryEntry;
  emailTemplatesManager?: RegistryEntry;
  knowledgeBase?: RegistryEntry;
  messagingPanel?: RegistryEntry;
  timeTrackingPanel?: RegistryEntry;
  designReviewPanel?: RegistryEntry;
  systemStatusPanel?: RegistryEntry;
  // Admin analytics components
  overviewDashboard?: RegistryEntry;
  analyticsDashboard?: RegistryEntry;
  adHocAnalytics?: RegistryEntry;
  performanceMetrics?: RegistryEntry;
  // Portal (client-facing) components
  portalInvoices?: RegistryEntry;
  portalFiles?: RegistryEntry;
  portalProjects?: RegistryEntry;
  portalMessages?: RegistryEntry;
  portalQuestionnaires?: RegistryEntry;
  portalDocumentRequests?: RegistryEntry;
  portalApprovals?: RegistryEntry;
  portalSettings?: RegistryEntry;
  portalAdHocRequests?: RegistryEntry;
  portalNavigation?: RegistryEntry;
  portalOnboarding?: RegistryEntry;
}

// Extend window to include our registry
declare global {
  interface Window {
    __REACT_REGISTRY__?: ReactRegistry;
  }
}

/**
 * Get or create the React registry
 */
export function getReactRegistry(): ReactRegistry {
  if (!window.__REACT_REGISTRY__) {
    window.__REACT_REGISTRY__ = {};
  }
  return window.__REACT_REGISTRY__;
}

/**
 * Register a React component mount function
 */
export function registerReactComponent<K extends keyof ReactRegistry>(
  name: K,
  component: ReactRegistry[K]
): void {
  const registry = getReactRegistry();
  registry[name] = component;
}

/**
 * Get a registered React component
 */
export function getReactComponent<K extends keyof ReactRegistry>(
  name: K
): ReactRegistry[K] | undefined {
  return getReactRegistry()[name];
}
