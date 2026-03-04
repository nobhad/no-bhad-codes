/**
 * Portal Contracts Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalContracts } from './PortalContracts';

export interface PortalContractsMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalContracts,
  unmount: unmountPortalContracts,
  shouldUseReact: shouldUseReactPortalContracts
} = createMountWrapper<PortalContractsMountOptions>({
  Component: PortalContracts,
  displayName: 'PortalContracts'
});
