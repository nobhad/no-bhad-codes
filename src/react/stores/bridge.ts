/**
 * State Bridge
 * Bidirectional sync between vanilla StateManager and Zustand stores
 *
 * This module provides the bridge between the existing vanilla TypeScript
 * state management and the new React/Zustand state during the migration.
 *
 * Usage:
 * 1. Import and call initStateBridge() once during app initialization
 * 2. The bridge will automatically sync state changes in both directions
 */

import { useAdminStore } from './admin';

// Type for the vanilla app state (will be imported from existing code)
interface VanillaAppState {
  adminTab?: string;
  // Add other state properties as needed during migration
}

// Type for the vanilla state manager
interface VanillaStateManager {
  getState: () => VanillaAppState;
  subscribe: (callback: (state: VanillaAppState) => void) => () => void;
  dispatch: (action: { type: string; payload?: unknown }) => void;
}

let vanillaStateManager: VanillaStateManager | null = null;
let isInitialized = false;

/**
 * Initialize the state bridge
 * Call this once during application initialization
 *
 * @param stateManager - The vanilla StateManager instance
 */
export function initStateBridge(stateManager: VanillaStateManager): void {
  if (isInitialized) {
    console.warn('[StateBridge] Already initialized');
    return;
  }

  vanillaStateManager = stateManager;

  // Sync vanilla state → Zustand
  const unsubscribeVanilla = stateManager.subscribe((state) => {
    if (state.adminTab !== undefined) {
      const zustandState = useAdminStore.getState();
      if (zustandState.currentTab !== state.adminTab) {
        useAdminStore.setState({ currentTab: state.adminTab });
      }
    }
  });

  // Sync Zustand → vanilla state
  const unsubscribeZustand = useAdminStore.subscribe((state, prevState) => {
    if (state.currentTab !== prevState.currentTab && vanillaStateManager) {
      vanillaStateManager.dispatch({
        type: 'SET_ADMIN_TAB',
        payload: state.currentTab
      });
    }
  });

  // Initial sync from vanilla to Zustand
  const initialState = stateManager.getState();
  if (initialState.adminTab) {
    useAdminStore.setState({ currentTab: initialState.adminTab });
  }

  isInitialized = true;

  // Store cleanup functions for potential teardown
  (window as { __stateBridgeCleanup?: () => void }).__stateBridgeCleanup = () => {
    unsubscribeVanilla();
    unsubscribeZustand();
    isInitialized = false;
    vanillaStateManager = null;
  };
}

/**
 * Check if the bridge is initialized
 */
export function isBridgeInitialized(): boolean {
  return isInitialized;
}

/**
 * Clean up the state bridge
 * Call this when unmounting the React app or during HMR
 */
export function destroyStateBridge(): void {
  const cleanup = (window as { __stateBridgeCleanup?: () => void }).__stateBridgeCleanup;
  if (cleanup) {
    cleanup();
    delete (window as { __stateBridgeCleanup?: () => void }).__stateBridgeCleanup;
  }
}
