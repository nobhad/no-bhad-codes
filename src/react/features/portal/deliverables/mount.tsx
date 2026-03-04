/**
 * Portal Deliverables Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalDeliverables } from './PortalDeliverables';

export interface PortalDeliverablesMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalDeliverables,
  unmount: unmountPortalDeliverables,
  shouldUseReact: shouldUseReactPortalDeliverables
} = createMountWrapper<PortalDeliverablesMountOptions>({
  Component: PortalDeliverables,
  displayName: 'PortalDeliverables'
});
