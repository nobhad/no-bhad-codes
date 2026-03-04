/**
 * Portal Preview Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalPreview } from './PortalPreview';

export interface PortalPreviewMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalPreview,
  unmount: unmountPortalPreview,
  shouldUseReact: shouldUseReactPortalPreview
} = createMountWrapper<PortalPreviewMountOptions>({
  Component: PortalPreview,
  displayName: 'PortalPreview'
});
