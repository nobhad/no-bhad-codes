/**
 * Client Detail Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ClientDetail } from './ClientDetail';

export interface ClientDetailMountOptions extends BaseMountOptions {
  /** Client ID to display */
  clientId: number;
  /** Callback to go back to clients list */
  onBack?: () => void;
  /** Callback to edit client */
  onEdit?: (clientId: number) => void;
  /** Callback to view project */
  onViewProject?: (projectId: number) => void;
}

export const {
  mount: mountClientDetail,
  unmount: unmountClientDetail,
  shouldUseReact: shouldUseReactClientDetail
} = createMountWrapper<ClientDetailMountOptions>({
  Component: ClientDetail,
  displayName: 'ClientDetail'
});
