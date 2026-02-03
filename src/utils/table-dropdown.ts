/**
 * ===============================================
 * TABLE DROPDOWN (RE-EXPORT)
 * ===============================================
 * @file src/utils/table-dropdown.ts
 *
 * Re-exports from src/components/table-dropdown.ts for backward compatibility.
 * Prefer importing from '@/components' or 'src/components/table-dropdown'.
 */

export {
  createTableDropdown,
  getStatusLabel,
  LEAD_STATUS_OPTIONS,
  CONTACT_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS
} from '../components/table-dropdown';
export type { TableDropdownOption, TableDropdownConfig } from '../components/table-dropdown';
