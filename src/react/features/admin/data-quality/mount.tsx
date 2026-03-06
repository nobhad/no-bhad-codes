/**
 * Data Quality Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DataQualityPanel } from './DataQualityPanel';

export interface DataQualityMountOptions extends BaseMountOptions {}

export const {
  mount: mountDataQualityPanel,
  unmount: unmountDataQualityPanel,
  shouldUseReact: shouldUseReactDataQualityPanel
} = createMountWrapper<DataQualityMountOptions>({
  Component: DataQualityPanel,
  displayName: 'DataQualityPanel'
});
