/**
 * Invoices Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { InvoicesTable } from './InvoicesTable';

export interface InvoicesMountOptions extends BaseMountOptions {
  /** Callback when invoice is clicked for detail view */
  onViewInvoice?: (invoiceId: number) => void;
}

export const {
  mount: mountInvoicesTable,
  unmount: unmountInvoicesTable,
  shouldUseReact: shouldUseReactInvoicesTable
} = createMountWrapper<InvoicesMountOptions>({
  Component: InvoicesTable,
  displayName: 'InvoicesTable'
});
