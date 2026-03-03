/**
 * CRM Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { CRMDashboard } from './CRMDashboard';

export interface CRMDashboardMountOptions extends BaseMountOptions {}

export const {
  mount: mountCRMDashboard,
  unmount: unmountCRMDashboard,
  shouldUseReact: shouldUseReactCRMDashboard
} = createMountWrapper<CRMDashboardMountOptions>({
  Component: CRMDashboard,
  displayName: 'CRMDashboard'
});
