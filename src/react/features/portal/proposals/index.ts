/**
 * Portal Proposals Feature
 * React components for the client portal proposal views
 */

export { PortalProposals } from './PortalProposals';
export type { PortalProposalsProps } from './PortalProposals';
export { PortalProposalDetail } from './PortalProposalDetail';
export type { PortalProposalDetailProps } from './PortalProposalDetail';
export { ProposalCard } from './ProposalCard';
export {
  mountPortalProposals,
  unmountPortalProposals,
  shouldUseReactPortalProposals
} from './mount';
export type { PortalProposalsMountOptions } from './mount';
export type {
  PortalProposal,
  PortalProposalStatus,
  PortalProposalsResponse
} from './types';
export { PROPOSAL_STATUS_CONFIG } from './types';
