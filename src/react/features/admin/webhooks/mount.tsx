/**
 * Webhooks Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { WebhooksPanel } from './WebhooksPanel';

export interface WebhooksMountOptions extends BaseMountOptions {
  /** Default page size for pagination */
  defaultPageSize?: number;
}

export const {
  mount: mountWebhooksPanel,
  unmount: unmountWebhooksPanel,
  shouldUseReact: shouldUseReactWebhooksPanel
} = createMountWrapper<WebhooksMountOptions>({
  Component: WebhooksPanel,
  displayName: 'WebhooksPanel'
});
