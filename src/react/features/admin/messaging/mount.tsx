/**
 * Messaging View Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { MessagingView } from './MessagingView';

export interface MessagingMountOptions extends BaseMountOptions {
  /** Callback when message is clicked for detail view */
  onViewMessage?: (messageId: number) => void;
}

export const {
  mount: mountMessagingView,
  unmount: unmountMessagingView,
  shouldUseReact: shouldUseReactMessagingView
} = createMountWrapper<MessagingMountOptions>({
  Component: MessagingView,
  displayName: 'MessagingView'
});
