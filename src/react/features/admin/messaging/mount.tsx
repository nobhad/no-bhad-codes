/**
 * Message View Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { MessageView } from './MessageView';

export interface MessageViewMountOptions extends BaseMountOptions {
  /** Callback when message is clicked for detail view */
  onViewMessage?: (messageId: number) => void;
}

export const {
  mount: mountMessageView,
  unmount: unmountMessageView,
  shouldUseReact: shouldUseReactMessageView
} = createMountWrapper<MessageViewMountOptions>({
  Component: MessageView,
  displayName: 'MessageView'
});
