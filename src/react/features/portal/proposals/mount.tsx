/**
 * Portal Proposals Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalProposals } from './PortalProposals';

export interface PortalProposalsMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalProposals,
  unmount: unmountPortalProposals,
  shouldUseReact: shouldUseReactPortalProposals
} = createMountWrapper<PortalProposalsMountOptions>({
  Component: PortalProposals,
  displayName: 'PortalProposals'
});
