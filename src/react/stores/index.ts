/**
 * Zustand Stores
 * State management for React components
 */

export {
  useAdminStore,
  useCurrentTab,
  useIsLoading,
  useSelectedIds,
  useSearchQuery,
  useFilters,
  type AdminState
} from './admin';

export { initStateBridge, destroyStateBridge, isBridgeInitialized } from './bridge';

// Portal store (React SPA)
export {
  usePortalStore,
  useCurrentTab as usePortalCurrentTab,
  useCurrentGroup,
  useNavItems,
  useSubtabGroups,
  useCapabilities,
  usePageTitle,
  useSidebarCollapsed,
  usePortalTheme,
  usePortalRole,
  type PortalStoreState
} from './portal-store';
