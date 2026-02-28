/**
 * Contacts Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ContactsTable } from './ContactsTable';

export interface ContactsMountOptions extends BaseMountOptions {
  /** Callback when contact is clicked for detail view */
  onViewContact?: (contactId: number) => void;
}

export const {
  mount: mountContactsTable,
  unmount: unmountContactsTable,
  shouldUseReact: shouldUseReactContactsTable
} = createMountWrapper<ContactsMountOptions>({
  Component: ContactsTable,
  displayName: 'ContactsTable'
});
