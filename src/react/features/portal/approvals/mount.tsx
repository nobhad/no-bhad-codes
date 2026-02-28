/**
 * Portal Approvals Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalApprovals } from './PortalApprovals';

export interface PortalApprovalsMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalApprovals,
  unmount: unmountPortalApprovals,
  shouldUseReact: shouldUseReactPortalApprovals
} = createMountWrapper<PortalApprovalsMountOptions>({
  Component: PortalApprovals,
  displayName: 'PortalApprovals'
});
