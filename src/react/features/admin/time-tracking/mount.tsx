/**
 * Time Tracking Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { TimeTrackingPanel } from './TimeTrackingPanel';

export interface TimeTrackingMountOptions extends BaseMountOptions {
  /** Filter by project ID */
  projectId?: string;
}

export const {
  mount: mountTimeTrackingPanel,
  unmount: unmountTimeTrackingPanel,
  shouldUseReact: shouldUseReactTimeTrackingPanel
} = createMountWrapper<TimeTrackingMountOptions>({
  Component: TimeTrackingPanel,
  displayName: 'TimeTrackingPanel'
});
