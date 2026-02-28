/**
 * Project Detail Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ProjectDetail } from './ProjectDetail';

export interface ProjectDetailMountOptions extends BaseMountOptions {
  /** Project ID to display */
  projectId: number;
  /** Callback to go back to projects list */
  onBack?: () => void;
  /** Callback to edit project */
  onEdit?: (projectId: number) => void;
}

export const {
  mount: mountProjectDetail,
  unmount: unmountProjectDetail,
  shouldUseReact: shouldUseReactProjectDetail
} = createMountWrapper<ProjectDetailMountOptions>({
  Component: ProjectDetail,
  displayName: 'ProjectDetail'
});
