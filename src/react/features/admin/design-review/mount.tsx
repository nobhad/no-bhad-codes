/**
 * Design Review Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DesignReviewTable } from './DesignReviewTable';

export interface DesignReviewMountOptions extends BaseMountOptions {
  /** Filter by project ID */
  projectId?: string;
  /** Callback when design item is clicked for detail view */
  onViewDesignItem?: (itemId: number) => void;
}

export const {
  mount: mountDesignReviewTable,
  unmount: unmountDesignReviewTable,
  shouldUseReact: shouldUseReactDesignReviewTable
} = createMountWrapper<DesignReviewMountOptions>({
  Component: DesignReviewTable,
  displayName: 'DesignReviewTable'
});
