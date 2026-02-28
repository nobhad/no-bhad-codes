/**
 * Portal Document Requests Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalDocumentRequests } from './PortalDocumentRequests';

export interface PortalDocumentRequestsMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalDocumentRequests,
  unmount: unmountPortalDocumentRequests,
  shouldUseReact: shouldUseReactPortalDocumentRequests
} = createMountWrapper<PortalDocumentRequestsMountOptions>({
  Component: PortalDocumentRequests,
  displayName: 'PortalDocumentRequests'
});
