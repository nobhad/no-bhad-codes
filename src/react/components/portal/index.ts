/**
 * Portal Components
 * React component wrappers that match the existing design system
 */

// Button
export { PortalButton, type PortalButtonProps } from './PortalButton';

// Badge
export {
  StatusBadge,
  getStatusVariant,
  type StatusBadgeProps,
  type StatusVariant
} from './StatusBadge';

// Modal
export { PortalModal, useModal, DialogPrimitive } from './PortalModal';

// Dropdown
export {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
  PortalDropdownCheckboxItem,
  PortalDropdownRadioItem,
  PortalDropdownLabel,
  PortalDropdownSeparator,
  PortalDropdownShortcut,
  PortalDropdownGroup,
  PortalDropdownPortal,
  PortalDropdownSub,
  PortalDropdownSubContent,
  PortalDropdownSubTrigger,
  PortalDropdownRadioGroup
} from './PortalDropdown';

// Table
export {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableFooter,
  AdminTableHead,
  AdminTableRow,
  AdminTableCell,
  AdminTableCaption,
  AdminTableEmpty,
  AdminTableLoading,
  AdminTableError
} from './AdminTable';

// Inline Edit
export {
  InlineEdit,
  formatCurrencyDisplay,
  parseCurrencyInput,
  formatDateForDisplay,
  formatDateForInput,
  parseDateInput
} from './InlineEdit';

// Bulk Actions
export { BulkActionsToolbar } from './BulkActionsToolbar';

// Confirm Dialog
export { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';

// Input
export { PortalInput, type PortalInputProps } from './PortalInput';

// DataTable
export {
  DataTable,
  type DataTableProps,
  type ColumnConfig,
  type FilterConfig,
  type FilterOption,
  type StatItem,
  type BulkActionConfig,
  type RowActionConfig,
  type SortConfig,
  type NotificationType
} from './DataTable';

// Table Pagination
export { TablePagination, paginationToProps, type TablePaginationProps } from './TablePagination';
