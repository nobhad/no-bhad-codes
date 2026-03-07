/**
 * System Status Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { SystemStatusDashboard } from './SystemStatusDashboard';

export interface SystemStatusMountOptions extends BaseMountOptions {}

export const {
  mount: mountSystemStatusDashboard,
  unmount: unmountSystemStatusDashboard,
  shouldUseReact: shouldUseReactSystemStatusDashboard
} = createMountWrapper<SystemStatusMountOptions>({
  Component: SystemStatusDashboard,
  displayName: 'SystemStatusDashboard'
});
