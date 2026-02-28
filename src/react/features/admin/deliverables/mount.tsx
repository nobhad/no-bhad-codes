/**
 * Deliverables Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DeliverablesTable } from './DeliverablesTable';

export interface DeliverablesMountOptions extends BaseMountOptions {
  /** Filter by project ID */
  projectId?: string;
  /** Callback when deliverable is clicked for detail view */
  onViewDeliverable?: (deliverableId: number) => void;
}

export const {
  mount: mountDeliverablesTable,
  unmount: unmountDeliverablesTable,
  shouldUseReact: shouldUseReactDeliverablesTable
} = createMountWrapper<DeliverablesMountOptions>({
  Component: DeliverablesTable,
  displayName: 'DeliverablesTable'
});
