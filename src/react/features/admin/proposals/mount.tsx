/**
 * Proposals Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ProposalsTable } from './ProposalsTable';

export interface ProposalsMountOptions extends BaseMountOptions {
  /** Callback when proposal is clicked for detail view */
  onViewProposal?: (proposalId: number) => void;
}

export const {
  mount: mountProposalsTable,
  unmount: unmountProposalsTable,
  shouldUseReact: shouldUseReactProposalsTable
} = createMountWrapper<ProposalsMountOptions>({
  Component: ProposalsTable,
  displayName: 'ProposalsTable'
});
