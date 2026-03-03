/**
 * Work Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { WorkDashboard } from './WorkDashboard';

export interface WorkDashboardMountOptions extends BaseMountOptions {}

export const {
  mount: mountWorkDashboard,
  unmount: unmountWorkDashboard,
  shouldUseReact: shouldUseReactWorkDashboard
} = createMountWrapper<WorkDashboardMountOptions>({
  Component: WorkDashboard,
  displayName: 'WorkDashboard'
});
