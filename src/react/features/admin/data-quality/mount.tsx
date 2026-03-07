/**
 * Data Quality Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DataQualityDashboard } from './DataQualityDashboard';

export interface DataQualityMountOptions extends BaseMountOptions {}

export const {
  mount: mountDataQualityDashboard,
  unmount: unmountDataQualityDashboard,
  shouldUseReact: shouldUseReactDataQualityDashboard
} = createMountWrapper<DataQualityMountOptions>({
  Component: DataQualityDashboard,
  displayName: 'DataQualityDashboard'
});
