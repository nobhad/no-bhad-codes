/**
 * Portal Ad-Hoc Requests Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalAdHocRequests } from './PortalAdHocRequests';

export interface PortalAdHocRequestsMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalAdHocRequests,
  unmount: unmountPortalAdHocRequests,
  shouldUseReact: shouldUseReactPortalAdHocRequests
} = createMountWrapper<PortalAdHocRequestsMountOptions>({
  Component: PortalAdHocRequests,
  displayName: 'PortalAdHocRequests'
});
