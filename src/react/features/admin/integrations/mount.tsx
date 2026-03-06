/**
 * Integrations Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { IntegrationsPanel } from './IntegrationsPanel';

export interface IntegrationsMountOptions extends BaseMountOptions {}

export const {
  mount: mountIntegrationsPanel,
  unmount: unmountIntegrationsPanel,
  shouldUseReact: shouldUseReactIntegrationsPanel
} = createMountWrapper<IntegrationsMountOptions>({
  Component: IntegrationsPanel,
  displayName: 'IntegrationsPanel'
});
