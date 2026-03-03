/**
 * Leads Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { LeadsTable } from './LeadsTable';

export interface LeadsMountOptions extends BaseMountOptions {
  /** Navigation callback for detail views */
  onNavigate?: (tab: string, entityId?: string) => void;
}

export const {
  mount: mountLeadsTable,
  unmount: unmountLeadsTable,
  shouldUseReact: shouldUseReactLeadsTable
} = createMountWrapper<LeadsMountOptions>({
  Component: LeadsTable,
  displayName: 'LeadsTable'
});
