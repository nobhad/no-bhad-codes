/**
 * Projects Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ProjectsTable } from './ProjectsTable';

export interface ProjectsMountOptions extends BaseMountOptions {
  /** Navigation callback for detail views */
  onNavigate?: (tab: string, entityId?: string) => void;
}

export const {
  mount: mountProjectsTable,
  unmount: unmountProjectsTable,
  shouldUseReact: shouldUseReactProjectsTable
} = createMountWrapper<ProjectsMountOptions>({
  Component: ProjectsTable,
  displayName: 'ProjectsTable'
});
