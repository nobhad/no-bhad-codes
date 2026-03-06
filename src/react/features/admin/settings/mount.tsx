/**
 * Settings Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { SettingsManager } from './SettingsManager';

export interface SettingsMountOptions extends BaseMountOptions {}

export const {
  mount: mountSettingsManager,
  unmount: unmountSettingsManager,
  shouldUseReact: shouldUseReactSettingsManager
} = createMountWrapper<SettingsMountOptions>({
  Component: SettingsManager,
  displayName: 'SettingsManager'
});
