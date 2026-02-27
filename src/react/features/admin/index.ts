/**
 * Admin Features
 * React components for the admin dashboard
 */

// Types
export * from './types';

// Projects
export { ProjectsTable, mountProjectsTable, unmountProjectsTable } from './projects';

// Leads
export { LeadsTable, mountLeadsTable, unmountLeadsTable } from './leads';

// Clients
export { ClientsTable, mountClientsTable, unmountClientsTable } from './clients';

// Invoices
export { InvoicesTable, mountInvoicesTable, unmountInvoicesTable } from './invoices';

// Project Detail
export {
  ProjectDetail,
  OverviewTab,
  mountProjectDetail,
  shouldUseReactProjectDetail
} from './project-detail';
