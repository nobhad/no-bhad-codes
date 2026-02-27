/**
 * DataTable Types
 * Shared type definitions for the reusable DataTable component
 */

import type { ReactNode } from 'react';
import type { ExportConfig } from '../../../../utils/table-export';

/**
 * Notification type for callbacks
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * Sort configuration
 */
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter option for dropdowns
 */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

/**
 * Stat item for the stats bar
 */
export interface StatItem {
  key: string;
  label: string;
  value: number;
  color?: string;
}

/**
 * Column configuration
 */
export interface ColumnConfig<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  label: string;
  /** CSS width (e.g., '25%', '100px') */
  width?: string;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Sort key if different from key */
  sortKey?: string;
  /** Custom render function */
  render?: (item: T, index: number) => ReactNode;
  /** CSS class for the header cell */
  headerClassName?: string;
  /** CSS class for the body cell */
  cellClassName?: string;
}

/**
 * Bulk action configuration
 */
export interface BulkActionConfig {
  /** Unique action ID */
  id: string;
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether action is loading */
  loading?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Variant for styling */
  variant?: 'default' | 'danger';
}

/**
 * Row action configuration
 */
export interface RowActionConfig<T> {
  /** Unique action ID */
  id: string;
  /** Icon component */
  icon: ReactNode;
  /** Tooltip title */
  title: string;
  /** Click handler */
  onClick: (item: T) => void;
  /** Whether to show this action */
  show?: (item: T) => boolean;
  /** Whether action is loading */
  loading?: (item: T) => boolean;
}

/**
 * Props for the DataTable component
 */
export interface DataTableProps<T extends { id: number }> {
  /** Array of data items */
  data: T[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error?: string | null;
  /** Refetch data function */
  onRefetch: () => void;

  /** Column definitions */
  columns: ColumnConfig<T>[];
  /** Filter configuration */
  filterConfig?: FilterConfig[];
  /** Stats to display */
  stats?: StatItem[];

  /** Storage key prefix for persistence */
  storageKey: string;
  /** Default sort configuration */
  defaultSort?: SortConfig;
  /** Default page size */
  defaultPageSize?: number;

  /** Filter function */
  filterFn?: (item: T, filters: Record<string, string>, search: string) => boolean;
  /** Sort function */
  sortFn?: (a: T, b: T, sort: SortConfig) => number;

  /** Export configuration (use existing EXPORT_CONFIG from table-export.ts) */
  exportConfig?: ExportConfig;

  /** Bulk actions */
  bulkActions?: BulkActionConfig[];
  /** Show delete in bulk actions */
  showBulkDelete?: boolean;
  /** Handler for bulk delete */
  onBulkDelete?: (ids: number[]) => Promise<{ success: number; failed: number }>;

  /** Callback when row is clicked */
  onRowClick?: (item: T) => void;
  /** Custom row actions */
  rowActions?: RowActionConfig<T>[];

  /** Show notification callback */
  showNotification?: (message: string, type: NotificationType) => void;

  /** Empty state message */
  emptyMessage?: string;
  /** Empty state message when filters active */
  emptyFilteredMessage?: string;

  /** Custom cell renderer (if columns config is not enough) */
  renderCell?: (item: T, column: ColumnConfig<T>, index: number) => ReactNode;

  /** Additional class name for the container */
  className?: string;
}
