/**
 * Files Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { FilesManager } from './FilesManager';

export interface FilesMountOptions extends BaseMountOptions {
  /** Filter by project ID */
  projectId?: string;
  /** Filter by client ID */
  clientId?: string;
  /** Callback when file is clicked for detail view */
  onViewFile?: (fileId: number) => void;
}

export const {
  mount: mountFilesManager,
  unmount: unmountFilesManager,
  shouldUseReact: shouldUseReactFilesManager
} = createMountWrapper<FilesMountOptions>({
  Component: FilesManager,
  displayName: 'FilesManager'
});
