/**
 * Portal Settings Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalSettings } from './PortalSettings';

export interface PortalSettingsMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalSettings,
  unmount: unmountPortalSettings,
  shouldUseReact: shouldUseReactPortalSettings
} = createMountWrapper<PortalSettingsMountOptions>({
  Component: PortalSettings,
  displayName: 'PortalSettings'
});
