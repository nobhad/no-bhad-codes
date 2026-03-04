/**
 * Portal Help Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalHelp } from './PortalHelp';

export interface PortalHelpMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalHelp,
  unmount: unmountPortalHelp,
  shouldUseReact: shouldUseReactPortalHelp
} = createMountWrapper<PortalHelpMountOptions>({
  Component: PortalHelp,
  displayName: 'PortalHelp'
});
