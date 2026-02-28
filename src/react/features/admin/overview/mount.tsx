/**
 * Overview Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { OverviewDashboard } from './OverviewDashboard';

// Note: Portal styles loaded via admin.css bundle
import '../../../styles/tailwind-generated.css';

export interface OverviewMountOptions extends BaseMountOptions {
  /** Callback when dashboard item is clicked for navigation */
  onNavigateToTab?: (tab: string) => void;
}

export const {
  mount: mountOverviewDashboard,
  unmount: unmountOverviewDashboard,
  shouldUseReact: shouldUseReactOverviewDashboard
} = createMountWrapper<OverviewMountOptions>({
  Component: OverviewDashboard,
  displayName: 'OverviewDashboard'
});
