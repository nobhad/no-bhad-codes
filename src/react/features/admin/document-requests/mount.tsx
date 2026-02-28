/**
 * Document Requests Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DocumentRequestsTable } from './DocumentRequestsTable';

export interface DocumentRequestsMountOptions extends BaseMountOptions {
  /** Callback when document request is clicked for detail view */
  onViewDocumentRequest?: (documentRequestId: number) => void;
}

export const {
  mount: mountDocumentRequestsTable,
  unmount: unmountDocumentRequestsTable,
  shouldUseReact: shouldUseReactDocumentRequestsTable
} = createMountWrapper<DocumentRequestsMountOptions>({
  Component: DocumentRequestsTable,
  displayName: 'DocumentRequestsTable'
});
