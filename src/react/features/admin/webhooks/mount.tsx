/**
 * Webhooks Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { WebhooksManager } from './WebhooksManager';

export interface WebhooksMountOptions extends BaseMountOptions {
  /** Default page size for pagination */
  defaultPageSize?: number;
}

export const {
  mount: mountWebhooksManager,
  unmount: unmountWebhooksManager,
  shouldUseReact: shouldUseReactWebhooksManager
} = createMountWrapper<WebhooksMountOptions>({
  Component: WebhooksManager,
  displayName: 'WebhooksManager'
});
