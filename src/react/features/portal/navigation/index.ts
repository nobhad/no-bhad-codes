/**
 * Portal Navigation Module
 * Exports for the client portal navigation/sidebar feature
 */

// Components
export { PortalSidebar, type PortalNavigationProps } from './PortalSidebar';
export { PortalHeader, type PortalHeaderProps } from './PortalHeader';
export { NavItem, type NavItemProps } from './NavItem';

// Mount functions
export {
  mountPortalNavigation,
  unmountPortalNavigation,
  updatePortalNavigation,
  isPortalNavigationMounted,
  shouldUseReactPortalNavigation,
  type PortalNavigationMountOptions
} from './mount';
