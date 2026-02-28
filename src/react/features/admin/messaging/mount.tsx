/**
 * Messaging Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { MessagingPanel } from './MessagingPanel';

export interface MessagingMountOptions extends BaseMountOptions {
  /** Callback when message is clicked for detail view */
  onViewMessage?: (messageId: number) => void;
}

export const {
  mount: mountMessagingPanel,
  unmount: unmountMessagingPanel,
  shouldUseReact: shouldUseReactMessagingPanel
} = createMountWrapper<MessagingMountOptions>({
  Component: MessagingPanel,
  displayName: 'MessagingPanel'
});
