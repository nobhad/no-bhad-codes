/**
 * Portal Projects Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalProjectsList } from './PortalProjectsList';
import { PortalProjectDetail } from './PortalProjectDetail';

export interface PortalProjectsMountOptions extends BaseMountOptions {
  /** Callback when a project is selected */
  onSelectProject?: (projectId: string) => void;
}

export interface PortalProjectDetailMountOptions extends BaseMountOptions {
  /** Project ID to display */
  projectId: string;
  /** Callback to go back to projects list */
  onBack?: () => void;
}

// Projects list mount
export const {
  mount: mountPortalProjects,
  unmount: unmountPortalProjects,
  shouldUseReact: shouldUseReactPortalProjects
} = createMountWrapper<PortalProjectsMountOptions>({
  Component: PortalProjectsList,
  displayName: 'PortalProjectsList'
});

// Project detail mount
export const {
  mount: mountPortalProjectDetail,
  unmount: unmountPortalProjectDetail,
  shouldUseReact: shouldUseReactPortalProjectDetail
} = createMountWrapper<PortalProjectDetailMountOptions>({
  Component: PortalProjectDetail,
  displayName: 'PortalProjectDetail'
});
