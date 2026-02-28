/**
 * Design Review Panel Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DesignReviewPanel } from './DesignReviewPanel';

export interface DesignReviewMountOptions extends BaseMountOptions {
  /** Filter by project ID */
  projectId?: string;
  /** Callback when design item is clicked for detail view */
  onViewDesignItem?: (itemId: number) => void;
}

export const {
  mount: mountDesignReviewPanel,
  unmount: unmountDesignReviewPanel,
  shouldUseReact: shouldUseReactDesignReviewPanel
} = createMountWrapper<DesignReviewMountOptions>({
  Component: DesignReviewPanel,
  displayName: 'DesignReviewPanel'
});
