/**
 * Tasks Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { TasksManager } from './TasksManager';

export interface TasksMountOptions extends BaseMountOptions {
  /** Filter by client ID */
  clientId?: string;
  /** Filter by project ID */
  projectId?: string;
  /** Filter by assignee ID */
  assigneeId?: string;
  /** Callback when task is clicked for detail view */
  onViewTask?: (taskId: number) => void;
}

export const {
  mount: mountTasksManager,
  unmount: unmountTasksManager,
  shouldUseReact: shouldUseReactTasksManager
} = createMountWrapper<TasksMountOptions>({
  Component: TasksManager,
  displayName: 'TasksManager'
});
