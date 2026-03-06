/**
 * Review Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ReviewPanel } from './ReviewPanel';

export interface ReviewMountOptions extends BaseMountOptions {}

export const {
  mount: mountReviewPanel,
  unmount: unmountReviewPanel,
  shouldUseReact: shouldUseReactReviewPanel
} = createMountWrapper<ReviewMountOptions>({
  Component: ReviewPanel,
  displayName: 'ReviewPanel'
});
