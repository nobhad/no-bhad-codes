/**
 * System Status Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { SystemStatusPanel } from './SystemStatusPanel';

export interface SystemStatusMountOptions extends BaseMountOptions {}

export const {
  mount: mountSystemStatusPanel,
  unmount: unmountSystemStatusPanel,
  shouldUseReact: shouldUseReactSystemStatusPanel
} = createMountWrapper<SystemStatusMountOptions>({
  Component: SystemStatusPanel,
  displayName: 'SystemStatusPanel'
});
