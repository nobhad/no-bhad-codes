/**
 * Approvals Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ApprovalsPanel } from './ApprovalsPanel';

export interface ApprovalsMountOptions extends BaseMountOptions {}

export const {
  mount: mountApprovalsPanel,
  unmount: unmountApprovalsPanel,
  shouldUseReact: shouldUseReactApprovalsPanel
} = createMountWrapper<ApprovalsMountOptions>({
  Component: ApprovalsPanel,
  displayName: 'ApprovalsPanel'
});
