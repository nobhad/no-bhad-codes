/**
 * Analytics Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export interface AnalyticsMountOptions extends BaseMountOptions {}

export const {
  mount: mountAnalyticsDashboard,
  unmount: unmountAnalyticsDashboard,
  shouldUseReact: shouldUseReactAnalyticsDashboard
} = createMountWrapper<AnalyticsMountOptions>({
  Component: AnalyticsDashboard,
  displayName: 'AnalyticsDashboard'
});
