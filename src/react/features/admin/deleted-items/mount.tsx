/**
 * Deleted Items Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { DeletedItemsTable } from './DeletedItemsTable';

export interface DeletedItemsMountOptions extends BaseMountOptions {
  /** Callback when item is clicked for detail view */
  onViewItem?: (itemId: number, itemType: string) => void;
}

export const {
  mount: mountDeletedItemsTable,
  unmount: unmountDeletedItemsTable,
  shouldUseReact: shouldUseReactDeletedItemsTable
} = createMountWrapper<DeletedItemsMountOptions>({
  Component: DeletedItemsTable,
  displayName: 'DeletedItemsTable'
});
