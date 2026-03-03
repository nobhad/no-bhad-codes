/**
 * Documents Dashboard Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DocumentsDashboard } from './DocumentsDashboard';

export interface DocumentsDashboardMountOptions extends BaseMountOptions {}

export const {
  mount: mountDocumentsDashboard,
  unmount: unmountDocumentsDashboard,
  shouldUseReact: shouldUseReactDocumentsDashboard
} = createMountWrapper<DocumentsDashboardMountOptions>({
  Component: DocumentsDashboard,
  displayName: 'DocumentsDashboard'
});
