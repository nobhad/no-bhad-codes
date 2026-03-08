/**
 * React Hooks
 * Custom hooks for the React migration
 */

// Animation hooks
export {
  useFadeIn,
  useSlideIn,
  useStaggerChildren,
  useScaleIn,
  useGsapTimeline,
  useScrollReveal
} from './useGsap';

// Data hooks - Admin
export { useProjects } from './useProjects';
export { useClients } from './useClients';
export { useInvoices } from './useInvoices';
export { useLeads } from './useLeads';
export { useProjectDetail } from './useProjectDetail';
export { useClientDetail } from './useClientDetail';

// Data hooks - Portal
export { usePortalFetch, usePortalData } from './usePortalFetch';
export { usePortalInvoices } from './usePortalInvoices';

// Form state hooks
export { useFormState } from './useFormState';

// Table/UI hooks
export { useTableFilters } from './useTableFilters';
export { usePagination } from './usePagination';
export { useSelection } from './useSelection';
export { useExport } from './useExport';

// Portal SPA hooks
export { usePortalAuth } from './usePortalAuth';
