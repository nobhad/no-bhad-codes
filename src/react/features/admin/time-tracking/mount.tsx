/**
 * Time Tracking Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { TimeTrackingTable } from './TimeTrackingTable';

export interface TimeTrackingMountOptions extends BaseMountOptions {
  /** Filter by project ID */
  projectId?: string;
}

export const {
  mount: mountTimeTrackingTable,
  unmount: unmountTimeTrackingTable,
  shouldUseReact: shouldUseReactTimeTrackingTable
} = createMountWrapper<TimeTrackingMountOptions>({
  Component: TimeTrackingTable,
  displayName: 'TimeTrackingTable'
});
