/**
 * Portal Approvals Feature
 * React components for the client portal approvals workflow
 */

export { PortalApprovals } from './PortalApprovals';
export type { PortalApprovalsProps } from './PortalApprovals';
export { ApprovalCard } from './ApprovalCard';
export {
  mountPortalApprovals,
  unmountPortalApprovals,
  shouldUseReactPortalApprovals
} from './mount';
export type { PortalApprovalsMountOptions } from './mount';
export type {
  ApprovalEntityType,
  ApprovalStatus,
  ApprovalAction,
  PendingApproval,
  ApprovalResponse,
  PendingApprovalsResponse
} from './types';
export { APPROVAL_STATUS_CONFIG } from './types';
