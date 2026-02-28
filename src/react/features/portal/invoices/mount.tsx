/**
 * Portal Invoices Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalInvoicesTable } from './PortalInvoicesTable';

export interface PortalInvoicesMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalInvoices,
  unmount: unmountPortalInvoices,
  shouldUseReact: shouldUseReactPortalInvoices
} = createMountWrapper<PortalInvoicesMountOptions>({
  Component: PortalInvoicesTable,
  displayName: 'PortalInvoicesTable'
});
