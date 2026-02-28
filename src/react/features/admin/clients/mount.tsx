/**
 * Clients Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ClientsTable } from './ClientsTable';

export interface ClientsMountOptions extends BaseMountOptions {
  /** Callback when client is clicked for detail view */
  onViewClient?: (clientId: number) => void;
}

export const {
  mount: mountClientsTable,
  unmount: unmountClientsTable,
  shouldUseReact: shouldUseReactClientsTable
} = createMountWrapper<ClientsMountOptions>({
  Component: ClientsTable,
  displayName: 'ClientsTable'
});
