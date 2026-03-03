/**
 * ===============================================
 * REACT FACTORY EXPORTS
 * ===============================================
 * @file src/react/factories/index.ts
 *
 * Central export hub for React factory components and hooks.
 *
 * ## Available Factories
 *
 * ### Mount Factories
 * - `createTableMount` - Basic mount/unmount for table components
 * - `createMountWrapper` - Full-featured mount with selector support
 * - `createSimpleMount` - Quick mount for simple components
 *
 * ### Component Factories
 * - `IconButton` - Icon button with action registry
 * - `StatusBadge` - Status display badges
 * - `StateDisplay` - Empty/Loading/Error states
 * - `StatusCell` - Status dropdown for tables
 * - `PriorityCell` - Priority dropdown for tables
 * - `TableCells` - Reusable table cell components (Date, Currency, etc.)
 * - `FormFields` - Reusable form field components
 * - `TabList` - Primary tab navigation with icons
 * - `TabPanel` - Tab content wrapper
 * - `SubtabList` - Secondary/nested tab navigation
 * - `SubtabPanel` - Subtab content wrapper
 * - `ViewToggle` - Segmented control (Table/Grid, etc.)
 *
 * ### Hook Factories
 * - `useButtonFactory` - Button rendering utilities
 * - `useTableActions` - Table action rendering
 * - `useConditionalActions` - Conditional action rendering
 * - `useActionHandlers` - Unified action handling
 * - `useBulkAction` - Bulk operation handling
 * - `useDataFetch` - Standardized API fetching
 * - `useCrud` - CRUD operations
 * - `useFormField` - Form field state with validation
 * - `useTabs` - Tab state management with optional URL hash persistence
 *
 * ### Utility Factories
 * - `Formatters` - Date, currency, number formatting utilities
 * - `notify` - Standardized notification message templates
 * - `notifiers` - Pre-configured entity notifiers
 * - `StatusConfigs` - Common status configurations for dropdowns
 */

// ============================================
// ICON BUTTON
// ============================================

export {
  IconButton,
  ActionButton,
  TableActionButton,
  TableActions,
  getLucideIcon,
  ICON_COMPONENTS
} from './IconButton';

// ============================================
// BUTTON & ACTION HOOKS
// ============================================

export {
  useButtonFactory,
  useIconSize,
  useTableActions,
  useButtonSet,
  useConditionalActions,
  useActionHandlers
} from './useFactory';

// ============================================
// BULK ACTION HOOK
// ============================================

export {
  useBulkAction,
  BULK_ACTION_PRESETS,
  createStatusChangeAction
} from './useBulkAction';

export type {
  BulkOperationResult,
  BulkActionConfig,
  UseBulkActionOptions,
  UseBulkActionReturn,
  SelectionState,
  NotificationFn
} from './useBulkAction';

// ============================================
// DATA FETCH HOOKS
// ============================================

export {
  useDataFetch,
  useListFetch,
  useCrud
} from './useDataFetch';

export type {
  FetchState,
  UseDataFetchOptions,
  UseDataFetchReturn,
  ListFetchResult,
  UseCrudOptions
} from './useDataFetch';

// ============================================
// STATUS BADGE - Re-exported from components/portal
// See src/react/components/portal/StatusBadge.tsx
// ============================================

export {
  StatusBadge,
  getStatusVariant
} from '../components/portal/StatusBadge';

export type { StatusVariant } from '../components/portal/StatusBadge';

// Badge factory utilities
export {
  BADGE_VARIANTS,
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
} from '../../factories/components/badge-factory';

// ============================================
// STATE DISPLAY
// ============================================

export { EmptyState, LoadingState, ErrorState, Skeleton } from './StateDisplay';

// ============================================
// RE-EXPORT FACTORY TYPES & CONSTANTS
// ============================================

export { UI_CONTEXTS, ICON_SIZES, BUTTON_SIZES, CONTEXT_DEFAULTS } from '../../factories/constants';

export type {
  UIContext,
  IconSizeKey,
  ButtonSizeKey,
  ButtonConfig,
  ButtonVariant,
  BadgeVariant
} from '../../factories/types';

export { BUTTON_ACTIONS } from '../../factories/buttons/button-actions';
export { BUTTON_SETS } from '../../factories/buttons/button-sets';

// ============================================
// MOUNT FACTORIES
// ============================================

// Legacy table mount (still widely used)
export { createTableMount } from './createTableMount';
export type { TableMountOptions, TableMountResult } from './createTableMount';

// New streamlined mount wrapper
export { createMountWrapper, createSimpleMount } from './createMountWrapper';
export type {
  BaseMountOptions,
  MountWrapperConfig,
  MountWrapperResult
} from './createMountWrapper';

// ============================================
// FORMATTERS
// ============================================

export {
  formatDate,
  formatRelativeTime,
  formatMessageTime,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatFileSize,
  truncateText,
  capitalize,
  titleCase,
  formatName,
  pluralize,
  formatPhone,
  Formatters
} from './formatters';

export type {
  DateFormatOptions,
  CurrencyFormatOptions,
  NumberFormatOptions
} from './formatters';

// ============================================
// FORM FIELDS
// ============================================

export {
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
  RadioGroupField,
  FormFieldGroup,
  useFormField,
  FormFields
} from './createFormField';

export type {
  FormFieldBaseProps,
  TextFieldProps,
  TextAreaFieldProps,
  SelectFieldProps,
  CheckboxFieldProps,
  RadioGroupFieldProps
} from './createFormField';

// ============================================
// STATUS CELLS
// ============================================

export {
  StatusCell,
  PriorityCell,
  getStatusVariant as getStatusVariantFromConfig,
  getStatusLabel,
  createStatusConfig,
  StatusConfigs,
  PROJECT_STATUS_CONFIG,
  CLIENT_STATUS_CONFIG,
  INVOICE_STATUS_CONFIG,
  LEAD_STATUS_CONFIG,
  TASK_STATUS_CONFIG,
  DELIVERABLE_STATUS_CONFIG,
  CONTRACT_STATUS_CONFIG,
  DOCUMENT_REQUEST_STATUS_CONFIG
} from './createStatusCell';

export type {
  StatusOption,
  StatusConfig,
  StatusCellProps,
  PriorityCellProps
} from './createStatusCell';

// ============================================
// TABLE CELLS
// ============================================

export {
  DateCell,
  CurrencyCell,
  FileSizeCell,
  ContactCell,
  PhoneCell,
  EmailCell,
  LinkCell,
  CountCell,
  CopyCell,
  TextCell,
  TableCells
} from './createTableCells';

export type {
  DateCellProps,
  CurrencyCellProps,
  FileSizeCellProps,
  ContactCellProps,
  PhoneCellProps,
  EmailCellProps,
  LinkCellProps,
  CountCellProps,
  CopyCellProps,
  TextCellProps
} from './createTableCells';

// ============================================
// NOTIFICATIONS
// ============================================

export {
  notify,
  createEntityNotifier,
  notifiers
} from './createNotification';

export type {
  NotificationType,
  NotificationMessage,
  NotificationFunction
} from './createNotification';

// ============================================
// TABS
// ============================================

export {
  TabList,
  TabPanel,
  SubtabList,
  SubtabPanel,
  ViewToggle,
  useTabs,
  useSubtabs,
  createTabs,
  createTabIcons,
  TabComponents
} from './createTabs';

export type {
  TabItem,
  TabIconMap,
  TabListProps,
  TabPanelProps,
  SubtabListProps,
  SubtabPanelProps,
  ViewToggleOption,
  ViewToggleProps,
  UseTabsOptions,
  UseTabsReturn
} from './createTabs';
