/**
 * Approvals Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ApprovalsTable } from './ApprovalsTable';

export interface ApprovalsMountOptions extends BaseMountOptions {}

export const {
  mount: mountApprovalsTable,
  unmount: unmountApprovalsTable,
  shouldUseReact: shouldUseReactApprovalsTable
} = createMountWrapper<ApprovalsMountOptions>({
  Component: ApprovalsTable,
  displayName: 'ApprovalsTable'
});
