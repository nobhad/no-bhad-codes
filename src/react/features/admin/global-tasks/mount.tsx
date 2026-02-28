/**
 * Global Tasks Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { GlobalTasksTable } from './GlobalTasksTable';

export interface GlobalTasksMountOptions extends BaseMountOptions {
  /** Callback when task is clicked for detail view */
  onViewTask?: (taskId: number) => void;
}

export const {
  mount: mountGlobalTasksTable,
  unmount: unmountGlobalTasksTable,
  shouldUseReact: shouldUseReactGlobalTasksTable
} = createMountWrapper<GlobalTasksMountOptions>({
  Component: GlobalTasksTable,
  displayName: 'GlobalTasksTable'
});
