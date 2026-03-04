/**
 * Portal Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalDashboard } from './PortalDashboard';

export interface PortalDashboardMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalDashboard,
  unmount: unmountPortalDashboard,
  shouldUseReact: shouldUseReactPortalDashboard
} = createMountWrapper<PortalDashboardMountOptions>({
  Component: PortalDashboard,
  displayName: 'PortalDashboard'
});
