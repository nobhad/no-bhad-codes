/**
 * Portal Files Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalFilesManager } from './PortalFilesManager';

export interface PortalFilesMountOptions extends BaseMountOptions {
  /** Filter files by project ID */
  projectId?: string;
}

export const {
  mount: mountPortalFiles,
  unmount: unmountPortalFiles,
  shouldUseReact: shouldUseReactPortalFiles
} = createMountWrapper<PortalFilesMountOptions>({
  Component: PortalFilesManager,
  displayName: 'PortalFilesManager'
});
