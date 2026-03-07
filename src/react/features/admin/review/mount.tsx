/**
 * Review Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ReviewTable } from './ReviewTable';

export interface ReviewMountOptions extends BaseMountOptions {}

export const {
  mount: mountReviewTable,
  unmount: unmountReviewTable,
  shouldUseReact: shouldUseReactReviewTable
} = createMountWrapper<ReviewMountOptions>({
  Component: ReviewTable,
  displayName: 'ReviewTable'
});
