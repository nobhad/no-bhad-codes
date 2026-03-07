/**
 * Help Center Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { HelpCenter } from './HelpCenter';

export interface HelpMountOptions extends BaseMountOptions {}

export const {
  mount: mountHelpCenter,
  unmount: unmountHelpCenter,
  shouldUseReact: shouldUseReactHelpCenter
} = createMountWrapper<HelpMountOptions>({
  Component: HelpCenter,
  displayName: 'HelpCenter'
});
