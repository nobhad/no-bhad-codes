/**
 * Integrations Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { IntegrationsManager } from './IntegrationsManager';

export interface IntegrationsMountOptions extends BaseMountOptions {}

export const {
  mount: mountIntegrationsManager,
  unmount: unmountIntegrationsManager,
  shouldUseReact: shouldUseReactIntegrationsManager
} = createMountWrapper<IntegrationsMountOptions>({
  Component: IntegrationsManager,
  displayName: 'IntegrationsManager'
});
