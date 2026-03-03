/**
 * Clients Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ClientsTable } from './ClientsTable';

export interface ClientsMountOptions extends BaseMountOptions {
  /** Navigation callback for detail views */
  onNavigate?: (tab: string, entityId?: string) => void;
}

export const {
  mount: mountClientsTable,
  unmount: unmountClientsTable,
  shouldUseReact: shouldUseReactClientsTable
} = createMountWrapper<ClientsMountOptions>({
  Component: ClientsTable,
  displayName: 'ClientsTable'
});
