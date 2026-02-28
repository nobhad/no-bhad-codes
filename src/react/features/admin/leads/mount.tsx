/**
 * Leads Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { LeadsTable } from './LeadsTable';

export interface LeadsMountOptions extends BaseMountOptions {
  /** Callback when lead is viewed */
  onViewLead?: (leadId: number) => void;
}

export const {
  mount: mountLeadsTable,
  unmount: unmountLeadsTable,
  shouldUseReact: shouldUseReactLeadsTable
} = createMountWrapper<LeadsMountOptions>({
  Component: LeadsTable,
  displayName: 'LeadsTable'
});
