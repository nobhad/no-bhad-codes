/**
 * Ad Hoc Analytics Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { AdHocAnalytics } from './AdHocAnalytics';

export interface AdHocAnalyticsMountOptions extends BaseMountOptions {}

export const {
  mount: mountAdHocAnalytics,
  unmount: unmountAdHocAnalytics,
  shouldUseReact: shouldUseReactAdHocAnalytics
} = createMountWrapper<AdHocAnalyticsMountOptions>({
  Component: AdHocAnalytics,
  displayName: 'AdHocAnalytics'
});
