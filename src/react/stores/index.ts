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
