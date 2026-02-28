/**
 * Contracts Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ContractsTable } from './ContractsTable';

export interface ContractsMountOptions extends BaseMountOptions {
  /** Callback when contract is clicked for detail view */
  onViewContract?: (contractId: number) => void;
}

export const {
  mount: mountContractsTable,
  unmount: unmountContractsTable,
  shouldUseReact: shouldUseReactContractsTable
} = createMountWrapper<ContractsMountOptions>({
  Component: ContractsTable,
  displayName: 'ContractsTable'
});
