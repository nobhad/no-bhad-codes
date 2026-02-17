/**
 * ===============================================
 * COMPONENT SYSTEM REGISTRY
 * ===============================================
 * @file src/components/index.ts
 *
 * Central registry for all components and component utilities.
 */

// Barrel exports from grouped component modules
export * from './utility-components';
export * from './ui-components';
export * from './dashboard-components';
export * from './form-components';
export * from './table-components';
export * from './portal-components';
export * from './state-components';

// Portal-shared (reusable for admin + client wireframes)
export { renderBreadcrumbs } from './breadcrumbs';
export type { BreadcrumbItem } from './breadcrumbs';
export { setupTabRouter } from './tab-router';
export type { TabRouterConfig } from './tab-router';
export { createQuickStats } from './quick-stats';
export type { QuickStatItem } from './quick-stats';
export { createRecentActivity } from './recent-activity';
export type { RecentActivityItem } from './recent-activity';
export { createPageHeader } from './page-header';
export type { PageHeaderConfig } from './page-header';
export { createSearchBar } from './search-bar';
export type { SearchBarConfig } from './search-bar';
export {
  createEmptyState,
  renderEmptyState,
  createLoadingState,
  renderLoadingState,
  createErrorState,
  renderErrorState
} from './empty-state';
export type { EmptyStateOptions, LoadingStateOptions, ErrorStateOptions } from './empty-state';

// Form builder components
export {
  createFormGroup,
  createTextInput,
  createTextArea,
  createDatePicker,
  createNumberInput,
  getNumberInputValue,
  setNumberInputValue,
  createRadioGroup,
  createFormRow,
  createFormSection,
  createFileUpload,
  clearFileUpload,
  setInputError,
  clearInputError,
  validateFormGroup
} from './form-builder';
export type {
  FormGroupConfig,
  TextInputConfig,
  TextAreaConfig,
  DatePickerConfig,
  NumberInputConfig,
  RadioOption,
  RadioGroupConfig,
  FormRowConfig,
  FormSectionConfig,
  FileUploadConfig
} from './form-builder';

// Table builder components
export {
  createTableRow,
  createTableCell,
  createActionCell,
  getActionCellHTML,
  createStatusCell,
  getStatusCellHTML,
  createTablePagination,
  createSortableHeader
} from './table-builder';
export type {
  TableActionConfig,
  TableRowConfig,
  TableCellConfig,
  ActionCellConfig,
  StatusCellConfig,
  TablePaginationConfig,
  SortableHeaderConfig
} from './table-builder';
export { createStatusBadge, getStatusBadgeHTML, createStatusDot, getStatusDotHTML } from './status-badge';
export type { StatusBadgeVariant } from './status-badge';
export { createIconButton } from './icon-button';
export type { IconButtonConfig } from './icon-button';
export { createPageTitle } from './page-title';
export type { PageTitleConfig } from './page-title';
export { createViewToggle } from './view-toggle';
export type { ViewToggleConfig, ViewToggleOption } from './view-toggle';
export { createFilterSelect } from './filter-select';
export type { FilterSelectConfig, FilterSelectOption, FilterSelectInstance } from './filter-select';
export { createFormSelect } from './form-select';
export type { FormSelectConfig, FormSelectOption, FormSelectInstance } from './form-select';
export { createTableDropdown, getStatusLabel, LEAD_STATUS_OPTIONS, CONTACT_STATUS_OPTIONS, PROJECT_STATUS_OPTIONS } from './table-dropdown';
export type { TableDropdownOption, TableDropdownConfig } from './table-dropdown';
export { createPortalModal } from './portal-modal';
export type { PortalModalConfig, PortalModalInstance } from './portal-modal';
export { getPortalCheckboxHTML } from './portal-checkbox';
export type { PortalCheckboxConfig } from './portal-checkbox';
export { initPasswordToggle, initAllPasswordToggles } from './password-toggle';
export { createSecondarySidebar, SECONDARY_TAB_ICONS } from './secondary-sidebar';
export type { SecondaryTab, SecondarySidebarConfig, SecondarySidebarController } from './secondary-sidebar';

// Bulk action utilities
export {
  createBulkActionToolbar,
  createHeaderCheckbox,
  createRowCheckbox,
  setupBulkSelectionHandlers,
  resetSelection,
  getSelectionState,
  getSelectedIds,
  createArchiveAction,
  createDeleteAction,
  createStatusUpdateAction
} from '../utils/table-bulk-actions';
export type { BulkAction, BulkActionConfig, BulkSelectionState } from '../utils/table-bulk-actions';

// Focus trap utilities
export {
  createFocusTrap,
  removeFocusTrap,
  hasFocusTrap,
  manageFocusTrap
} from '../utils/focus-trap';

// Loading state utilities
export {
  getTableLoadingRow,
  getContainerLoadingHTML,
  getInlineLoadingHTML,
  getTableEmptyRow,
  showTableEmpty,
  showTableLoading,
  showContainerLoading,
  getListSkeletonHTML,
  getCardSkeletonHTML,
  getChartSkeletonHTML,
  withLoading
} from '../utils/loading-utils';

// Button loading utilities
export {
  setButtonLoading,
  clearButtonLoading,
  withButtonLoading
} from '../utils/button-loading';

// Button components (standalone HTML elements)
export {
  createButton as createButtonElement,
  getButtonHTML,
  createButtonGroup,
  createLinkButton,
  createToggleButton,
  createButtonWithBadge,
  updateButtonBadge,
  setButtonLoadingState
} from './button';
export type {
  ButtonVariant,
  ButtonSize,
  ButtonConfig,
  ButtonGroupConfig,
  LinkButtonConfig,
  ToggleButtonConfig,
  ButtonWithBadgeConfig
} from './button';

// Filter components
export {
  createSearchFilter,
  createStatusFilter,
  createDateRangeFilter,
  createPerPageSelect,
  createFilterBar
} from './filters';
export type {
  SearchFilterConfig,
  StatusFilterOption,
  StatusFilterConfig,
  DateRangeFilterConfig,
  PerPageSelectConfig,
  FilterBarConfig
} from './filters';

// Data display components
export {
  createCard,
  createStatCard,
  createInfoRow,
  createInfoList,
  createProgressBar,
  updateProgressBar,
  createAlert,
  createSpinner,
  createSkeleton,
  createSkeletonList
} from './data-display';
export type {
  CardConfig,
  StatCardConfig,
  InfoRowConfig,
  ProgressBarConfig,
  AlertConfig,
  SpinnerConfig,
  SkeletonConfig
} from './data-display';

// Dropdown components
export {
  createDropdown,
  createDropdownButton,
  createSplitButton,
  createTooltip,
  createPopover
} from './dropdown';
export type {
  DropdownItem,
  DropdownConfig,
  DropdownButtonConfig,
  SplitButtonConfig,
  TooltipConfig,
  PopoverConfig
} from './dropdown';

// Navigation components
export {
  createTabs,
  switchTab,
  createNavItem,
  createSidebar,
  toggleSidebar,
  setActiveNavItem,
  createStepIndicator,
  setCurrentStep
} from './navigation';
export type {
  TabItem,
  TabsConfig,
  NavItemConfig,
  SidebarConfig,
  StepItem,
  StepIndicatorConfig
} from './navigation';

// Complex components
export {
  createLineItemEditor,
  getLineItems,
  createFileIcon,
  createInlineEdit,
  createTableToolbar,
  createDataTable,
  updateDataTable,
  getSelectedKeys
} from './complex-components';
export type {
  LineItem,
  LineItemEditorConfig,
  FileIconConfig,
  InlineEditConfig,
  TableColumn,
  TableToolbarConfig,
  DataTableConfig
} from './complex-components';

// Utility functions for common operations
export { createConsentBanner } from './create-consent-banner';

/**
 * ComponentRegistry placeholder for future component system expansion
 */
export class ComponentRegistry {
  // Methods to be implemented as needed
}
