/**
 * Admin Modals Provider Mount
 * Island architecture mount using createMountWrapper factory.
 * Mounts the modal orchestrator that bridges vanilla JS and React modals.
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { AdminModalsProvider } from './AdminModalsProvider';

export interface AdminModalsMountOptions extends BaseMountOptions {}

export const {
  mount: mountAdminModals,
  unmount: unmountAdminModals,
  shouldUseReact: shouldUseReactAdminModals
} = createMountWrapper<AdminModalsMountOptions>({
  Component: AdminModalsProvider,
  displayName: 'AdminModalsProvider'
});
