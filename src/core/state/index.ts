/**
 * @file state/index.ts
 * @description Re-exports for state management module
 */

// Types
export type {
  WorkItem,
  StateListener,
  StateSelector,
  StateAction,
  StateReducer,
  StateMiddleware,
  ComputedProperty,
  AppState
} from './types';

// StateManager class and factory
export { StateManager, createStateManager } from './state-manager';

// Application state instance
export { appState } from './app-state';
