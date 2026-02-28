/**
 * Portal Messages Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalMessagesView } from './PortalMessagesView';

export interface PortalMessagesMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalMessages,
  unmount: unmountPortalMessages,
  shouldUseReact: shouldUseReactPortalMessages
} = createMountWrapper<PortalMessagesMountOptions>({
  Component: PortalMessagesView,
  displayName: 'PortalMessagesView'
});
