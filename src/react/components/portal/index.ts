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
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableFooter,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableCaption,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from './PortalTable';

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

// File Upload
export {
  FileUpload,
  FileUploadProgress,
  useFileUpload,
  type FileUploadProps,
  type FileUploadProgressProps,
  type FileUploadFile,
  type UseFileUploadOptions,
  type UseFileUploadReturn
} from './FileUpload';

// Modal Dropdown
export {
  ModalDropdown,
  useModalDropdown,
  type ModalDropdownOption,
  type ModalDropdownProps
} from './ModalDropdown';

// Stat Card
export { StatCard, StatsRow, type StatCardProps, type StatsRowProps } from './StatCard';

// View Layout
export { PortalViewLayout, type PortalViewLayoutProps } from './PortalViewLayout';

// Table Layout
export {
  TableLayout,
  TableStats,
  TableActions,
  type TableLayoutProps,
  type StatItem as TableStatItem,
  type TableStatsProps,
  type TableActionsProps
} from './TableLayout';

// Table Filters
export {
  SearchFilter,
  FilterDropdown,
  ExportButton,
  type SearchFilterProps,
  type FilterOption as TableFilterOption,
  type FilterSection,
  type FilterDropdownProps,
  type ExportButtonProps
} from './TableFilters';

// Progress Bar
export { ProgressBar, type ProgressBarProps } from './ProgressBar';

// Copy Email Button
export { CopyEmailButton } from './CopyEmailButton';

// Detail Header
export { DetailHeader, type DetailHeaderProps, type MetaField } from './DetailHeader';

// Empty State (re-exports from factories)
export {
  EmptyState,
  ErrorState,
  LoadingState,
  Skeleton,
  EmptyStateNoResults,
  EmptyStateNoFiles,
  EmptyStateNoData,
  EmptyStateError,
  type EmptyStateProps
} from './EmptyState';
