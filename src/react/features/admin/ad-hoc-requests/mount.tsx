/**
 * Ad Hoc Requests Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { AdHocRequestsTable } from './AdHocRequestsTable';

export interface AdHocRequestsMountOptions extends BaseMountOptions {
  /** Filter by client ID */
  clientId?: string;
  /** Filter by project ID */
  projectId?: string;
  /** Callback when ad hoc request is clicked for detail view */
  onViewAdHocRequest?: (requestId: number) => void;
}

export const {
  mount: mountAdHocRequestsTable,
  unmount: unmountAdHocRequestsTable,
  shouldUseReact: shouldUseReactAdHocRequestsTable
} = createMountWrapper<AdHocRequestsMountOptions>({
  Component: AdHocRequestsTable,
  displayName: 'AdHocRequestsTable'
});
