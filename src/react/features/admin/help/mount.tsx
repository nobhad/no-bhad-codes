/**
 * Help Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { HelpPanel } from './HelpPanel';

export interface HelpMountOptions extends BaseMountOptions {}

export const {
  mount: mountHelpPanel,
  unmount: unmountHelpPanel,
  shouldUseReact: shouldUseReactHelpPanel
} = createMountWrapper<HelpMountOptions>({
  Component: HelpPanel,
  displayName: 'HelpPanel'
});
