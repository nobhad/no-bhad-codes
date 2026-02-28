/**
 * Workflows Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { WorkflowsManager } from './WorkflowsManager';

export interface WorkflowsMountOptions extends BaseMountOptions {
  /** Callback when workflow is clicked for detail view */
  onViewWorkflow?: (workflowId: number) => void;
}

export const {
  mount: mountWorkflowsManager,
  unmount: unmountWorkflowsManager,
  shouldUseReact: shouldUseReactWorkflowsManager
} = createMountWrapper<WorkflowsMountOptions>({
  Component: WorkflowsManager,
  displayName: 'WorkflowsManager'
});
