/**
 * Performance Metrics Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PerformanceMetrics } from './PerformanceMetrics';

export interface PerformanceMountOptions extends BaseMountOptions {}

export const {
  mount: mountPerformanceMetrics,
  unmount: unmountPerformanceMetrics,
  shouldUseReact: shouldUseReactPerformanceMetrics
} = createMountWrapper<PerformanceMountOptions>({
  Component: PerformanceMetrics,
  displayName: 'PerformanceMetrics'
});
